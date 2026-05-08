import { applyRating, reviewQueue } from "./scheduler.ts";
import type { CoachingMessage, Feedback, Rating, ReviewCard, ReviewMemoryProposal } from "./types.ts";

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
  coachingThread: CoachingMessage[];
  rating: Rating;
  reviewMemory?: ReviewMemoryProposal | null;
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

    const reviewedCard = {
      ...applyRating(card, attempt.rating, now),
      lastAttempt: {
        answer: attempt.answer,
        feedback: attempt.feedback,
        coachingThread: attempt.coachingThread,
        rating: attempt.rating,
        reviewedAt: now.toISOString()
      }
    };

    if (attempt.reviewMemory === undefined) {
      return reviewedCard;
    }

    if (attempt.reviewMemory === null) {
      const cardWithoutMemory = { ...reviewedCard };
      delete cardWithoutMemory.reviewMemory;
      return cardWithoutMemory;
    }

    return {
      ...reviewedCard,
      reviewMemory: {
        ...attempt.reviewMemory,
        updatedAt: now.toISOString()
      }
    };
  });
}
