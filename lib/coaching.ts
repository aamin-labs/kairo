import type { Feedback, Hint, ImportedCard } from "./types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export async function requestFeedback(card: ImportedCard, learnerAnswer: string): Promise<Feedback> {
  return requestJson<Feedback>(
    "You are a terse Socratic Anki review coach. Stay grounded in the card fields. Return only JSON with one field, text. The text must be natural prose, not labeled sections or bullets. In 3-6 compact sentences: judge the learner's answer, name what worked, correct what is fuzzy, improve precision, and include one follow-up question only when useful.",
    {
      task: "review_answer",
      expectedShape: {
        text: "compact prose feedback, no labels, no bullets"
      },
      card,
      learnerAnswer
    }
  );
}

export async function requestHint(card: ImportedCard): Promise<Hint> {
  return requestJson<Hint>(
    "You are a terse Socratic Anki hint generator. Give one scaffolded hint. Do not reveal the answer. Return only JSON.",
    {
      task: "give_hint",
      expectedShape: { hint: "one short hint that helps retrieval without giving away the answer" },
      card
    }
  );
}

async function requestJson<T>(instructions: string, input: unknown): Promise<T> {
  const text = await requestAnthropic(instructions, input);
  return JSON.parse(stripCodeFence(text)) as T;
}

async function requestAnthropic(instructions: string, input: unknown): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }

  const response = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": ANTHROPIC_VERSION
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
      max_tokens: 500,
      temperature: 0.2,
      system: instructions,
      messages: [{ role: "user", content: JSON.stringify(input) }]
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as { content?: Array<{ type?: string; text?: string }> };
  const text =
    payload.content
      ?.map((part) => (part.type === "text" && typeof part.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n") ?? "";

  if (!text) {
    throw new Error("Anthropic response had no text output.");
  }

  return text;
}

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}
