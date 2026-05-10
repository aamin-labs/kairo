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

  const addedCards = toReviewCards(newCards, now, nextCardIdPrefix(existingCards, newCards.length, now));

  return {
    cards: [...existingCards, ...addedCards],
    addedCount: addedCards.length,
    skippedDuplicateCount
  };
}

export function toReviewCards(cards: ImportedCard[], now = new Date(), idPrefix = cardIdPrefix(now)): ReviewCard[] {
  const dueAt = now.toISOString();

  return cards.map((card, index) => ({
    ...card,
    id: `${idPrefix}_${index}`,
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

function cardIdPrefix(now: Date): string {
  return `card_${now.toISOString().replace(/\D/g, "").slice(0, 17)}`;
}

function nextCardIdPrefix(existingCards: ReviewCard[], cardCount: number, now: Date): string {
  const existingIds = new Set(existingCards.map((card) => card.id));
  const basePrefix = cardIdPrefix(now);

  if (cardCount === 0) return `${basePrefix}_0`;

  for (let suffix = 0; ; suffix += 1) {
    const idPrefix = `${basePrefix}_${suffix}`;

    for (let index = 0; index < cardCount; index += 1) {
      if (existingIds.has(`${idPrefix}_${index}`)) break;
      if (index === cardCount - 1) return idPrefix;
    }
  }
}
