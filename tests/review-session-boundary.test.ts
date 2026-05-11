import assert from "node:assert/strict";
import test from "node:test";
import { ReviewSession, type CoachClient, type DeckStore } from "../lib/review-session.ts";
import type { CoachingResponse, Feedback, Hint, ReviewCard } from "../lib/types.ts";

const now = new Date("2026-05-08T08:00:00.000Z");

test("review session owns answer, coaching, rating, scheduling, memory, and persistence", async () => {
  const store = inMemoryStore([card({ id: "target", seen: false })]);
  const coach = scriptedCoach({
    feedback: {
      text: "Mostly right; name the trigger.",
      followUpPrompt: "What starts the next review?",
      reviewMemory: { learningEdge: "Name the schedule trigger.", evidence: "Answer was vague." }
    },
    coaching: {
      text: "Yes. The rating schedules the next review.",
      reviewMemory: { learningEdge: "Connect rating to scheduling.", evidence: "Follow-up clarified trigger." }
    },
    hint: { hint: "Think of the learner action after feedback." }
  });
  const session = new ReviewSession(store, coach);

  session.load();
  await session.requestHint(now);
  await session.submitAnswer("The learner chooses Good.", now);
  assert.deepEqual(session.getState().active.coachingThread, [
    { role: "learner", text: "The learner chooses Good." },
    { role: "coach", text: "Mostly right; name the trigger.\n\nWhat starts the next review?" }
  ]);
  await session.submitFollowUpReply("The learner rating.", now);
  const state = session.rateCurrentCard("good", now);

  const reviewed = state.cards[0];
  assert.equal(reviewed.seen, true);
  assert.equal(reviewed.intervalDays, 3);
  assert.equal(reviewed.dueAt, "2026-05-11T08:00:00.000Z");
  assert.equal(reviewed.lastAttempt?.answer, "The learner chooses Good.");
  assert.deepEqual(reviewed.reviewMemory, {
    learningEdge: "Connect rating to scheduling.",
    evidence: "Follow-up clarified trigger.",
    updatedAt: "2026-05-08T08:00:00.000Z"
  });
  assert.equal(state.active.feedback, null);
  assert.deepEqual(store.saved.at(-1), state.cards);
});

test("append import preserves existing progress behind the session boundary", () => {
  const existing = card({ id: "existing", question: "Q1", answer: "A1", seen: true, intervalDays: 5 });
  const store = inMemoryStore([existing]);
  const session = new ReviewSession(store, scriptedCoach({}));
  session.load();

  const result = session.appendDeck(
    `Question,Answer,Context,Explanation
" q1 "," a1 ","SRS","Duplicate"
"Q2","A2","SRS","New"`,
    now
  );

  assert.equal(result.addedCount, 1);
  assert.equal(result.skippedDuplicateCount, 1);
  assert.equal(result.state.cards[0], existing);
  assert.equal(result.state.cards[1].question, "Q2");
  assert.deepEqual(store.saved.at(-1), result.state.cards);
});

function inMemoryStore(cards: ReviewCard[]): DeckStore & { saved: ReviewCard[][] } {
  const saved: ReviewCard[][] = [];
  let current = cards;

  return {
    saved,
    load: () => current,
    save: (next) => {
      current = next;
      saved.push(next);
    },
    clear: () => {
      current = [];
    }
  };
}

function scriptedCoach(overrides: Partial<{ feedback: Feedback; coaching: CoachingResponse; hint: Hint }>): CoachClient {
  return {
    async requestHint() {
      return overrides.hint ?? { hint: "Hint." };
    },
    async requestFeedback() {
      return overrides.feedback ?? { text: "Feedback." };
    },
    async requestCoaching() {
      return overrides.coaching ?? { text: "Coaching." };
    }
  };
}

function card(overrides: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: "card",
    question: "Q",
    answer: "A",
    context: "SRS",
    explanation: "E",
    intervalDays: 0,
    dueAt: "2026-05-08T08:00:00.000Z",
    seen: false,
    ...overrides
  };
}
