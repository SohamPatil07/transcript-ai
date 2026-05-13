import { verifyToken } from "@clerk/backend";
import {
  createJsonResponse,
  findTranscriptMatchesLocally,
  generateChatAnswer,
  normalizeChatHistory,
} from "./_rag.js";

export async function handler(event) {
  if (event.httpMethod !== "POST") {
    return createJsonResponse(405, { error: "Method not allowed." });
  }

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    return createJsonResponse(500, { error: "Missing CLERK_SECRET_KEY." });
  }

  const token = event.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return createJsonResponse(401, { error: "Sign in before using transcript chat." });
  }

  try {
    await verifyToken(token, { secretKey: clerkSecretKey });
  } catch {
    return createJsonResponse(401, { error: "Your session expired. Please sign in again." });
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return createJsonResponse(400, { error: "Invalid JSON request body." });
  }
  const transcriptId = typeof body.transcript_id === "string" ? body.transcript_id.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const question = typeof body.question === "string" ? body.question.trim() : "";
  const transcriptText = typeof body.transcript_text === "string" ? body.transcript_text.trim() : "";
  const threadId = typeof body.thread_id === "string" && body.thread_id.trim()
    ? body.thread_id.trim()
    : createId();
  const recentMessages = normalizeChatHistory(body.messages);

  if (!transcriptId) {
    return createJsonResponse(400, { error: "Missing transcript_id." });
  }

  if (!question) {
    return createJsonResponse(400, { error: "Ask a question about the transcript." });
  }

  if (!transcriptText) {
    return createJsonResponse(400, { error: "Missing transcript_text." });
  }

  try {
    const matches = findTranscriptMatchesLocally({
      transcriptText,
      question,
    });

    if (matches.length === 0) {
      return createJsonResponse(200, {
        thread_id: threadId,
        answer:
          "I could not find enough evidence in this transcript to answer that confidently.",
        sources: [],
        created_at: new Date().toISOString(),
      });
    }

    const result = await generateChatAnswer({
      question,
      matches,
      recentMessages,
      title,
    });

    return createJsonResponse(200, {
      thread_id: threadId,
      answer: result.answer,
      model: result.model,
      sources: result.sources,
      created_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Transcript chat error:", error.message);
    return createJsonResponse(500, {
      error: error.message || "Failed to answer the question.",
    });
  }
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
