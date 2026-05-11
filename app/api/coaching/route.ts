import { NextResponse } from "next/server";
import { requestCoaching } from "@/lib/coaching";
import type { CoachingMessage, Feedback, ImportedCard, ReviewMemory, ReviewMemoryProposal } from "@/lib/types";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      card?: ImportedCard;
      learnerAnswer?: string;
      feedback?: Feedback;
      thread?: CoachingMessage[];
      reviewMemory?: ReviewMemory;
      proposedReviewMemory?: ReviewMemoryProposal | null;
    };

    if (!body.card || typeof body.learnerAnswer !== "string" || !body.feedback || !Array.isArray(body.thread)) {
      return NextResponse.json(
        { error: "card, learnerAnswer, feedback, and thread are required." },
        { status: 400 }
      );
    }

    const coaching = await requestCoaching(
      body.card,
      body.learnerAnswer,
      body.feedback,
      body.thread,
      body.reviewMemory,
      body.proposedReviewMemory
    );
    return NextResponse.json(coaching);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Coaching failed." },
      { status: 500 }
    );
  }
}
