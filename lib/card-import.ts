import { parseCardsCsv } from "./csv.ts";
import type { ImportedCard, ReviewCard } from "./types.ts";

export function importReviewDeck(csvText: string, now = new Date()): ReviewCard[] {
  return toReviewCards(parseCardsCsv(csvText), now);
}

export function toReviewCards(cards: ImportedCard[], now = new Date()): ReviewCard[] {
  const dueAt = now.toISOString();

  return cards.map((card, index) => ({
    ...card,
    id: `card_${index}`,
    intervalDays: 0,
    dueAt,
    seen: false
  }));
}
