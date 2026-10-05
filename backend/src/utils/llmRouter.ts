// Primary: Gemini (streaming). Fallback: Groq (streaming).
// Fallback policy: ONLY on 429 (rate-limited), 5xx (provider down),
// or network errors with no HTTP status. Never on 400/401/403/404
// (bad request, bad credentials, unknown model) — those indicate a
// config/code bug and falling back would hide it.
import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

export const PRIMARY_MODEL =
  process.env.GEMINI_MODEL || "gemini-3.5-flash-lite";
// qwen/qwen3.6-27b was shut down 2026-09-14; qwen3.8-27b is its successor.
export const FALLBACK_MODEL =
  process.env.GROQ_CHAT_MODEL || "qwen/qwen3.8-27b";

type GeminiPart = { text?: string };
type GeminiHistoryItem = {
  role?: string;
  parts?: GeminiPart[];
  content?: string;
};

function getGeminiClient() {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new Error("Missing GEMINI_API_KEY (primary LLM not configured).");
  return new GoogleGenerativeAI(key);
}

function getGroqClient() {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new Error("Missing GROQ_API_KEY (fallback LLM not configured).");
  return new Groq({ apiKey: key });
}

function toGroqMessages(history: GeminiHistoryItem[]) {
  return history
    .map((msg) => {
      const role =
        msg.role === "model"
          ? ("assistant" as const)
          : msg.role === "system"
            ? ("system" as const)
            : ("user" as const);
      const content =
        msg.parts?.[0]?.text ?? msg.content ?? "";
      return { role, content };
    })
    .filter((m) => m.content && m.content.trim().length > 0);
}

// Google SDK errors expose `status`, but network/fetch failures may not.
// Fall back to parsing the message ("[429]", "429 Too Many Requests", ...).
function getHttpStatus(error: any): number | undefined {
  const direct =
    error?.status ??
    error?.code ??
    error?.error?.code ??
    error?.response?.status;
  if (typeof direct === "number" && Number.isFinite(direct)) return direct;
  if (typeof direct === "string" && /^\d{3}$/.test(direct.trim()))
    return Number(direct.trim());

  const msg = String(error?.message ?? "");
  const bracket = msg.match(/\[(\d{3})\]/);
  if (bracket) return Number(bracket[1]);
  const labeled = msg.match(/\b(4\d\d|5\d\d)\b/);
  if (labeled) return Number(labeled[1]);

  const lowered = msg.toLowerCase();
  if (lowered.includes("api key not valid") || lowered.includes("api_key_invalid"))
    return 401;
  if (lowered.includes("rate limit") || lowered.includes("429") || lowered.includes("quota"))
    return 429;

  return undefined;
}

function shouldFallback(status: number | undefined): boolean {
  // No status = network/fetch failure before an HTTP response: transient, fallback OK.
  if (status === undefined) return true;
  if (status === 429) return true;
  if (status >= 500 && status <= 599) return true;
  if (status === 408) return true; // request timeout: transient
  return false; // 400/401/403/404 and other 4xx: don't hide config bugs
}

// Helper to keep the main try/catch clean. Throws with context if Groq fails.
async function* streamWithGroq(history: GeminiHistoryItem[]) {
  const messages = toGroqMessages(history);
  if (messages.length === 0) {
    throw new Error("Groq fallback aborted: empty chat history after mapping.");
  }

  let stream;
  try {
    stream = await getGroqClient().chat.completions.create({
      model: FALLBACK_MODEL,
      messages,
      stream: true,
    });
  } catch (groqErr: any) {
    const msg = groqErr?.message ?? String(groqErr);
    throw new Error(`Groq fallback failed (${FALLBACK_MODEL}): ${msg}`);
  }

  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    if (text) yield text;
  }
}

// Streaming variant for Socket.IO (`chat:message` -> `chat:chunk`).
// Yields text chunks, so it plugs directly into the socket streaming loop.
export async function* streamChatResponse(history: GeminiHistoryItem[]) {
  // Config errors fail fast WITHOUT fallback (don't hide a missing key behind Groq).
  const gemini = getGeminiClient();
  if (!history || history.length === 0) throw new Error("streamChatResponse: empty history.");
  try {
    // 1. Try the primary model first
    const model = gemini.getGenerativeModel({ model: PRIMARY_MODEL });
    const result = await model.generateContentStream({ contents: history as any });

    for await (const chunk of result.stream) {
      yield chunk.text();
    }
  } catch (error: any) {
    const status = getHttpStatus(error);
    console.error(
      `Gemini failed${status !== undefined ? ` with status ${status}` : " (no HTTP status / network error)"}:`,
      error?.message ?? error
    );

    // ==========================================
    // DO NOT FALL BACK: 400/401/403/404 (config or client bug)
    // ==========================================
    // Falling back here hides the real problem (bad key, bad model
    // name, malformed request) from the developer.
    if (!shouldFallback(status)) {
      throw new Error(
        `Primary LLM request failed with status ${status}. Not falling back (config/client error).`
      );
    }

    // ==========================================
    // FALL BACK: 429 / 408 / 5xx / network errors (transient)
    // ==========================================
    console.log(
      `Transient Gemini failure${status !== undefined ? ` (${status})` : ""}. Falling back to Groq (${FALLBACK_MODEL})...`
    );
    try {
      yield* streamWithGroq(history);
    } catch (groqErr: any) {
      throw new Error(
        `Primary LLM failed${status !== undefined ? ` (status ${status})` : ""} and Groq fallback also failed: ${groqErr?.message ?? groqErr}`
      );
    }
  }
}
