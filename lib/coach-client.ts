import type {
  CoachingMessage,
  CoachingResponse,
  Feedback,
  Hint,
  ImportedCard,
  ReviewMemory,
  ReviewMemoryProposal
} from "./types";
import type { CoachClient } from "./review-session";

export function httpCoachClient(): CoachClient {
  return {
    requestHint(card) {
      return postJson<Hint>("/api/hint", { card });
    },
    requestFeedback(card, learnerAnswer, reviewMemory) {
      return postJson<Feedback>("/api/feedback", { card, learnerAnswer, reviewMemory });
    },
    requestCoaching(card, learnerAnswer, feedback, thread, reviewMemory, proposedReviewMemory) {
      return postJson<CoachingResponse>("/api/coaching", {
        card,
        learnerAnswer,
        feedback,
        thread,
        reviewMemory,
        proposedReviewMemory
      });
    }
  };
}

async function postJson<T>(url: string, payload: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });
  const body = (await response.json()) as T | { error?: string };

  if (!response.ok) {
    const error = typeof body === "object" && body && "error" in body ? body.error : undefined;
    throw new Error(error || "Request failed.");
  }

  return body as T;
}

export type CoachRequestPayload = {
  card: ImportedCard;
  learnerAnswer?: string;
  feedback?: Feedback;
  thread?: CoachingMessage[];
  reviewMemory?: ReviewMemory;
  proposedReviewMemory?: ReviewMemoryProposal | null;
};
