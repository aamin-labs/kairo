import assert from "node:assert/strict";
import test from "node:test";
import { importReviewDeck } from "../lib/card-import.ts";

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
      { id: "card_0", question: "Q1", seen: false, dueAt: "2026-05-08T08:00:00.000Z" },
      { id: "card_1", question: "Q2", seen: false, dueAt: "2026-05-08T08:00:00.000Z" }
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
