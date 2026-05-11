import { parseCardsCsv } from "./csv.ts";
import type { ImportedCard, ReviewCard } from "./types.ts";

export type AppendImportResult = {
  cards: ReviewCard[];
  addedCount: number;
  skippedDuplicateCount: number;
};

export function importReviewDeck(csvText: string, now = new Date()): ReviewCard[] {
  return toReviewCards(parseCardsCsv(csvText), now);
}

export function appendReviewDeck(existingCards: ReviewCard[], csvText: string, now = new Date()): AppendImportResult {
  const existingKeys = new Set(existingCards.map(cardKey));
  const importedCards = parseCardsCsv(csvText);
  const newCards: ImportedCard[] = [];
  let skippedDuplicateCount = 0;

  for (const card of importedCards) {
    const key = cardKey(card);
    if (existingKeys.has(key)) {
      skippedDuplicateCount += 1;
      continue;
    }

    existingKeys.add(key);
    newCards.push(card);
  }

  const addedCards = toReviewCards(newCards, now);

  return {
    cards: [...existingCards, ...addedCards],
    addedCount: addedCards.length,
    skippedDuplicateCount
  };
}

export function toReviewCards(cards: ImportedCard[], now = new Date()): ReviewCard[] {
  const dueAt = now.toISOString();

  return cards.map((card) => ({
    ...card,
    id: crypto.randomUUID(),
    intervalDays: 0,
    dueAt,
    seen: false
  }));
}

function cardKey(card: Pick<ImportedCard, "question" | "answer">): string {
  return `${normalizeCardText(card.question)}\n${normalizeCardText(card.answer)}`;
}

function normalizeCardText(text: string): string {
  return text.trim().replace(/\s+/g, " ").toLowerCase();
}
