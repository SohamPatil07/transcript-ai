import { verifyToken } from "@clerk/backend";
import { createCorsHeaders, createJsonResponse, generateSummary, isExtensionRequest } from "./_rag.js";

export async function handler(event) {
  const origin = event.headers.origin || "*";

  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 204,
      headers: createCorsHeaders(origin),
      body: "",
    };
  }

  if (event.httpMethod !== "POST") {
    return createJsonResponse(405, { error: "Method not allowed." }, origin);
  }

  const clerkSecretKey = process.env.CLERK_SECRET_KEY;
  if (!clerkSecretKey) {
    return createJsonResponse(500, { error: "Missing CLERK_SECRET_KEY." }, origin);
  }

  const extensionRequest = isExtensionRequest(event.headers);

  if (!extensionRequest) {
    const token = event.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) {
      return createJsonResponse(401, { error: "Sign in before summarizing." }, origin);
    }

    try {
      await verifyToken(token, { secretKey: clerkSecretKey });
    } catch {
      return createJsonResponse(401, { error: "Your session expired. Please sign in again." }, origin);
    }
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch {
    return createJsonResponse(400, { error: "Invalid JSON request body." }, origin);
  }
  const transcriptId = typeof body.transcript_id === "string" ? body.transcript_id.trim() : "";
  const transcriptText = typeof body.transcript_text === "string" ? body.transcript_text.trim() : "";
  const title = typeof body.title === "string" ? body.title.trim() : "Untitled transcript";
  const cachedSummary = typeof body.cached_summary === "string" ? body.cached_summary.trim() : "";

  if (!transcriptId) {
    return createJsonResponse(400, { error: "Missing transcript_id." }, origin);
  }

  if (cachedSummary) {
    return createJsonResponse(200, {
      transcript_id: transcriptId,
      summary: cachedSummary,
      cached: true,
    }, origin);
  }

  if (!transcriptText) {
    return createJsonResponse(400, { error: "Missing transcript_text." }, origin);
  }

  try {
    const result = await generateSummary({
      title,
      transcriptText,
    });

    return createJsonResponse(200, {
      transcript_id: transcriptId,
      summary: result.summary,
      model: result.model,
      cached: false,
      created_at: new Date().toISOString(),
    }, origin);
  } catch (error) {
    console.error("Summary generation error:", error.message);
    return createJsonResponse(500, {
      error: error.message || "Failed to generate summary.",
    }, origin);
  }
}
