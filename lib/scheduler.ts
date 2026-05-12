import type { Rating, ReviewCard } from "./types";

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

export function applyRating(card: ReviewCard, rating: Rating, now = new Date()): ReviewCard {
  const currentInterval = Math.max(card.intervalDays, 0);
  const nextInterval = nextIntervalDays(card, rating);
  const dueAt =
    rating === "again"
      ? new Date(now.getTime() + 10 * MINUTE)
      : new Date(now.getTime() + nextInterval * DAY);

  return {
    ...card,
    intervalDays: rating === "again" ? currentInterval : nextInterval,
    dueAt: dueAt.toISOString(),
    seen: true
  };
}

export function nextIntervalDays(card: ReviewCard, rating: Rating): number {
  const interval = Math.max(card.intervalDays, 0);

  if (rating === "again") return interval;
  if (rating === "hard") return 1;
  if (!card.seen && rating === "good") return 3;
  if (!card.seen && rating === "easy") return 7;
  if (rating === "good") return Math.max(1, interval * 2);
  return Math.max(1, interval * 3);
}

export function dueCards(cards: ReviewCard[], now = new Date()): ReviewCard[] {
  return cards
    .filter((card) => isReviewable(card, now) && card.seen && new Date(card.dueAt).getTime() <= now.getTime())
    .sort((a, b) => new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime());
}

export function newCards(cards: ReviewCard[], now = new Date(), limit = 20): ReviewCard[] {
  return cards.filter((card) => isReviewable(card, now) && !card.seen).slice(0, limit);
}

export function reviewQueue(cards: ReviewCard[], now = new Date(), newLimit = 20): ReviewCard[] {
  return [...dueCards(cards, now), ...newCards(cards, now, newLimit)];
}

export function isBuried(card: ReviewCard, now = new Date()): boolean {
  return Boolean(card.buriedUntil && new Date(card.buriedUntil).getTime() > now.getTime());
}

export function isReviewable(card: ReviewCard, now = new Date()): boolean {
  return !card.suspended && !isBuried(card, now);
}
