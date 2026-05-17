import { verifyToken } from "@clerk/backend";
import { createCorsHeaders, createJsonResponse, isExtensionRequest } from "./_rag.js";

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

  const apifyToken = process.env.APIFY_TOKEN;
  const actorId = process.env.APIFY_ACTOR_ID || "trisecode/yt-transcript";
  const clerkSecretKey = process.env.CLERK_SECRET_KEY;

  if (!apifyToken) return createJsonResponse(500, { error: "Missing APIFY_TOKEN." }, origin);
  if (!clerkSecretKey) return createJsonResponse(500, { error: "Missing CLERK_SECRET_KEY." }, origin);

  const extensionRequest = isExtensionRequest(event.headers);

  if (!extensionRequest) {
    const token = event.headers.authorization?.replace(/^Bearer\s+/i, "");
    if (!token) return createJsonResponse(401, { error: "Sign in before transcribing." }, origin);

    try {
      await verifyToken(token, { secretKey: clerkSecretKey });
    } catch {
      return createJsonResponse(401, { error: "Your session expired. Please sign in again." }, origin);
    }
  }

  const body = JSON.parse(event.body || "{}");
  const videoId = extractYouTubeVideoId(body.url);
  if (!videoId) return createJsonResponse(400, { error: "Paste a valid YouTube link." }, origin);

  try {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const actorItems = await callApify(actorId, apifyToken, videoUrl);
    const normalized = normalizeActorResult(actorItems, videoUrl, videoId);
    const transcriptId = createId();

    if (!normalized.transcript_text) {
      console.error("No transcript text extracted. Normalized data:", JSON.stringify(normalized).substring(0, 500));
      return createJsonResponse(422, {
        error: normalized.error || "No transcript was returned for this video. It may not have captions available.",
        debug: {
          title: normalized.title,
          language: normalized.language,
          segmentCount: normalized.segments.length,
          responseStructure: JSON.stringify(actorItems[0]).substring(0, 200),
        },
      }, origin);
    }

    return createJsonResponse(200, {
      transcription: {
        id: transcriptId,
        video_id: videoId,
        video_url: videoUrl,
        thumbnail_url: getYouTubeThumbnailUrl(videoId),
        title: normalized.title,
        transcript_text: normalized.transcript_text,
        language: normalized.language,
        created_at: new Date().toISOString(),
      },
    }, origin);
  } catch (error) {
    console.error("Transcription error:", error.message);
    return createJsonResponse(500, { error: error.message || "Failed to transcribe video. Please try again." }, origin);
  }
}

async function callApify(actorId, token, videoUrl) {
  const actorPath = actorId.replace("/", "~");
  const apiUrl = `https://api.apify.com/v2/acts/${actorPath}/run-sync-get-dataset-items?token=${token}&timeout=180`;

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      urls: [{ url: videoUrl }],
      outputFormat: "json",
      languages: ["en"],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = "Apify actor failed.";
    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson?.error?.message || errorJson?.message || errorText;
    } catch {
      errorMessage = errorText || `HTTP ${response.status}: ${response.statusText}`;
    }
    throw new Error(errorMessage);
  }

  const text = await response.text();
  if (!text || text.trim() === "") {
    throw new Error("Apify actor returned an empty response. The video may not have available captions.");
  }

  let payload;
  try {
    payload = JSON.parse(text);
  } catch {
    console.error("Failed to parse Apify response:", text.substring(0, 500));
    throw new Error("Invalid JSON response from Apify. The video may not have available captions.");
  }

  console.log("Apify response received. Type:", Array.isArray(payload) ? "array" : typeof payload);
  console.log("Response structure:", JSON.stringify(payload).substring(0, 300) + "...");

  return Array.isArray(payload) ? payload : [payload];
}

function normalizeActorResult(items, videoUrl, videoId) {
  console.log("Normalizing items. Count:", items.length);
  console.log("Items structure:", JSON.stringify(items).substring(0, 500) + "...");

  // The supreme_coder actor returns items with a different structure
  let item = items[0] || {};

  console.log("Selected item:", JSON.stringify(item).substring(0, 300) + "...");

  // Some actors return transcript as an array of segment objects instead of a plain string.
  let transcriptText =
    typeof item.transcript === "string"
      ? item.transcript
      : typeof item.text === "string"
        ? item.text
        : typeof item.content === "string"
          ? item.content
          : "";

  // Handle array of segments (if transcript is an array of objects)
  let segments = [];
  if (Array.isArray(item.transcript)) {
    segments = item.transcript;
    // Build full text from segment objects when no direct transcript string is present.
    if (!transcriptText && segments.length > 0) {
      transcriptText = segments
        .map((segment) => segment.text || segment.content || "")
        .filter(Boolean)
        .join(" ");
    }
  }

  // Fallback: check for segments in different locations
  if (!segments || segments.length === 0) {
    segments = item.segments || item.captions || [];
  }

  // Build text from fallback segment collections too.
  if (!transcriptText && Array.isArray(segments) && segments.length > 0) {
    transcriptText = segments
      .map((segment) => segment.text || segment.content || "")
      .filter(Boolean)
      .join(" ");
  }

  if (typeof transcriptText !== "string") {
    transcriptText = "";
  }
  transcriptText = formatTranscriptText(transcriptText);

  console.log("Extracted transcript length:", transcriptText?.length || 0);

  // Check for error messages
  let errorMsg = null;
  if (item.error) {
    errorMsg = item.error;
  }
  if (!transcriptText && item.message) {
    errorMsg = item.message;
  }

  return {
    title: item.title || item.videoTitle || `YouTube video ${videoId}`,
    language: item.language || "en",
    transcript_text: transcriptText,
    error: errorMsg,
    video_url: item.url || videoUrl,
  };
}

function formatTranscriptText(value) {
  if (!value || typeof value !== "string") return "";

  const decoded = decodeHtmlEntities(value);
  const normalizedWhitespace = decoded
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalizedWhitespace
    .replace(/([.!?])\s+(?=[A-Z])/g, "$1\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value) {
  const namedEntities = {
    amp: "&",
    apos: "'",
    quot: "\"",
    lt: "<",
    gt: ">",
    nbsp: " ",
    rsquo: "'",
    lsquo: "'",
    ldquo: "\"",
    rdquo: "\"",
    mdash: "-",
    ndash: "-",
  };

  return value.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === "#") {
      const isHex = entity[1]?.toLowerCase() === "x";
      const rawCode = isHex ? entity.slice(2) : entity.slice(1);
      const codePoint = Number.parseInt(rawCode, isHex ? 16 : 10);
      return Number.isFinite(codePoint) ? String.fromCodePoint(codePoint) : match;
    }

    return namedEntities[entity] ?? match;
  });
}

function getYouTubeThumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

function extractYouTubeVideoId(rawUrl) {
  if (!rawUrl) return null;
  const value = rawUrl.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") return sanitizeId(url.pathname.split("/").filter(Boolean)[0]);
    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (url.searchParams.get("v")) return sanitizeId(url.searchParams.get("v"));
      const parts = url.pathname.split("/").filter(Boolean);
      if (["shorts", "embed", "live", "v"].includes(parts[0])) return sanitizeId(parts[1]);
    }
  } catch {
    return null;
  }

  return null;
}

function sanitizeId(value) {
  return value?.match(/[a-zA-Z0-9_-]{11}/)?.[0] ?? null;
}

function createId() {
  return globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
