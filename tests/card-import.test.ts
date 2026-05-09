import assert from "node:assert/strict";
import test from "node:test";
import { appendReviewDeck, importReviewDeck } from "../lib/card-import.ts";
import type { ReviewCard } from "../lib/types.ts";

test("imports CSV into new review cards", () => {
  const cards = importReviewDeck(
    `Question,Answer,Context,Explanation
"Q1","A1","RAG","E1"
"Q2","A2","SRS","E2"`,
    new Date("2026-05-08T08:00:00.000Z")
  );

  assert.deepEqual(
    cards.map((card) => ({
      id: card.id,
      question: card.question,
      seen: card.seen,
      dueAt: card.dueAt
    })),
    [
      { id: "card_20260508080000000_0", question: "Q1", seen: false, dueAt: "2026-05-08T08:00:00.000Z" },
      { id: "card_20260508080000000_1", question: "Q2", seen: false, dueAt: "2026-05-08T08:00:00.000Z" }
    ]
  );
});

test("imports quoted CSV fields with commas and newlines", () => {
  const cards = importReviewDeck(
    `"Question","Answer","Context","Explanation"
"Why?","Because, mostly","RAG","Line one
Line two"`,
    new Date("2026-05-08T08:00:00.000Z")
  );

  assert.equal(cards[0].answer, "Because, mostly");
  assert.equal(cards[0].explanation, "Line one\nLine two");
});

test("rejects CSV without required Anki columns", () => {
  assert.throws(() => importReviewDeck("Question,Answer\nQ,A"), /Missing required columns/);
});

test("appends new cards without changing existing review progress", () => {
  const existing = [
    reviewCard({
      id: "existing",
      question: "Q1",
      answer: "A1",
      seen: true,
      intervalDays: 5,
      dueAt: "2026-05-13T08:00:00.000Z"
    })
  ];

  const result = appendReviewDeck(
    existing,
    `Question,Answer,Context,Explanation
"Q2","A2","SRS","E2"`,
    new Date("2026-05-08T08:00:00.000Z")
  );

  assert.equal(result.addedCount, 1);
  assert.equal(result.skippedDuplicateCount, 0);
  assert.equal(result.cards[0], existing[0]);
  assert.deepEqual(
    result.cards.map((card) => ({ id: card.id, question: card.question, seen: card.seen, dueAt: card.dueAt })),
    [
      { id: "existing", question: "Q1", seen: true, dueAt: "2026-05-13T08:00:00.000Z" },
      { id: "card_20260508080000000_0", question: "Q2", seen: false, dueAt: "2026-05-08T08:00:00.000Z" }
    ]
  );
});

test("append skips normalized duplicates from existing deck and same CSV", () => {
  const existing = [reviewCard({ question: " What is SRS? ", answer: "Spaced repetition" })];

  const result = appendReviewDeck(
    existing,
    `Question,Answer,Context,Explanation
"what   is srs?","SPACED REPETITION","SRS","Duplicate existing"
"Q2","A2","SRS","First new"
" q2 "," a2 ","SRS","Duplicate same import"`,
    new Date("2026-05-08T08:00:00.000Z")
  );

  assert.equal(result.addedCount, 1);
  assert.equal(result.skippedDuplicateCount, 2);
  assert.equal(result.cards.length, 2);
  assert.equal(result.cards[1].question, "Q2");
});

function reviewCard(overrides: Partial<ReviewCard> = {}): ReviewCard {
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
