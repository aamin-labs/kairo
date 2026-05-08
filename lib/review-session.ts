import { applyRating, reviewQueue } from "./scheduler.ts";
import type { Feedback, Rating, ReviewCard } from "./types.ts";

export type ReviewSnapshot = {
  queue: ReviewCard[];
  current?: ReviewCard;
  dueCount: number;
  newCount: number;
  totalCount: number;
};

export type ReviewAttempt = {
  cardId: string;
  answer: string;
  feedback: Feedback;
  rating: Rating;
};

export function getReviewSnapshot(cards: ReviewCard[], now = new Date()): ReviewSnapshot {
  const queue = reviewQueue(cards, now);

  return {
    queue,
    current: queue[0],
    dueCount: cards.filter((card) => card.seen && new Date(card.dueAt) <= now).length,
    newCount: cards.filter((card) => !card.seen).length,
    totalCount: cards.length
  };
}

export function recordReviewAttempt(
  cards: ReviewCard[],
  attempt: ReviewAttempt,
  now = new Date()
): ReviewCard[] {
  return cards.map((card) => {
    if (card.id !== attempt.cardId) return card;

    return {
      ...applyRating(card, attempt.rating, now),
      lastAttempt: {
        answer: attempt.answer,
        feedback: attempt.feedback,
        rating: attempt.rating,
        reviewedAt: now.toISOString()
      }
    };
  });
}
