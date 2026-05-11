import { appendReviewDeck, importReviewDeck } from "./card-import.ts";
import { applyRating, reviewQueue } from "./scheduler.ts";
import type {
  CoachingMessage,
  CoachingResponse,
  Feedback,
  Hint,
  ImportedCard,
  Rating,
  ReviewCard,
  ReviewMemory,
  ReviewMemoryProposal
} from "./types.ts";

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

export type DeckStore = {
  load(): ReviewCard[];
  save(cards: ReviewCard[]): void;
  clear(): void;
};

export type CoachClient = {
  requestHint(card: ImportedCard): Promise<Hint>;
  requestFeedback(card: ImportedCard, learnerAnswer: string, reviewMemory?: ReviewMemory): Promise<Feedback>;
  requestCoaching(
    card: ImportedCard,
    learnerAnswer: string,
    feedback: Feedback,
    thread: CoachingMessage[],
    reviewMemory?: ReviewMemory,
    proposedReviewMemory?: ReviewMemoryProposal | null
  ): Promise<CoachingResponse>;
};

export type ActiveReview = {
  answer: string;
  feedback: Feedback | null;
  proposedReviewMemory?: ReviewMemoryProposal | null;
  coachingThread: CoachingMessage[];
  hasOpenFollowUpPrompt: boolean;
  hint: string;
};

export type ReviewSessionState = {
  cards: ReviewCard[];
  active: ActiveReview;
  sessionReviewedCount: number;
};

const EMPTY_ACTIVE_REVIEW: ActiveReview = {
  answer: "",
  feedback: null,
  proposedReviewMemory: undefined,
  coachingThread: [],
  hasOpenFollowUpPrompt: false,
  hint: ""
};

export class ReviewSession {
  private readonly deckStore: DeckStore;
  private readonly coachClient: CoachClient;
  private state: ReviewSessionState;

  constructor(deckStore: DeckStore, coachClient: CoachClient, initialState?: Partial<ReviewSessionState>) {
    this.deckStore = deckStore;
    this.coachClient = coachClient;
    this.state = {
      cards: initialState?.cards ?? [],
      active: { ...EMPTY_ACTIVE_REVIEW, ...initialState?.active },
      sessionReviewedCount: initialState?.sessionReviewedCount ?? 0
    };
  }

  load(): ReviewSessionState {
    this.state = { ...this.state, cards: this.deckStore.load() };
    return this.getState();
  }

  getState(): ReviewSessionState {
    return cloneSessionState(this.state);
  }

  getSnapshot(now = new Date()): ReviewSnapshot {
    return getReviewSnapshot(this.state.cards, now);
  }

  importDeck(csvText: string, now = new Date()): ReviewSessionState {
    const cards = importReviewDeck(csvText, now);
    this.replaceCards(cards);
    return this.getState();
  }

  appendDeck(csvText: string, now = new Date()): { state: ReviewSessionState; addedCount: number; skippedDuplicateCount: number } {
    const result = appendReviewDeck(this.state.cards, csvText, now);
    this.replaceCards(result.cards);
    return {
      state: this.getState(),
      addedCount: result.addedCount,
      skippedDuplicateCount: result.skippedDuplicateCount
    };
  }

  clear(): ReviewSessionState {
    this.deckStore.clear();
    this.state = { cards: [], active: { ...EMPTY_ACTIVE_REVIEW }, sessionReviewedCount: 0 };
    return this.getState();
  }

  setAnswer(answer: string): ReviewSessionState {
    this.state = { ...this.state, active: { ...this.state.active, answer } };
    return this.getState();
  }

  async requestHint(now = new Date()): Promise<Hint> {
    const current = this.currentCard(now);
    if (!current) throw new Error("No current card.");

    const hint = await this.coachClient.requestHint(cardPayload(current));
    this.state = { ...this.state, active: { ...this.state.active, hint: hint.hint } };
    return hint;
  }

  async submitAnswer(answer: string, now = new Date()): Promise<void> {
    const current = this.currentCard(now);
    if (!current) throw new Error("No current card.");
    if (!answer.trim()) throw new Error("Answer is required.");

    const feedback = await this.coachClient.requestFeedback(cardPayload(current), answer, current.reviewMemory);
    const coachingThread: CoachingMessage[] = [
      { role: "learner", text: answer },
      { role: "coach", text: coachMessage(feedback.text, feedback.followUpPrompt) }
    ];

    this.state = {
      ...this.state,
      active: {
        ...this.state.active,
        answer,
        feedback,
        proposedReviewMemory: feedback.reviewMemory,
        coachingThread,
        hasOpenFollowUpPrompt: Boolean(feedback.followUpPrompt)
      }
    };
  }

  async submitFollowUpReply(reply: string, now = new Date()): Promise<void> {
    const current = this.currentCard(now);
    const { answer, feedback, coachingThread, proposedReviewMemory } = this.state.active;
    if (!current || !feedback) throw new Error("No active coaching thread.");
    if (!reply.trim()) throw new Error("Reply is required.");

    const nextThread = [...coachingThread, { role: "learner" as const, text: reply }];
    this.state = { ...this.state, active: { ...this.state.active, coachingThread: nextThread, hasOpenFollowUpPrompt: false } };

    try {
      const response = await this.coachClient.requestCoaching(
        cardPayload(current),
        answer,
        feedback,
        nextThread,
        current.reviewMemory,
        proposedReviewMemory
      );
      const finalThread = [
        ...nextThread,
        { role: "coach" as const, text: coachMessage(response.text, response.followUpPrompt) }
      ];

      this.state = {
        ...this.state,
        active: {
          ...this.state.active,
          proposedReviewMemory: "reviewMemory" in response ? response.reviewMemory : this.state.active.proposedReviewMemory,
          coachingThread: finalThread,
          hasOpenFollowUpPrompt: Boolean(response.followUpPrompt)
        }
      };
    } catch (error) {
      this.state = { ...this.state, active: { ...this.state.active, coachingThread, hasOpenFollowUpPrompt: true } };
      throw error;
    }
  }

  rateCurrentCard(rating: Rating, now = new Date()): ReviewSessionState {
    const current = this.currentCard(now);
    const { answer, feedback, coachingThread, proposedReviewMemory } = this.state.active;
    if (!current || !feedback) return this.getState();

    const cards = recordReviewAttempt(
      this.state.cards,
      {
        cardId: current.id,
        answer,
        feedback,
        coachingThread,
        rating,
        reviewMemory: proposedReviewMemory
      },
      now
    );

    this.state = {
      cards,
      active: { ...EMPTY_ACTIVE_REVIEW },
      sessionReviewedCount: this.state.sessionReviewedCount + 1
    };
    this.deckStore.save(cards);
    return this.getState();
  }

  private replaceCards(cards: ReviewCard[]): void {
    this.state = {
      cards,
      active: { ...EMPTY_ACTIVE_REVIEW },
      sessionReviewedCount: 0
    };
    this.deckStore.save(cards);
  }

  private currentCard(now = new Date()): ReviewCard | undefined {
    return getReviewSnapshot(this.state.cards, now).current;
  }
}

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

function coachMessage(text: string, followUpPrompt?: string): string {
  return followUpPrompt ? `${text}\n\n${followUpPrompt}` : text;
}

function cloneSessionState(state: ReviewSessionState): ReviewSessionState {
  return {
    cards: [...state.cards],
    active: {
      ...state.active,
      coachingThread: [...state.active.coachingThread]
    },
    sessionReviewedCount: state.sessionReviewedCount
  };
}

function cardPayload(card: ReviewCard): ImportedCard {
  return {
    question: card.question,
    answer: card.answer,
    context: card.context,
    explanation: card.explanation
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
