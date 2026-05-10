"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { sanitizeCardHtml } from "@/lib/card-html";
import { httpCoachClient } from "@/lib/coach-client";
import { ReviewSession, type ReviewSessionState } from "@/lib/review-session";
import { nextIntervalDays } from "@/lib/scheduler";
import { browserDeckStore } from "@/lib/storage";
import type { Rating, ReviewCard } from "@/lib/types";

const SAMPLE_CSV = `Question,Answer,Context,Explanation
"When should you use **Good** instead of **Easy**?","Use **Good** when recall was solid but not automatic.","SRS","Easy should be reserved for cold, fluent retrieval."
"What goes wrong if the LLM auto-rates every answer?","Learner loses judgment; weak calibration hides behind automation.","Review","The model can critique, but the learner owns memory confidence."`;
const THEME_KEY = "kairo.theme";
const MAX_FOLLOW_UP_REPLIES = 4;
type Theme = "light" | "dark";
type ActiveTab = "review" | "add";

export default function Home() {
  const sessionRef = useRef<ReviewSession | null>(null);
  const [sessionState, setSessionState] = useState<ReviewSessionState>({
    cards: [],
    active: {
      answer: "",
      feedback: null,
      proposedReviewMemory: undefined,
      coachingThread: [],
      hasOpenFollowUpPrompt: false,
      hint: ""
    },
    sessionReviewedCount: 0
  });
  const [csvText, setCsvText] = useState("");
  const [importError, setImportError] = useState("");
  const [importResult, setImportResult] = useState("");
  const [followUpReply, setFollowUpReply] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCoaching, setIsCoaching] = useState(false);
  const [isHinting, setIsHinting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [theme, setTheme] = useState<Theme>("dark");
  const [activeTab, setActiveTab] = useState<ActiveTab>("review");
  const [isDeckLoaded, setIsDeckLoaded] = useState(false);

  useEffect(() => {
    const session = new ReviewSession(browserDeckStore(), httpCoachClient());
    sessionRef.current = session;
    setSessionState(session.load());
    setIsDeckLoaded(true);
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === "light") setTheme("light");
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  function session(): ReviewSession {
    if (!sessionRef.current) throw new Error("Review session is not ready.");
    return sessionRef.current;
  }

  const snapshot = useMemo(() => sessionRef.current?.getSnapshot() ?? { queue: [], dueCount: 0, newCount: 0, totalCount: 0 }, [sessionState]);
  const { answer, feedback, coachingThread, hasOpenFollowUpPrompt, hint } = sessionState.active;
  const { cards, sessionReviewedCount } = sessionState;
  const current = snapshot.current;
  const readyCount = snapshot.queue.length;
  const sessionTotal = current ? readyCount + sessionReviewedCount : readyCount;
  const ratingIntervals = current ? ratingIntervalLabels(current) : undefined;
  const followUpReplyCount = coachingThread.filter((message) => message.role === "learner").length - 1;
  const canReplyToFollowUp = hasOpenFollowUpPrompt && followUpReplyCount < MAX_FOLLOW_UP_REPLIES;

  const rateCard = useCallback(
    (rating: Rating) => {
      if (!current || !feedback) return;

      setSessionState(session().rateCurrentCard(rating));
      setFollowUpReply("");
      setApiError("");
    },
    [current, feedback]
  );

  useEffect(() => {
    function handleRatingShortcut(event: KeyboardEvent) {
      if (!current || !feedback || event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target)) {
        return;
      }

      const rating = ratingForShortcut(event.key);
      if (!rating) return;

      event.preventDefault();
      rateCard(rating);
    }

    window.addEventListener("keydown", handleRatingShortcut);
    return () => window.removeEventListener("keydown", handleRatingShortcut);
  }, [current, feedback, rateCard]);

  function importCards() {
    try {
      setSessionState(session().importDeck(csvText));
      setImportError("");
      setImportResult("");
      setCsvText("");
      setActiveTab("review");
      resetReviewState();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed.");
    }
  }

  function appendCards() {
    try {
      const result = session().appendDeck(csvText);
      setSessionState(result.state);
      setImportError("");
      setImportResult(`Added ${result.addedCount} cards. Skipped ${result.skippedDuplicateCount} duplicates.`);
      setCsvText("");
      setActiveTab("review");
      resetReviewState();
    } catch (error) {
      setImportResult("");
      setImportError(error instanceof Error ? error.message : "Import failed.");
    }
  }

  async function requestHint() {
    if (!current) return;
    setIsHinting(true);
    setApiError("");

    try {
      await session().requestHint();
      setSessionState(session().getState());
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Hint failed.");
    } finally {
      setIsHinting(false);
    }
  }

  async function submitAnswer() {
    if (!current || !answer.trim()) return;
    setIsSubmitting(true);
    setApiError("");

    try {
      await session().submitAnswer(answer);
      setSessionState(session().getState());
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Feedback failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitFollowUpReply() {
    if (!current || !feedback || !followUpReply.trim() || followUpReplyCount >= MAX_FOLLOW_UP_REPLIES) return;

    const reply = followUpReply;
    setFollowUpReply("");
    setIsCoaching(true);
    setApiError("");

    try {
      await session().submitFollowUpReply(reply);
      setSessionState(session().getState());
    } catch (error) {
      setSessionState(session().getState());
      setFollowUpReply(reply);
      setApiError(error instanceof Error ? error.message : "Coaching failed.");
    } finally {
      setIsCoaching(false);
    }
  }

  function resetAll() {
    setSessionState(session().clear());
    setCsvText("");
    setImportError("");
    setImportResult("");
    resetReviewState();
  }

  function resetReviewState() {
    setSessionState(session().resetActiveReview());
    setFollowUpReply("");
    setApiError("");
  }

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
  }

  if (!isDeckLoaded) {
    return null;
  }

  if (cards.length === 0) {
    return (
      <main className="shell import-shell">
        <ThemeToggle theme={theme} onToggle={toggleTheme} />
        <section className="import-panel">
          <div>
            <p className="eyebrow">Kairo Review</p>
            <h1>Paste Anki CSV. Review with feedback.</h1>
            <p className="subtle">
              Expected columns: <code>Question</code>, <code>Answer</code>, <code>Context</code>,{" "}
              <code>Explanation</code>.
            </p>
          </div>

          <textarea
            className="csv-input"
            value={csvText}
            onChange={(event) => setCsvText(event.target.value)}
            placeholder={SAMPLE_CSV}
            spellCheck={false}
          />

          {importError ? <p className="error">{importError}</p> : null}
          {importResult ? <p className="success">{importResult}</p> : null}

          <div className="actions">
            <button className="primary" onClick={importCards} disabled={!csvText.trim()}>
              Import deck
            </button>
            <button className="secondary" onClick={() => setCsvText(SAMPLE_CSV)}>
              Use sample
            </button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="shell">
      <ThemeToggle theme={theme} onToggle={toggleTheme} />
      <header className="topbar">
        <div>
          <p className="eyebrow">Kairo Review</p>
          <h1>Review</h1>
        </div>
        <div className="stats" aria-label="Deck stats">
          <span>{snapshot.dueCount} due</span>
          <span>{snapshot.newCount} new</span>
          <span>{snapshot.totalCount} total</span>
        </div>
      </header>

      <nav className="tabs" aria-label="Deck views">
        <button
          type="button"
          className={activeTab === "review" ? "active" : ""}
          onClick={() => setActiveTab("review")}
          aria-current={activeTab === "review" ? "page" : undefined}
        >
          Review
        </button>
        <button
          type="button"
          className={activeTab === "add" ? "active" : ""}
          onClick={() => setActiveTab("add")}
          aria-current={activeTab === "add" ? "page" : undefined}
        >
          Add cards
        </button>
      </nav>

      {activeTab === "add" ? (
        <section className="add-cards-layout" aria-label="Add cards">
          <article className="add-cards-card">
            <div className="card-meta">
              <span>Append import</span>
              <span>{snapshot.totalCount} cards</span>
            </div>
            <h2>Add cards</h2>
            <p className="subtle">
              Paste CSV with <code>Question</code>, <code>Answer</code>, <code>Context</code>,{" "}
              <code>Explanation</code>.
            </p>

            <label className="answer-label" htmlFor="append-csv">
              CSV
            </label>
            <textarea
              id="append-csv"
              className="csv-input append-csv-input"
              value={csvText}
              onChange={(event) => setCsvText(event.target.value)}
              placeholder={SAMPLE_CSV}
              spellCheck={false}
            />

            {importError ? <p className="error">{importError}</p> : null}
            {importResult ? <p className="success">{importResult}</p> : null}

            <div className="actions">
              <button className="primary" onClick={appendCards} disabled={!csvText.trim()}>
                Add cards
              </button>
              <button className="secondary" onClick={() => setCsvText(SAMPLE_CSV)}>
                Use sample
              </button>
            </div>
          </article>

          <aside className="add-cards-panel">
            <h2>Import rules</h2>
            <div className="truth">
              <p>Existing review progress stays untouched.</p>
              <p>Duplicate question-answer pairs are skipped.</p>
              <p>New cards enter the queue immediately.</p>
            </div>
          </aside>
        </section>
      ) : !current ? (
        <section className={`empty-state ${sessionReviewedCount > 0 ? "session-complete" : ""}`}>
          {sessionReviewedCount > 0 ? (
            <>
              <p className="eyebrow">Session complete</p>
              <h2>{sessionReviewedCount} cards reviewed.</h2>
              <p className="subtle">Queue cleared for now. Come back when reviews mature.</p>
            </>
          ) : (
            <>
              <h2>Nothing due.</h2>
              <p className="subtle">New cards are capped at 20 per day. Come back when reviews mature.</p>
            </>
          )}
          <button className="secondary" onClick={resetAll}>
            Reset deck
          </button>
        </section>
      ) : (
        <section className={`review-layout ${feedback ? "with-feedback" : "solo-review"}`}>
          <article className="review-card">
            <div className="session-strip" aria-label="Review progress">
              <span>
                Card {sessionReviewedCount + 1} of {sessionTotal}
              </span>
            </div>

            <div className="card-meta">
              <span>{current.context || "Card"}</span>
            </div>
            <SafeHtml className="question" html={current.question} />

            {!feedback ? (
              <>
                <label className="answer-label" htmlFor="answer">
                  Your answer
                </label>
                <textarea
                  id="answer"
                  className="answer-input"
                  value={answer}
                  onChange={(event) => setSessionState(session().setAnswer(event.target.value))}
                  onKeyDown={(event) => {
                    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                      event.preventDefault();
                      void submitAnswer();
                    }
                  }}
                  placeholder="Type your answer before checking."
                />

                {hint ? <p className="hint">{hint}</p> : null}
                {apiError ? <p className="error">{apiError}</p> : null}

                <div className="actions">
                  <button className="secondary" onClick={requestHint} disabled={isHinting}>
                    {isHinting ? "Hinting..." : "Hint"}
                  </button>
                  <button className="primary" onClick={submitAnswer} disabled={isSubmitting || !answer.trim()}>
                    {isSubmitting ? "Checking..." : "Check answer"}
                  </button>
                </div>
              </>
            ) : (
              <section className="coaching-thread" aria-label="Coaching thread">
                <div className="messages">
                  {coachingThread.map((message, index) => (
                    <p className={`message ${message.role}`} key={`${message.role}-${index}`}>
                      {message.text}
                    </p>
                  ))}
                  {isCoaching ? <p className="message coach pending">Thinking...</p> : null}
                </div>

                {apiError ? <p className="error">{apiError}</p> : null}

                {canReplyToFollowUp ? (
                  <>
                    <label className="answer-label" htmlFor="follow-up-reply">
                      Reply
                    </label>
                    <textarea
                      id="follow-up-reply"
                      className="answer-input follow-up-input"
                      value={followUpReply}
                      onChange={(event) => setFollowUpReply(event.target.value)}
                      onKeyDown={(event) => {
                        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
                          event.preventDefault();
                          void submitFollowUpReply();
                        }
                      }}
                      placeholder="Reply to the coach, or rate when ready."
                      disabled={isCoaching}
                    />
                    <div className="actions">
                      <button
                        className="primary"
                        onClick={submitFollowUpReply}
                        disabled={isCoaching || !followUpReply.trim()}
                      >
                        {isCoaching ? "Sending..." : "Send reply"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p className="hint">Rate when ready.</p>
                )}
              </section>
            )}

          </article>

          {feedback ? (
            <aside className="feedback-panel">
              <div className="truth">
                <h2>Expected answer</h2>
                <SafeHtml html={current.answer} />
                {current.explanation ? <SafeHtml className="explanation" html={current.explanation} /> : null}
              </div>

              <section className="feedback-prose">
                <h2>Feedback</h2>
                <p>{feedback.text}</p>
              </section>

              <div className="rating-heading">
              <h2>Rate recall</h2>
              <span>1-4</span>
            </div>
            <div className="rating-grid">
                <button onClick={() => rateCard("again")}>
                  <span>Again</span>
                  <small>{ratingIntervals?.again}</small>
                  <kbd>1</kbd>
                </button>
                <button onClick={() => rateCard("hard")}>
                  <span>Hard</span>
                  <small>{ratingIntervals?.hard}</small>
                  <kbd>2</kbd>
                </button>
                <button onClick={() => rateCard("good")}>
                  <span>Good</span>
                  <small>{ratingIntervals?.good}</small>
                  <kbd>3</kbd>
                </button>
                <button onClick={() => rateCard("easy")}>
                  <span>Easy</span>
                  <small>{ratingIntervals?.easy}</small>
                  <kbd>4</kbd>
                </button>
              </div>
            </aside>
          ) : null}
        </section>
      )}

      <footer className="footer">
        <button className="text-button" onClick={resetAll}>
          Reset deck
        </button>
      </footer>
    </main>
  );
}

function ThemeToggle({ theme, onToggle }: { theme: Theme; onToggle: () => void }) {
  const nextTheme = theme === "dark" ? "light" : "dark";

  return (
    <button
      className="theme-toggle"
      type="button"
      onClick={onToggle}
      aria-label={`Switch to ${nextTheme} theme`}
      aria-pressed={theme === "dark"}
      title={`Switch to ${nextTheme} theme`}
    >
      <span className={`theme-icon ${theme}`} aria-hidden="true" />
    </button>
  );
}

function SafeHtml({ html, className }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeCardHtml(html) }} />;
}

function ratingForShortcut(key: string): Rating | undefined {
  if (key === "1") return "again";
  if (key === "2") return "hard";
  if (key === "3") return "good";
  if (key === "4") return "easy";
}

function ratingIntervalLabels(card: ReviewCard): Record<Rating, string> {
  return {
    again: "10m",
    hard: formatInterval(nextIntervalDays(card, "hard")),
    good: formatInterval(nextIntervalDays(card, "good")),
    easy: formatInterval(nextIntervalDays(card, "easy"))
  };
}

function formatInterval(days: number): string {
  return days === 1 ? "1d" : `${days}d`;
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;

  const tagName = target.tagName.toLowerCase();
  return tagName === "input" || tagName === "textarea" || target.isContentEditable;
}

