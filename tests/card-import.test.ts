import assert from "node:assert/strict";
import test from "node:test";
import { appendReviewDeck, importReviewDeck } from "../lib/card-import.ts";
import type { ReviewCard } from "../lib/types.ts";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

test("imports CSV into new review cards", () => {
  const cards = importReviewDeck(
    `Question,Answer,Context,Explanation
"Q1","A1","RAG","E1"
"Q2","A2","SRS","E2"`,
    new Date("2026-05-08T08:00:00.000Z")
  );

  assert.equal(new Set(cards.map((card) => card.id)).size, 2);
  assert.match(cards[0].id, UUID_PATTERN);
  assert.deepEqual(
    cards.map((card) => ({
      question: card.question,
      seen: card.seen,
      dueAt: card.dueAt
    })),
    [
      { question: "Q1", seen: false, dueAt: "2026-05-08T08:00:00.000Z" },
      { question: "Q2", seen: false, dueAt: "2026-05-08T08:00:00.000Z" }
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

test("imports optional note ids for sibling cards", () => {
  const cards = importReviewDeck(
    `Note ID,Question,Answer,Context,Explanation
"note-1","Q1","A1","RAG","E1"
"note-1","Q2","A2","RAG","E2"`,
    new Date("2026-05-08T08:00:00.000Z")
  );

  assert.deepEqual(cards.map((card) => card.noteId), ["note-1", "note-1"]);
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
  assert.match(result.cards[1].id, UUID_PATTERN);
  assert.deepEqual(
    result.cards.map((card) => ({ question: card.question, seen: card.seen, dueAt: card.dueAt })),
    [
      { question: "Q1", seen: true, dueAt: "2026-05-13T08:00:00.000Z" },
      { question: "Q2", seen: false, dueAt: "2026-05-08T08:00:00.000Z" }
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

test("append gives new cards unique ids", () => {
  const existing = [reviewCard({ id: "existing", question: "Q1", answer: "A1" })];

  const result = appendReviewDeck(
    existing,
    `Question,Answer,Context,Explanation
"Q2","A2","SRS","E2"
"Q3","A3","SRS","E3"`,
    new Date("2026-05-08T08:00:00.000Z")
  );

  assert.equal(new Set(result.cards.map((card) => card.id)).size, 3);
  assert.equal(result.cards[0].id, "existing");
  assert.match(result.cards[1].id, UUID_PATTERN);
  assert.match(result.cards[2].id, UUID_PATTERN);
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
