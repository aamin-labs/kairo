import assert from "node:assert/strict";
import test from "node:test";
import { getReviewSnapshot, recordReviewAttempt, ReviewSession } from "../lib/review-session.ts";
import type { Feedback, ReviewCard } from "../lib/types.ts";

const now = new Date("2026-05-08T08:00:00.000Z");
const feedback: Feedback = {
  text: "Good enough. Core idea present, but name the mechanism more precisely.",
  followUpPrompt: "What mechanism makes this work?"
};
const coachingThread = [
  { role: "learner" as const, text: "my answer" },
  { role: "coach" as const, text: "Good enough. Core idea present, but name the mechanism more precisely.\n\nWhat mechanism makes this work?" },
  { role: "learner" as const, text: "Spaced retrieval." },
  { role: "coach" as const, text: "Correct. Name the schedule trigger next." }
];

test("snapshot exposes current card and queue counts", () => {
  const snapshot = getReviewSnapshot(
    [
      card({ id: "due", seen: true, dueAt: "2026-05-07T08:00:00.000Z" }),
      card({ id: "new", seen: false }),
      card({ id: "buried", seen: false, buriedUntil: "2026-05-09T00:00:00.000Z" }),
      card({ id: "suspended", seen: false, suspended: true })
    ],
    now
  );

  assert.equal(snapshot.current?.id, "due");
  assert.equal(snapshot.dueCount, 1);
  assert.equal(snapshot.newCount, 1);
  assert.equal(snapshot.buriedCount, 1);
  assert.equal(snapshot.totalCount, 4);
});

test("suspending a card preserves due date and removes it from review until restored", () => {
  const session = new ReviewSession(store([card({ id: "target", seen: true, dueAt: "2026-05-07T08:00:00.000Z" })]), coach());
  session.load();

  let state = session.toggleCardSuspension("target");

  assert.equal(state.cards[0].suspended, true);
  assert.equal(state.cards[0].dueAt, "2026-05-07T08:00:00.000Z");
  assert.equal(session.getSnapshot(now).current, undefined);

  state = session.toggleCardSuspension("target");

  assert.equal(state.cards[0].suspended, undefined);
  assert.equal(session.getSnapshot(now).current?.id, "target");
});

test("deleting a card permanently removes it from the deck", () => {
  const session = new ReviewSession(store([card({ id: "target" }), card({ id: "other" })]), coach());
  session.load();

  const state = session.deleteCard("target");

  assert.deepEqual(state.cards.map((item) => item.id), ["other"]);
  assert.deepEqual(session.getSnapshot(now).queue.map((item) => item.id), ["other"]);
});

test("recording Good saves attempt and schedules a new card three days out", () => {
  const cards = [card({ id: "target", seen: false })];
  const reviewed = recordReviewAttempt(
    cards,
    {
      cardId: "target",
      answer: "my answer",
      feedback,
      coachingThread,
      rating: "good"
    },
    now
  )[0];

  assert.equal(reviewed.seen, true);
  assert.equal(reviewed.intervalDays, 3);
  assert.equal(reviewed.dueAt, "2026-05-11T08:00:00.000Z");
  assert.deepEqual(reviewed.lastAttempt, {
    answer: "my answer",
    feedback,
    coachingThread,
    rating: "good",
    reviewedAt: "2026-05-08T08:00:00.000Z"
  });
});

test("recording a rating saves proposed review memory with the review time", () => {
  const reviewed = recordReviewAttempt(
    [card({ id: "target", seen: false })],
    {
      cardId: "target",
      answer: "my answer",
      feedback,
      coachingThread,
      rating: "good",
      reviewMemory: {
        learningEdge: "Distinguish solid recall from automatic recall.",
        evidence: "Learner knew Good but was fuzzy about Easy."
      }
    },
    now
  )[0];

  assert.deepEqual(reviewed.reviewMemory, {
    learningEdge: "Distinguish solid recall from automatic recall.",
    evidence: "Learner knew Good but was fuzzy about Easy.",
    updatedAt: "2026-05-08T08:00:00.000Z"
  });
});

test("recording a null review memory clears the previous learning edge", () => {
  const reviewed = recordReviewAttempt(
    [
      card({
        id: "target",
        seen: true,
        reviewMemory: {
          learningEdge: "Name the scheduling trigger.",
          evidence: "Learner gave a vague mechanism.",
          updatedAt: "2026-05-07T08:00:00.000Z"
        }
      })
    ],
    {
      cardId: "target",
      answer: "clear answer",
      feedback,
      coachingThread: [],
      rating: "easy",
      reviewMemory: null
    },
    now
  )[0];

  assert.equal(reviewed.reviewMemory, undefined);
});

test("recording Again returns card in ten minutes without changing interval", () => {
  const reviewed = recordReviewAttempt(
    [card({ id: "target", seen: true, intervalDays: 5 })],
    {
      cardId: "target",
      answer: "missed",
      feedback,
      coachingThread: [],
      rating: "again"
    },
    now
  )[0];

  assert.equal(reviewed.intervalDays, 5);
  assert.equal(reviewed.dueAt, "2026-05-08T08:10:00.000Z");
});

test("burying hides a card until the next day and unbury restores it", () => {
  const session = new ReviewSession(store([card({ id: "target", seen: false })]), coach());
  session.load();

  let state = session.buryCurrentCard(now);
  assert.equal(state.cards[0].buriedUntil, "2026-05-09T00:00:00.000Z");
  assert.equal(session.getSnapshot(now).current, undefined);

  state = session.unburyAll();
  assert.equal(state.cards[0].buriedUntil, undefined);
  assert.equal(session.getSnapshot(now).current?.id, "target");
});

test("burying a note hides sibling cards together", () => {
  const session = new ReviewSession(
    store([
      card({ id: "front", noteId: "note-1" }),
      card({ id: "back", noteId: "note-1" }),
      card({ id: "other", noteId: "note-2" })
    ]),
    coach()
  );
  session.load();

  const state = session.buryCurrentNote(now);

  assert.deepEqual(
    state.cards.map((item) => [item.id, item.buriedUntil]),
    [
      ["front", "2026-05-09T00:00:00.000Z"],
      ["back", "2026-05-09T00:00:00.000Z"],
      ["other", undefined]
    ]
  );
  assert.equal(session.getSnapshot(now).current?.id, "other");
});

test("rating a note card automatically buries siblings", async () => {
  const session = new ReviewSession(
    store([
      card({ id: "front", noteId: "note-1" }),
      card({ id: "back", noteId: "note-1" })
    ]),
    coach()
  );
  session.load();
  await session.submitAnswer("answer", now);

  const state = session.rateCurrentCard("good", now);

  assert.equal(state.cards[0].buriedUntil, undefined);
  assert.equal(state.cards[1].buriedUntil, "2026-05-09T00:00:00.000Z");
});

test("snapshot queues due cards before capped new cards", () => {
  const snapshot = getReviewSnapshot(
    [
      card({ id: "future", seen: true, dueAt: "2026-05-09T08:00:00.000Z" }),
      card({ id: "due", seen: true, dueAt: "2026-05-07T08:00:00.000Z" }),
      card({ id: "new-a", seen: false }),
      card({ id: "new-b", seen: false })
    ],
    now
  );

  assert.deepEqual(
    snapshot.queue.map((item) => item.id),
    ["due", "new-a", "new-b"]
  );
});

function store(cards: ReviewCard[]) {
  return {
    load: () => cards,
    save: (next: ReviewCard[]) => {
      cards = next;
    },
    clear: () => {
      cards = [];
    }
  };
}

function coach() {
  return {
    async requestHint() {
      return { hint: "Hint." };
    },
    async requestFeedback() {
      return feedback;
    },
    async requestCoaching() {
      return { text: "Coaching." };
    }
  };
}

function card(overrides: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: "card",
    question: "Q",
    answer: "A",
    context: "T",
    explanation: "",
    intervalDays: 0,
    dueAt: "2026-05-08T08:00:00.000Z",
    seen: false,
    ...overrides
  };
}
