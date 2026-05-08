import { NextResponse } from "next/server";
import { requestHint } from "@/lib/coaching";
import type { ImportedCard } from "@/lib/types";

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { card?: ImportedCard };

    if (!body.card) {
      return NextResponse.json({ error: "card is required." }, { status: 400 });
    }

    const hint = await requestHint(body.card);
    return NextResponse.json(hint);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Hint failed." },
      { status: 500 }
    );
  }
}
