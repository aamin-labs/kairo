import assert from "node:assert/strict";
import test from "node:test";
import { getReviewSnapshot, recordReviewAttempt } from "../lib/review-session.ts";
import type { Feedback, ReviewCard } from "../lib/types.ts";

const now = new Date("2026-05-08T08:00:00.000Z");
const feedback: Feedback = {
  verdict: "Good enough.",
  whatWorked: "Core idea present.",
  missingOrFuzzy: "Needs mechanism.",
  precisionUpgrade: "Name the tradeoff.",
  followUpQuestion: ""
};

test("snapshot exposes current card and queue counts", () => {
  const snapshot = getReviewSnapshot(
    [
      card({ id: "due", seen: true, dueAt: "2026-05-07T08:00:00.000Z" }),
      card({ id: "new", seen: false })
    ],
    now
  );

  assert.equal(snapshot.current?.id, "due");
  assert.equal(snapshot.dueCount, 1);
  assert.equal(snapshot.newCount, 1);
  assert.equal(snapshot.totalCount, 2);
});

test("recording Good saves attempt and schedules a new card three days out", () => {
  const cards = [card({ id: "target", seen: false })];
  const reviewed = recordReviewAttempt(
    cards,
    {
      cardId: "target",
      answer: "my answer",
      feedback,
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
    rating: "good",
    reviewedAt: "2026-05-08T08:00:00.000Z"
  });
});

test("recording Again returns card in ten minutes without changing interval", () => {
  const reviewed = recordReviewAttempt(
    [card({ id: "target", seen: true, intervalDays: 5 })],
    {
      cardId: "target",
      answer: "missed",
      feedback,
      rating: "again"
    },
    now
  )[0];

  assert.equal(reviewed.intervalDays, 5);
  assert.equal(reviewed.dueAt, "2026-05-08T08:10:00.000Z");
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
