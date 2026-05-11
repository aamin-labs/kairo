import type {
  CoachingMessage,
  CoachingResponse,
  Feedback,
  Hint,
  ImportedCard,
  ReviewMemory,
  ReviewMemoryProposal
} from "./types";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

export async function requestFeedback(
  card: ImportedCard,
  learnerAnswer: string,
  reviewMemory?: ReviewMemory
): Promise<Feedback> {
  return requestJson<Feedback>(
    "You are a terse Socratic Anki review coach. Stay grounded in the card fields. Separate critique from follow-up. If prior reviewMemory exists, compare the learner's current answer against that learning edge. In text, use 2-4 compact sentences to judge the learner's answer, name what worked, correct what is fuzzy, and improve precision. Put one optional Socratic follow-up question in followUpPrompt only when useful. Do not include the follow-up question inside text. Return reviewMemory as the current learning edge plus evidence, or null when no useful learning edge remains.",
    {
      task: "review_answer",
      expectedShape: {
        text: "compact prose feedback, no labels, no bullets, no follow-up question",
        followUpPrompt: "optional one-sentence question that deepens recall",
        reviewMemory: {
          learningEdge: "compact current fragile point for this learner on this card",
          evidence: "brief reason from the learner's answer"
        }
      },
      card,
      learnerAnswer,
      reviewMemory: reviewMemory ?? null
    },
    responseSchema(["text"])
  );
}

export async function requestCoaching(
  card: ImportedCard,
  learnerAnswer: string,
  feedback: Feedback,
  thread: CoachingMessage[],
  reviewMemory?: ReviewMemory,
  proposedReviewMemory?: ReviewMemoryProposal | null
): Promise<CoachingResponse> {
  return requestJson<CoachingResponse>(
    "You are continuing a short Socratic coaching thread for an Anki review. Stay grounded in the card fields and prior thread. Use proposedReviewMemory as the current memory proposal for this attempt. Use prior reviewMemory after the current thread, not before it. In text, briefly respond to the learner's latest reply: correct misconceptions, confirm useful precision, or clarify the missing idea. Put one optional next question in followUpPrompt only when it would deepen recall. Do not grade or rate the answer. Do not include the follow-up question inside text. Return reviewMemory as the updated current learning edge plus evidence, or null when no useful learning edge remains.",
    {
      task: "continue_coaching",
      expectedShape: {
        text: "brief coaching response, no labels, no bullets, no grade",
        followUpPrompt: "optional one-sentence next question",
        reviewMemory: {
          learningEdge: "compact current fragile point for this learner on this card",
          evidence: "brief reason from the learner's latest answer or coaching thread"
        }
      },
      card,
      learnerAnswer,
      feedback,
      thread,
      reviewMemory: reviewMemory ?? null,
      proposedReviewMemory: proposedReviewMemory ?? null
    },
    responseSchema(["text"])
  );
}

export async function requestHint(card: ImportedCard): Promise<Hint> {
  return requestJson<Hint>(
    "You are a terse Socratic Anki hint generator. Give one scaffolded hint. Do not reveal the answer.",
    {
      task: "give_hint",
      expectedShape: { hint: "one short hint that helps retrieval without giving away the answer" },
      card
    },
    {
      type: "object",
      additionalProperties: false,
      properties: { hint: { type: "string" } },
      required: ["hint"]
    }
  );
}

type JsonSchema = Record<string, unknown>;

type AnthropicContentPart = {
  type?: string;
  text?: string;
  name?: string;
  input?: unknown;
};

async function requestJson<T>(instructions: string, input: unknown, schema: JsonSchema): Promise<T> {
  const text = await requestAnthropic(instructions, input, schema);
  return parseJsonResponse<T>(text);
}

async function requestAnthropic(instructions: string, input: unknown, schema: JsonSchema): Promise<string> {
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
      messages: [{ role: "user", content: JSON.stringify(input) }],
      tools: [
        {
          name: "emit_json",
          description: "Return the final answer as structured JSON only.",
          input_schema: schema
        }
      ],
      tool_choice: { type: "tool", name: "emit_json" }
    })
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Anthropic request failed: ${response.status} ${body}`);
  }

  const payload = (await response.json()) as { content?: AnthropicContentPart[] };
  const toolInput = payload.content?.find((part) => part.type === "tool_use" && part.name === "emit_json")?.input;

  if (toolInput !== undefined) {
    return JSON.stringify(toolInput);
  }

  const text =
    payload.content
      ?.map((part) => (part.type === "text" && typeof part.text === "string" ? part.text : ""))
      .filter(Boolean)
      .join("\n") ?? "";

  if (!text) {
    throw new Error("Anthropic response had no JSON output.");
  }

  return text;
}

function responseSchema(required: string[]): JsonSchema {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      text: { type: "string" },
      followUpPrompt: { type: "string" },
      reviewMemory: {
        anyOf: [
          {
            type: "object",
            additionalProperties: false,
            properties: {
              learningEdge: { type: "string" },
              evidence: { type: "string" }
            },
            required: ["learningEdge", "evidence"]
          },
          { type: "null" }
        ]
      }
    },
    required
  };
}

export function parseJsonResponse<T>(text: string): T {
  const jsonText = extractJsonObject(stripCodeFence(text));

  try {
    return JSON.parse(jsonText) as T;
  } catch {
    throw new Error("Model returned invalid JSON.");
  }
}

function stripCodeFence(text: string): string {
  return text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
}

function extractJsonObject(text: string): string {
  const trimmed = text.trim();

  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    return trimmed;
  }

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Model did not return JSON.");
  }

  return trimmed.slice(start, end + 1);
}
