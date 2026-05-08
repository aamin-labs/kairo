import { NextResponse } from "next/server";
import { requestCoaching } from "@/lib/coaching";
import type { CoachingMessage, Feedback, ImportedCard } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      card?: ImportedCard;
      learnerAnswer?: string;
      feedback?: Feedback;
      thread?: CoachingMessage[];
    };

    if (!body.card || typeof body.learnerAnswer !== "string" || !body.feedback || !Array.isArray(body.thread)) {
      return NextResponse.json(
        { error: "card, learnerAnswer, feedback, and thread are required." },
        { status: 400 }
      );
    }

    const coaching = await requestCoaching(body.card, body.learnerAnswer, body.feedback, body.thread);
    return NextResponse.json(coaching);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Coaching failed." },
      { status: 500 }
    );
  }
}
