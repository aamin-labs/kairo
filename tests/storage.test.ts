import assert from "node:assert/strict";
import test from "node:test";
import { createBrowserDeckStore } from "../lib/storage.ts";
import type { ReviewCard } from "../lib/types.ts";

test("deck store loads empty deck when storage is empty or corrupt", () => {
  const storage = memoryStorage();
  const store = createBrowserDeckStore(storage);

  assert.deepEqual(store.load(), []);

  storage.setItem("kairo.reviewDeck.v1", "not json");
  assert.deepEqual(store.load(), []);
});

test("deck store saves, loads, and clears cards through the storage key", () => {
  const storage = memoryStorage();
  const store = createBrowserDeckStore(storage);
  const cards = [card({ id: "target", suspended: true })];

  store.save(cards);
  assert.deepEqual(store.load(), cards);

  store.clear();
  assert.deepEqual(store.load(), []);
});

function memoryStorage() {
  const values = new Map<string, string>();

  return {
    getItem(key: string) {
      return values.get(key) ?? null;
    },
    setItem(key: string, value: string) {
      values.set(key, value);
    },
    removeItem(key: string) {
      values.delete(key);
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
