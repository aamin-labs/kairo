import { NextResponse } from "next/server";
import { requestFeedback } from "@/lib/coaching";
import type { ImportedCard, ReviewMemory } from "@/lib/types";

export const maxDuration = 30;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      card?: ImportedCard;
      learnerAnswer?: string;
      reviewMemory?: ReviewMemory;
    };

    if (!body.card || typeof body.learnerAnswer !== "string") {
      return NextResponse.json({ error: "card and learnerAnswer are required." }, { status: 400 });
    }

    const feedback = await requestFeedback(body.card, body.learnerAnswer, body.reviewMemory);
    return NextResponse.json(feedback);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Feedback failed." },
      { status: 500 }
    );
  }
}
