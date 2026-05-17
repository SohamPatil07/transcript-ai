import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Check,
  Clipboard,
  Download,
  ExternalLink,
  FileText,
  History,
  Loader2,
  MessageSquare,
  RefreshCcw,
  Send,
  Sparkles,
  Youtube,
} from "lucide-react";
import "./sidepanel.css";
import extensionLogo from "../Transcript-AI-Logo.png";
import {
  downloadTranscript,
  extractYouTubeVideoId,
  formatDate,
  normalizeYouTubeUrl,
} from "../src/utils";

const apiBaseUrl = (
  import.meta.env.VITE_EXTENSION_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_EXTENSION_APP_URL ||
  ""
).trim();

const appBaseUrl = (
  import.meta.env.VITE_EXTENSION_APP_URL ||
  import.meta.env.VITE_EXTENSION_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ""
).trim();

const historyStorageKey = "transcript-ai:extension-history";

function ExtensionApp() {
  const [currentVideo, setCurrentVideo] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("error");
  const [copied, setCopied] = useState(false);
  const [question, setQuestion] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [activeId, setActiveId] = useState(null);

  const activeTranscript = useMemo(
    () => transcripts.find((item) => item.id === activeId) ?? transcripts[0] ?? null,
    [activeId, transcripts],
  );

  useEffect(() => {
    const items = readHistory();
    setTranscripts(items);
    setActiveId(items[0]?.id ?? null);
    void refreshCurrentTab();
  }, []);

  useEffect(() => {
    if (!message) return undefined;
    const timeout = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  async function refreshCurrentTab() {
    setLoadingVideo(true);
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });

      const videoId = extractYouTubeVideoId(tab?.url || "");
      setCurrentVideo({
        url: videoId ? normalizeYouTubeUrl(tab.url) : "",
        videoId,
      });
    } finally {
      setLoadingVideo(false);
    }
  }

  async function openAppInBrowser() {
    if (!appBaseUrl) return;
    const url = new URL(appBaseUrl);
    if (currentVideo?.url) {
      url.searchParams.set("youtubeUrl", currentVideo.url);
    }
    await chrome.tabs.create({ url: url.toString() });
  }

  async function handleTranscribe() {
    if (!currentVideo?.url) {
      setMessageKind("error");
      setMessage("Open a supported YouTube video before transcribing.");
      return;
    }

    setLoadingTranscript(true);
    setMessage("");
    try {
      const response = await fetch(getApiUrl("/.netlify/functions/transcribe"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Extension-Request": "true",
        },
        body: JSON.stringify({ url: currentVideo.url }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(payload.error || "Transcript request failed.");
      }

      const nextItems = [sanitizeTranscript(payload.transcription), ...transcripts.filter((item) => item.video_id !== payload.transcription.video_id)];
      setTranscripts(nextItems);
      setActiveId(payload.transcription.id);
      writeHistory(nextItems);
      setMessageKind("success");
      setMessage("Transcript ready.");
    } catch (error) {
      setMessageKind("error");
      setMessage(error.message || "Failed to transcribe this video.");
    } finally {
      setLoadingTranscript(false);
    }
  }

  async function handleSummarize() {
    if (!activeTranscript || summaryLoading) return;

    setSummaryLoading(true);
    setMessage("");
    try {
      const response = await fetch(getApiUrl("/.netlify/functions/summarize"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Extension-Request": "true",
        },
        body: JSON.stringify({
          transcript_id: activeTranscript.id,
          title: activeTranscript.title,
          transcript_text: activeTranscript.transcript_text,
          cached_summary: activeTranscript.summary || "",
        }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(payload.error || "Summary request failed.");
      }

      const nextItems = updateTranscriptRecord(transcripts, activeTranscript.id, {
        summary: payload.summary,
        summary_model: payload.model || "",
        summary_created_at: payload.created_at || new Date().toISOString(),
      });
      setTranscripts(nextItems);
      writeHistory(nextItems);
    } catch (error) {
      setMessageKind("error");
      setMessage(error.message || "Failed to generate summary.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleAskQuestion(event) {
    event.preventDefault();
    if (!activeTranscript || chatLoading) return;

    const nextQuestion = question.trim();
    if (!nextQuestion) return;

    setChatLoading(true);
    setMessage("");

    const optimisticUserMessage = createMessage("user", nextQuestion);
    const optimisticMessages = [...(activeTranscript.messages || []), optimisticUserMessage];
    const optimisticItems = updateTranscriptRecord(transcripts, activeTranscript.id, {
      messages: optimisticMessages,
      thread_id: activeTranscript.thread_id || activeTranscript.id,
    });

    setTranscripts(optimisticItems);
    writeHistory(optimisticItems);
    setQuestion("");

    try {
      const response = await fetch(getApiUrl("/.netlify/functions/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Extension-Request": "true",
        },
        body: JSON.stringify({
          transcript_id: activeTranscript.id,
          thread_id: activeTranscript.thread_id || activeTranscript.id,
          title: activeTranscript.title,
          question: nextQuestion,
          transcript_text: activeTranscript.transcript_text,
          messages: optimisticMessages,
        }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(payload.error || "Transcript chat failed.");
      }

      const assistantMessage = createMessage("assistant", payload.answer, payload.sources, payload.created_at);
      const completedItems = updateTranscriptRecord(optimisticItems, activeTranscript.id, {
        thread_id: payload.thread_id || activeTranscript.thread_id || activeTranscript.id,
        messages: [...optimisticMessages, assistantMessage],
      });
      setTranscripts(completedItems);
      writeHistory(completedItems);
    } catch (error) {
      const restoredItems = updateTranscriptRecord(transcripts, activeTranscript.id, {
        messages: activeTranscript.messages || [],
      });
      setTranscripts(restoredItems);
      writeHistory(restoredItems);
      setQuestion(nextQuestion);
      setMessageKind("error");
      setMessage(error.message || "Failed to answer question.");
    } finally {
      setChatLoading(false);
    }
  }

  async function copyTranscript() {
    if (!activeTranscript) return;
    try {
      await navigator.clipboard.writeText(activeTranscript.transcript_text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      setMessageKind("error");
      setMessage(error?.message || "Copy failed.");
    }
  }

  function deleteTranscript(id) {
    const nextItems = transcripts.filter((item) => item.id !== id);
    setTranscripts(nextItems);
    setActiveId(nextItems[0]?.id ?? null);
    writeHistory(nextItems);
  }

  return (
    <main className="extension-shell">
      <header className="extension-topbar">
        <div className="extension-brand">
          <img className="extension-logo" src={extensionLogo} alt="Transcript AI" />
          <div>
            <span className="extension-eyebrow">Chrome Side Panel</span>
            <strong>Transcript AI</strong>
          </div>
        </div>
        <div className="extension-actions">
          <button type="button" className="extension-btn" onClick={refreshCurrentTab} disabled={loadingVideo}>
            <RefreshCcw size={15} className={loadingVideo ? "spin" : ""} />
            Refresh
          </button>
          <button type="button" className="extension-btn" onClick={openAppInBrowser} disabled={!appBaseUrl}>
            <ExternalLink size={15} />
            Open
          </button>
        </div>
      </header>

      <section className="extension-status">
        <div className="status-chip">
          <Youtube size={15} />
          <span>{currentVideo?.videoId ? "YouTube video detected" : "No supported YouTube video detected"}</span>
        </div>
        {currentVideo?.url ? (
          <p className="status-url">{currentVideo.url}</p>
        ) : (
          <p className="status-url">Open a YouTube watch page, Shorts page, or youtu.be link, then refresh the panel.</p>
        )}
        <button
          type="button"
          className="primary-btn"
          onClick={handleTranscribe}
          disabled={loadingTranscript || !currentVideo?.url || !apiBaseUrl}
        >
          {loadingTranscript ? <Loader2 size={16} className="spin" /> : <Sparkles size={16} />}
          {loadingTranscript ? "Extracting" : "Transcribe current video"}
        </button>
        {!apiBaseUrl && <p className="status-url">Set `VITE_EXTENSION_API_BASE_URL` before building the extension.</p>}
        {message && <p className={`notice ${messageKind}`}>{message}</p>}
      </section>

      <section className="extension-body">
        <aside className="history-pane">
          <div className="pane-heading">
            <History size={16} />
            <strong>History</strong>
          </div>
          {transcripts.length === 0 ? (
            <p className="empty-copy">Your transcripts will appear here.</p>
          ) : (
            <div className="history-list">
              {transcripts.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`history-card ${item.id === activeTranscript?.id ? "active" : ""}`}
                  onClick={() => setActiveId(item.id)}
                >
                  <span>{item.title || item.video_id}</span>
                  <small>{formatDate(item.created_at)}</small>
                </button>
              ))}
            </div>
          )}
        </aside>

        <section className="content-pane">
          {!activeTranscript ? (
            <div className="empty-state">
              <Sparkles size={24} />
              <h2>Ready when the video is.</h2>
              <p>Detect a YouTube video, then extract the transcript here without signing in.</p>
            </div>
          ) : (
            <>
              <div className="result-header">
                <div>
                  <span className="extension-eyebrow">Transcript</span>
                  <h2>{activeTranscript.title || "Untitled video"}</h2>
                </div>
                <div className="inline-actions">
                  <button type="button" className="icon-btn" onClick={copyTranscript} aria-label="Copy transcript">
                    {copied ? <Check size={16} /> : <Clipboard size={16} />}
                  </button>
                  <button type="button" className="icon-btn" onClick={() => downloadTranscript(activeTranscript)} aria-label="Download transcript">
                    <Download size={16} />
                  </button>
                  <button type="button" className="icon-btn danger" onClick={() => deleteTranscript(activeTranscript.id)} aria-label="Delete transcript">
                    ×
                  </button>
                </div>
              </div>

              <a className="video-link" href={activeTranscript.video_url} target="_blank" rel="noreferrer">
                {activeTranscript.video_url}
              </a>
              <pre className="transcript-text">{activeTranscript.transcript_text}</pre>

              <section className="feature-card">
                <div className="feature-header">
                  <div>
                    <span className="extension-eyebrow">AI summary</span>
                    <h3>Summarize this transcript</h3>
                  </div>
                  <button type="button" className="extension-btn" onClick={handleSummarize} disabled={summaryLoading}>
                    {summaryLoading ? <Loader2 size={15} className="spin" /> : <FileText size={15} />}
                    {summaryLoading ? "Generating" : activeTranscript.summary ? "Regenerate" : "Generate"}
                  </button>
                </div>
                {activeTranscript.summary ? (
                  <p className="summary-copy">{activeTranscript.summary}</p>
                ) : (
                  <p className="empty-copy">Generate a summary for this transcript.</p>
                )}
              </section>

              <section className="feature-card">
                <div className="feature-header">
                  <div>
                    <span className="extension-eyebrow">Transcript chat</span>
                    <h3>Ask questions about this video</h3>
                  </div>
                  <MessageSquare size={16} />
                </div>

                <div className="chat-thread">
                  {(activeTranscript.messages || []).length === 0 ? (
                    <p className="empty-copy">Ask about takeaways, decisions, or details from the transcript.</p>
                  ) : (
                    activeTranscript.messages.map((item) => (
                      <article key={`${item.created_at}-${item.role}-${item.content.slice(0, 24)}`} className={`chat-bubble ${item.role}`}>
                        <strong>{item.role === "assistant" ? "Assistant" : "You"}</strong>
                        <p>{item.content}</p>
                      </article>
                    ))
                  )}
                </div>

                <form className="chat-form" onSubmit={handleAskQuestion}>
                  <textarea
                    rows={3}
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask a question about this transcript..."
                    disabled={chatLoading}
                  />
                  <button type="submit" className="primary-btn" disabled={chatLoading || !question.trim()}>
                    {chatLoading ? <Loader2 size={16} className="spin" /> : <Send size={16} />}
                    {chatLoading ? "Thinking" : "Ask"}
                  </button>
                </form>
              </section>
            </>
          )}
        </section>
      </section>
    </main>
  );
}

function getApiUrl(pathname) {
  return `${apiBaseUrl.replace(/\/$/, "")}${pathname}`;
}

function readHistory() {
  try {
    const rawItems = JSON.parse(localStorage.getItem(historyStorageKey) || "[]");
    return Array.isArray(rawItems) ? rawItems.map(sanitizeTranscript) : [];
  } catch {
    return [];
  }
}

function writeHistory(items) {
  localStorage.setItem(historyStorageKey, JSON.stringify(items.slice(0, 50).map(sanitizeTranscript)));
}

function updateTranscriptRecord(items, transcriptId, updates) {
  return items.map((item) => (item.id === transcriptId ? sanitizeTranscript({ ...item, ...updates }) : item));
}

function sanitizeTranscript(item) {
  if (!item || typeof item !== "object") return item;

  const videoId = item.video_id || extractYouTubeVideoId(item.video_url || "");
  return {
    ...item,
    video_id: videoId || item.video_id,
    transcript_text: getTranscriptText(item),
    summary: typeof item.summary === "string" ? item.summary : "",
    summary_model: typeof item.summary_model === "string" ? item.summary_model : "",
    summary_created_at: item.summary_created_at || "",
    thread_id: typeof item.thread_id === "string" ? item.thread_id : item.id,
    messages: sanitizeMessages(item.messages),
  };
}

function getTranscriptText(item) {
  if (!item) return "";
  const value = item.transcript_text;

  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value
      .map((segment) => {
        if (typeof segment === "string") return segment;
        if (segment && typeof segment === "object") return segment.text || segment.content || "";
        return "";
      })
      .filter(Boolean)
      .join(" ")
      .trim();
  }

  return "";
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];
  return messages
    .filter((message) => message && typeof message === "object")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: typeof message.content === "string" ? message.content : "",
      created_at: message.created_at || new Date().toISOString(),
      sources: Array.isArray(message.sources) ? message.sources : [],
    }))
    .filter((message) => message.content.trim());
}

function createMessage(role, content, sources = [], createdAt = new Date().toISOString()) {
  return {
    role,
    content,
    created_at: createdAt,
    sources: Array.isArray(sources) ? sources : [],
  };
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text) return {};

  try {
    return JSON.parse(text);
  } catch {
    return {
      error: response.ok ? "The server returned an unreadable response." : text,
    };
  }
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ExtensionApp />
  </React.StrictMode>,
);
