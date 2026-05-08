"use client";

import { useEffect, useMemo, useState } from "react";
import { sanitizeCardHtml } from "@/lib/card-html";
import { importReviewDeck } from "@/lib/card-import";
import { getReviewSnapshot, recordReviewAttempt } from "@/lib/review-session";
import { clearDeck, loadDeck, saveDeck } from "@/lib/storage";
import type {
  CoachingMessage,
  CoachingResponse,
  Feedback,
  Hint,
  Rating,
  ReviewCard,
  ReviewMemoryProposal
} from "@/lib/types";

const SAMPLE_CSV = `Question,Answer,Context,Explanation
"When should you use **Good** instead of **Easy**?","Use **Good** when recall was solid but not automatic.","SRS","Easy should be reserved for cold, fluent retrieval."
"What goes wrong if the LLM auto-rates every answer?","Learner loses judgment; weak calibration hides behind automation.","Review","The model can critique, but the learner owns memory confidence."`;
const THEME_KEY = "kairo.theme";
const MAX_FOLLOW_UP_REPLIES = 4;
type Theme = "light" | "dark";

export default function Home() {
  const [cards, setCards] = useState<ReviewCard[]>([]);
  const [csvText, setCsvText] = useState("");
  const [importError, setImportError] = useState("");
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [proposedReviewMemory, setProposedReviewMemory] = useState<ReviewMemoryProposal | null | undefined>();
  const [coachingThread, setCoachingThread] = useState<CoachingMessage[]>([]);
  const [followUpReply, setFollowUpReply] = useState("");
  const [hasOpenFollowUpPrompt, setHasOpenFollowUpPrompt] = useState(false);
  const [hint, setHint] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isCoaching, setIsCoaching] = useState(false);
  const [isHinting, setIsHinting] = useState(false);
  const [apiError, setApiError] = useState("");
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    setCards(loadDeck());
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    if (savedTheme === "dark") setTheme("dark");
  }, []);

  useEffect(() => {
    if (cards.length > 0) saveDeck(cards);
  }, [cards]);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  const snapshot = useMemo(() => getReviewSnapshot(cards), [cards]);
  const current = snapshot.current;
  const followUpReplyCount = coachingThread.filter((message) => message.role === "learner").length - 1;
  const canReplyToFollowUp = hasOpenFollowUpPrompt && followUpReplyCount < MAX_FOLLOW_UP_REPLIES;

  function importCards() {
    try {
      setCards(importReviewDeck(csvText));
      setImportError("");
      resetReviewState();
    } catch (error) {
      setImportError(error instanceof Error ? error.message : "Import failed.");
    }
  }

  async function requestHint() {
    if (!current) return;
    setIsHinting(true);
    setApiError("");

    try {
      const body = await postJson<Hint>("/api/hint", { card: cardPayload(current) });
      setHint(body.hint);
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
      const body = await postJson<Feedback>("/api/feedback", {
        card: cardPayload(current),
        learnerAnswer: answer,
        reviewMemory: current.reviewMemory
      });
      setFeedback(body);
      setProposedReviewMemory(body.reviewMemory);
      setCoachingThread([
        { role: "learner", text: answer },
        ...(body.followUpPrompt ? [{ role: "coach" as const, text: body.followUpPrompt }] : [])
      ]);
      setHasOpenFollowUpPrompt(Boolean(body.followUpPrompt));
    } catch (error) {
      setApiError(error instanceof Error ? error.message : "Feedback failed.");
    } finally {
      setIsSubmitting(false);
    }
  }

  async function submitFollowUpReply() {
    if (!current || !feedback || !followUpReply.trim() || followUpReplyCount >= MAX_FOLLOW_UP_REPLIES) return;

    const learnerMessage: CoachingMessage = { role: "learner", text: followUpReply };
    const nextThread = [...coachingThread, learnerMessage];
    setCoachingThread(nextThread);
    setFollowUpReply("");
    setHasOpenFollowUpPrompt(false);
    setIsCoaching(true);
    setApiError("");

    try {
      const body = await postJson<CoachingResponse>("/api/coaching", {
        card: cardPayload(current),
        learnerAnswer: answer,
        feedback,
        thread: nextThread,
        reviewMemory: current.reviewMemory,
        proposedReviewMemory
      });
      if ("reviewMemory" in body) setProposedReviewMemory(body.reviewMemory);
      setCoachingThread((existing) => [
        ...existing,
        { role: "coach", text: body.followUpPrompt ? `${body.text}\n\n${body.followUpPrompt}` : body.text }
      ]);
      setHasOpenFollowUpPrompt(Boolean(body.followUpPrompt));
    } catch (error) {
      setCoachingThread(coachingThread);
      setFollowUpReply(learnerMessage.text);
      setHasOpenFollowUpPrompt(true);
      setApiError(error instanceof Error ? error.message : "Coaching failed.");
    } finally {
      setIsCoaching(false);
    }
  }

  function rateCard(rating: Rating) {
    if (!current || !feedback) return;

    setCards((existing) =>
      recordReviewAttempt(existing, {
        cardId: current.id,
        answer,
        feedback,
        coachingThread,
        rating,
        reviewMemory: proposedReviewMemory
      })
    );
    resetReviewState();
  }

  function resetAll() {
    clearDeck();
    setCards([]);
    setCsvText("");
    setImportError("");
    resetReviewState();
  }

  function resetReviewState() {
    setAnswer("");
    setFeedback(null);
    setProposedReviewMemory(undefined);
    setCoachingThread([]);
    setFollowUpReply("");
    setHasOpenFollowUpPrompt(false);
    setHint("");
    setApiError("");
  }

  function toggleTheme() {
    setTheme((currentTheme) => (currentTheme === "dark" ? "light" : "dark"));
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
          <h1>Review queue</h1>
        </div>
        <div className="stats" aria-label="Deck stats">
          <span>{snapshot.dueCount} due</span>
          <span>{snapshot.newCount} new</span>
          <span>{snapshot.totalCount} total</span>
        </div>
      </header>

      {!current ? (
        <section className="empty-state">
          <h2>Nothing due.</h2>
          <p className="subtle">New cards are capped at 20 per day. Come back when reviews mature.</p>
          <button className="secondary" onClick={resetAll}>
            Reset deck
          </button>
        </section>
      ) : (
        <section className="review-layout">
          <article className="review-card">
            <div className="card-meta">
              <span>{current.context || "Card"}</span>
              <span>{current.seen ? `Interval ${current.intervalDays}d` : "New"}</span>
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
                  onChange={(event) => setAnswer(event.target.value)}
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

          <aside className="feedback-panel">
            {!feedback ? (
              <div className="quiet">
                <h2>Feedback appears here.</h2>
                <p>Answer first. Hint only when stuck.</p>
              </div>
            ) : (
              <>
                <div className="truth">
                  <h2>Expected answer</h2>
                  <SafeHtml html={current.answer} />
                  {current.explanation ? <SafeHtml className="explanation" html={current.explanation} /> : null}
                </div>

                <section className="feedback-prose">
                  <h2>Feedback</h2>
                  <p>{feedback.text}</p>
                </section>

                <div className="rating-grid">
                  <button onClick={() => rateCard("again")}>Again</button>
                  <button onClick={() => rateCard("hard")}>Hard</button>
                  <button onClick={() => rateCard("good")}>Good</button>
                  <button onClick={() => rateCard("easy")}>Easy</button>
                </div>
              </>
            )}
          </aside>
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
  return (
    <button className="theme-toggle" type="button" onClick={onToggle} aria-pressed={theme === "dark"}>
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}

function SafeHtml({ html, className }: { html: string; className?: string }) {
  return <div className={className} dangerouslySetInnerHTML={{ __html: sanitizeCardHtml(html) }} />;
}

function cardPayload(card: ReviewCard) {
  return {
    question: card.question,
    answer: card.answer,
    context: card.context,
    explanation: card.explanation
  };
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = (await response.json()) as T | { error?: string };

  if (!response.ok) {
    const error = typeof body === "object" && body && "error" in body ? body.error : undefined;
    throw new Error(error || "Request failed.");
  }

  return body as T;
}
