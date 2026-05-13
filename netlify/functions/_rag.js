const DEFAULT_CHAT_MODEL = "llama-3.3-70b-versatile";
const DEFAULT_SUMMARY_MODEL = "llama-3.3-70b-versatile";
const CHUNK_SIZE = 3500;
const CHUNK_OVERLAP = 400;
const MAX_SOURCES = 4;
const DEFAULT_GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const SUMMARY_CHUNK_LIMIT = 6;

export {
  createCorsHeaders,
  createJsonResponse,
  createTranscriptChunks,
  findTranscriptMatchesLocally,
  generateChatAnswer,
  generateSummary,
  normalizeChatHistory,
};

function createCorsHeaders(origin = "*") {
  return {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  };
}

function createJsonResponse(statusCode, body, origin = "*") {
  return {
    statusCode,
    headers: createCorsHeaders(origin),
    body: JSON.stringify(body),
  };
}

async function generateSummary({ title, transcriptText }) {
  const model = process.env.GROQ_SUMMARY_MODEL || DEFAULT_SUMMARY_MODEL;
  const transcriptChunks = createTranscriptChunks(transcriptText).slice(0, SUMMARY_CHUNK_LIMIT);

  if (transcriptChunks.length === 0) {
    throw new Error("Transcript is empty, so there is nothing to summarize.");
  }

  const partialSummaries = [];
  for (const chunk of transcriptChunks) {
    const partialSummary = await groqChat({
      model,
      messages: [
        {
          role: "system",
          content:
            "You summarize transcript sections clearly. Capture the key points, decisions, action items, and important takeaways from only the provided excerpt.",
        },
        {
          role: "user",
          content: `Title: ${title || "Untitled transcript"}\n\nTranscript excerpt:\n${chunk.text}`,
        },
      ],
      temperature: 0.2,
    });
    partialSummaries.push(`Section ${chunk.index + 1} summary:\n${partialSummary}`);
  }

  const summary = await groqChat({
    model,
    messages: [
      {
        role: "system",
        content:
          "Combine section summaries into one clean transcript summary. Highlight main themes, key points, decisions, action items, and important takeaways. Keep it concise and easy to scan.",
      },
      {
        role: "user",
        content: `Title: ${title || "Untitled transcript"}\n\nSection summaries:\n${partialSummaries.join("\n\n")}`,
      },
    ],
    temperature: 0.2,
  });

  return { summary, model };
}

async function generateChatAnswer({ question, matches, recentMessages, title }) {
  const model = process.env.GROQ_CHAT_MODEL || DEFAULT_CHAT_MODEL;
  const contextBlock = matches
    .map((match, index) => `Source ${index + 1} (chunk ${match.chunk_index}):\n${match.chunk_text}`)
    .join("\n\n");

  const historyBlock = normalizeChatHistory(recentMessages)
    .slice(-6)
    .map((message) => `${message.role === "assistant" ? "Assistant" : "User"}: ${message.content}`)
    .join("\n");

  const answer = await groqChat({
    model,
    messages: [
      {
        role: "system",
        content:
          "You answer questions only from the provided transcript. Do not use outside knowledge. If the transcript does not support the answer, say that the transcript does not contain enough evidence. Prefer concise, direct answers and mention uncertainty when needed.",
      },
      {
        role: "user",
        content: [
          `Transcript title: ${title || "Untitled transcript"}`,
          historyBlock ? `Recent conversation:\n${historyBlock}` : "",
          `Question:\n${question}`,
          `Transcript excerpts:\n${contextBlock || "No excerpts available."}`,
          "Answer only from the transcript excerpts. If the excerpts are insufficient, clearly say so.",
        ]
          .filter(Boolean)
          .join("\n\n"),
      },
    ],
    temperature: 0.1,
  });

  return {
    answer,
    model,
    sources: matches.slice(0, MAX_SOURCES).map((match) => ({
      chunk_text: match.chunk_text,
      chunk_index: match.chunk_index,
    })),
  };
}

function createTranscriptChunks(transcriptText) {
  if (!transcriptText || typeof transcriptText !== "string") return [];

  const normalized = transcriptText.trim();
  if (!normalized) return [];

  const chunks = [];
  let start = 0;
  let index = 0;

  while (start < normalized.length) {
    let end = Math.min(start + CHUNK_SIZE, normalized.length);
    if (end < normalized.length) {
      const paragraphBoundary = normalized.lastIndexOf("\n", end);
      const sentenceBoundary = normalized.lastIndexOf(". ", end);
      const boundary = Math.max(paragraphBoundary, sentenceBoundary);
      if (boundary > start + Math.floor(CHUNK_SIZE * 0.5)) {
        end = boundary + 1;
      }
    }

    const text = normalized.slice(start, end).trim();
    if (text) {
      chunks.push({ index, text });
      index += 1;
    }

    if (end >= normalized.length) break;
    start = Math.max(end - CHUNK_OVERLAP, start + 1);
  }

  return chunks;
}

function findTranscriptMatchesLocally({ transcriptText, question, topK = MAX_SOURCES }) {
  const chunks = createTranscriptChunks(transcriptText);
  if (chunks.length === 0) return [];

  const queryTerms = tokenize(question);
  const rankedChunks = chunks
    .map((chunk) => ({
      chunk_text: chunk.text,
      chunk_index: chunk.index,
      score: scoreChunk(chunk.text, queryTerms),
    }))
    .sort((left, right) => right.score - left.score || left.chunk_index - right.chunk_index)
    .slice(0, topK);

  const usefulChunks = rankedChunks.filter((chunk) => chunk.score > 0);
  const selected = usefulChunks.length > 0 ? usefulChunks : rankedChunks;

  return selected.map(({ score, ...chunk }) => chunk);
}

function normalizeChatHistory(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message) => message && typeof message === "object")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: typeof message.content === "string" ? message.content.trim() : "",
      sources: Array.isArray(message.sources) ? message.sources : [],
      created_at: message.created_at || new Date().toISOString(),
    }))
    .filter((message) => message.content);
}

function scoreChunk(text, queryTerms) {
  if (queryTerms.length === 0) return 1;

  const lowered = text.toLowerCase();
  let score = 0;

  for (const term of queryTerms) {
    const occurrences = lowered.split(term).length - 1;
    if (occurrences > 0) score += occurrences * 3;
  }

  const fullQuery = queryTerms.join(" ");
  if (fullQuery && lowered.includes(fullQuery)) score += 8;

  return score;
}

function tokenize(value) {
  return String(value || "")
    .toLowerCase()
    .split(/[^a-z0-9]+/i)
    .map((term) => term.trim())
    .filter((term) => term.length > 2);
}

async function groqChat({ model, messages, temperature }) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY.");
  }

  const apiUrl = process.env.GROQ_API_URL || DEFAULT_GROQ_URL;
  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages,
      temperature,
    }),
  });

  const payload = await readApiResponse(response, "Groq request failed.");
  const content = payload.choices?.[0]?.message?.content;

  if (!content || typeof content !== "string") {
    throw new Error("Groq returned an empty response.");
  }

  return content.trim();
}

async function readApiResponse(response, fallbackMessage) {
  const text = await response.text();
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = { error: text };
    }
  }

  if (!response.ok) {
    const message =
      payload.error?.message ||
      payload.error ||
      payload.message ||
      `${fallbackMessage} (HTTP ${response.status})`;
    throw new Error(String(message));
  }

  return payload;
}
