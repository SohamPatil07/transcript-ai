import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Check,
  Clipboard,
  Clock3,
  Download,
  ExternalLink,
  FileText,
  History,
  Link2,
  Loader2,
  Menu,
  MessageSquare,
  Play,
  RefreshCcw,
  Send,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import "../src/styles.css";
import "./sidepanel.css";
import {
  downloadTranscript,
  extractYouTubeVideoId,
  formatDate,
  normalizeYouTubeUrl,
} from "../src/utils";

const apiBaseUrl = (
  import.meta.env.VITE_EXTENSION_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
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
  const [url, setUrl] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("error");
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [question, setQuestion] = useState("");

  const activeTranscript = useMemo(
    () => transcripts.find((item) => item.id === activeId) ?? transcripts[0] ?? null,
    [activeId, transcripts],
  );
  const activeTranscriptText = useMemo(
    () => getTranscriptText(activeTranscript),
    [activeTranscript],
  );
  const activeMessages = useMemo(
    () => Array.isArray(activeTranscript?.messages) ? activeTranscript.messages : [],
    [activeTranscript],
  );

  useEffect(() => {
    const items = readHistory();
    setTranscripts(items);
    setActiveId(items[0]?.id ?? null);
    void refreshCurrentTab();
  }, []);

  useEffect(() => {
    if (!menuOpen) return undefined;
    function closeMenu(event) {
      if (!event.target.closest(".nav-menu-wrap")) setMenuOpen(false);
    }
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [menuOpen]);

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

      const nextUrl = normalizeYouTubeUrl(tab?.url || "");
      setUrl(extractYouTubeVideoId(nextUrl) ? nextUrl : "");
    } finally {
      setLoadingVideo(false);
    }
  }

  async function openAppInBrowser() {
    if (!appBaseUrl) return;
    const targetUrl = new URL(appBaseUrl);
    if (url) {
      targetUrl.searchParams.set("youtubeUrl", url);
    }
    await chrome.tabs.create({ url: targetUrl.toString() });
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setMessageKind("error");

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      setMessage("Paste a valid YouTube, Shorts, embed, live, or youtu.be link.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(getApiUrl("/.netlify/functions/transcribe"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Extension-Request": "true",
        },
        body: JSON.stringify({ url: normalizeYouTubeUrl(url) }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        throw new Error(payload.error || "Transcript request failed.");
      }

      const nextItems = [sanitizeTranscript(payload.transcription), ...transcripts.filter((item) => item.video_id !== payload.transcription.video_id)];
      setTranscripts(nextItems);
      setActiveId(payload.transcription.id);
      writeHistory(nextItems);
      setUrl("");
    } catch (error) {
      setMessage(error.message || "Failed to transcribe video.");
    } finally {
      setLoading(false);
    }
  }

  function deleteTranscript(id) {
    const nextItems = transcripts.filter((item) => item.id !== id);
    setTranscripts(nextItems);
    setActiveId(nextItems[0]?.id ?? null);
    writeHistory(nextItems);
  }

  async function copyTranscript() {
    if (!activeTranscript) return;
    try {
      await navigator.clipboard.writeText(activeTranscript.transcript_text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1400);
    } catch (error) {
      setMessageKind("error");
      setMessage(error?.message || "Copy failed. Please try again.");
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
      if (!response.ok) throw new Error(payload.error || "Summary request failed.");

      const nextItems = updateTranscriptRecord(transcripts, activeTranscript.id, {
        summary: payload.summary,
        summary_model: payload.model || activeTranscript.summary_model || "",
        summary_created_at: payload.created_at || activeTranscript.summary_created_at || new Date().toISOString(),
      });
      setTranscripts(nextItems);
      writeHistory(nextItems);
    } catch (error) {
      setMessageKind("error");
      setMessage(error.message || "Failed to summarize transcript.");
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
    const optimisticMessages = [...activeMessages, optimisticUserMessage];
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
      if (!response.ok) throw new Error(payload.error || "Transcript chat failed.");

      const assistantMessage = createMessage("assistant", payload.answer, payload.sources, payload.created_at);
      const completedItems = updateTranscriptRecord(optimisticItems, activeTranscript.id, {
        thread_id: payload.thread_id || activeTranscript.thread_id || activeTranscript.id,
        messages: [...optimisticMessages, assistantMessage],
      });
      setTranscripts(completedItems);
      writeHistory(completedItems);
    } catch (error) {
      const rolledBackItems = updateTranscriptRecord(transcripts, activeTranscript.id, {
        messages: activeMessages,
      });
      setTranscripts(rolledBackItems);
      writeHistory(rolledBackItems);
      setQuestion(nextQuestion);
      setMessageKind("error");
      setMessage(error.message || "Failed to answer question.");
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <main>
      <section className="offer-strip">
        <Sparkles size={16} />
        <span>Opened from the Chrome side panel. The current YouTube URL has been prefilled for you.</span>
      </section>

      <header className="topbar">
        <a className="brand" href="#" onClick={(event) => event.preventDefault()} aria-label="Transcript AI home">
          <span className="brand-mark">T</span>
          <span>Transcript AI</span>
        </a>

        <button className="pill-btn subtle extension-refresh" type="button" onClick={refreshCurrentTab} disabled={loadingVideo}>
          {loadingVideo ? <Loader2 className="spin" size={16} /> : <RefreshCcw size={16} />}
          Refresh
        </button>

        <div className="nav-menu-wrap">
          <button
            className="icon-btn menu-btn"
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setMenuOpen((value) => !value);
            }}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <Menu size={20} />
          </button>
          {menuOpen && (
            <nav className="nav-menu" aria-label="Extension menu">
              <button
                type="button"
                onClick={() => {
                  setHistoryOpen(true);
                  setMenuOpen(false);
                }}
              >
                <History size={17} />
                History
              </button>
              <button
                type="button"
                onClick={() => {
                  void openAppInBrowser();
                  setMenuOpen(false);
                }}
              >
                <ExternalLink size={17} />
                Open Web App
              </button>
            </nav>
          )}
        </div>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <span className="eyebrow">YouTube to clean text</span>
          <h1>Paste a video link. Get the transcript.</h1>
          <p>
            Paste any YouTube URL format and turn public captions into searchable text with history,
            downloads, and one-click copy.
          </p>
        </div>

        <form className="search-shell" onSubmit={handleSubmit}>
          <Link2 className="search-icon" size={22} />
          <input
            aria-label="YouTube video URL"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Paste YouTube URL, shorts link or video ID"
            autoComplete="off"
          />
          <button type="submit" disabled={loading || loadingVideo || !apiBaseUrl}>
            {loading ? <Loader2 className="spin" size={18} /> : <Play size={18} />}
            {loading ? "Extracting" : "Transcribe"}
          </button>
        </form>

        {message && <p className={`notice ${messageKind}`}>{message}</p>}

        {(loading || activeTranscript) && (
          <article className="hero-result" aria-live="polite">
            {loading ? (
              <div className="extracting-state">
                <Loader2 className="spin" size={22} />
                <span>Extracting transcript...</span>
              </div>
            ) : (
              <>
                <div className="hero-result-heading">
                  <div style={{ display: "flex", gap: "1rem", alignItems: "center" }}>
                    {activeTranscript.thumbnail_url && (
                      <img
                        src={activeTranscript.thumbnail_url}
                        alt={activeTranscript.title || "Video thumbnail"}
                        loading="lazy"
                        style={{
                          width: "120px",
                          aspectRatio: "16 / 9",
                          objectFit: "cover",
                          borderRadius: "16px",
                          flexShrink: 0,
                        }}
                      />
                    )}
                    <div>
                      <span className="eyebrow">Latest transcript</span>
                      <h2>{activeTranscript.title || "Untitled video"}</h2>
                    </div>
                  </div>
                  <div className="actions">
                    <button className="icon-btn" type="button" onClick={copyTranscript} aria-label="Copy transcript">
                      {copied ? <Check size={18} /> : <Clipboard size={18} />}
                    </button>
                    <button
                      className="icon-btn"
                      type="button"
                      onClick={() => downloadTranscript(activeTranscript)}
                      aria-label="Download transcript"
                    >
                      <Download size={18} />
                    </button>
                  </div>
                </div>
                <pre className="hero-transcript-text">{activeTranscriptText}</pre>
              </>
            )}
          </article>
        )}
      </section>

      <section className="workspace" aria-label="Transcription workspace">
        <aside className="history-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Library</span>
              <h2>History</h2>
            </div>
            <Clock3 size={19} />
          </div>
          <HistoryContent transcripts={transcripts} activeId={activeTranscript?.id} onSelect={setActiveId} />
        </aside>

        <article className="transcript-panel">
          {activeTranscript ? (
            <>
              <div className="result-heading">
                <div>
                  <span className="eyebrow">Transcript</span>
                  <h2>{activeTranscript.title || "Untitled video"}</h2>
                </div>
                <div className="actions">
                  <button className="icon-btn" type="button" onClick={copyTranscript} aria-label="Copy transcript">
                    {copied ? <Check size={18} /> : <Clipboard size={18} />}
                  </button>
                  <button
                    className="icon-btn"
                    type="button"
                    onClick={() => downloadTranscript(activeTranscript)}
                    aria-label="Download transcript"
                  >
                    <Download size={18} />
                  </button>
                  <button
                    className="icon-btn danger"
                    type="button"
                    onClick={() => deleteTranscript(activeTranscript.id)}
                    aria-label="Delete transcript"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>

              <a className="video-link" href={activeTranscript.video_url} target="_blank" rel="noreferrer">
                {activeTranscript.video_url}
              </a>
              {activeTranscript.thumbnail_url && (
                <img
                  src={activeTranscript.thumbnail_url}
                  alt={activeTranscript.title || "Video thumbnail"}
                  loading="lazy"
                  style={{
                    width: "100%",
                    maxWidth: "480px",
                    aspectRatio: "16 / 9",
                    objectFit: "cover",
                    borderRadius: "20px",
                    marginBottom: "1.25rem",
                    boxShadow: "0 18px 40px rgba(0, 0, 0, 0.12)",
                  }}
                />
              )}

              <pre className="transcript-text">{activeTranscriptText}</pre>

              <section className="ai-panel">
                <div className="ai-panel-header">
                  <div>
                    <span className="eyebrow">AI summary</span>
                    <h3>Summarize this transcript</h3>
                  </div>
                  <button
                    className="pill-btn secondary"
                    type="button"
                    onClick={handleSummarize}
                    disabled={summaryLoading}
                  >
                    {summaryLoading ? <Loader2 className="spin" size={16} /> : <FileText size={16} />}
                    {summaryLoading ? "Generating summary" : activeTranscript.summary ? "Regenerate summary" : "Generate summary"}
                  </button>
                </div>
                {activeTranscript.summary ? (
                  <div className="summary-card">
                    <p>{activeTranscript.summary}</p>
                  </div>
                ) : (
                  <p className="muted">Generate an on-demand summary for the current transcript.</p>
                )}
              </section>

              <section className="ai-panel">
                <div className="ai-panel-header">
                  <div>
                    <span className="eyebrow">Transcript chat</span>
                    <h3>Ask questions about this video</h3>
                  </div>
                  <MessageSquare size={18} />
                </div>

                <div className="chat-thread" aria-live="polite">
                  {activeMessages.length === 0 ? (
                    <p className="muted">
                      Ask for action items, decisions, key takeaways, or any detail grounded in the transcript.
                    </p>
                  ) : (
                    activeMessages.map((item) => (
                      <article
                        key={`${item.created_at}-${item.role}-${item.content.slice(0, 20)}`}
                        className={`chat-bubble ${item.role === "assistant" ? "assistant" : "user"}`}
                      >
                        <span className="chat-role">{item.role === "assistant" ? "Assistant" : "You"}</span>
                        <p>{item.content}</p>
                        {item.role === "assistant" && Array.isArray(item.sources) && item.sources.length > 0 && (
                          <div className="chat-sources">
                            {item.sources.map((source) => (
                              <div key={`${source.chunk_index}-${source.chunk_text.slice(0, 24)}`} className="source-chip">
                                <strong>Chunk {source.chunk_index}</strong>
                                <span>{source.chunk_text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </article>
                    ))
                  )}
                </div>

                <form className="chat-form" onSubmit={handleAskQuestion}>
                  <textarea
                    value={question}
                    onChange={(event) => setQuestion(event.target.value)}
                    placeholder="Ask a question about this transcript..."
                    rows={3}
                    disabled={chatLoading}
                  />
                  <button type="submit" disabled={chatLoading || !question.trim()}>
                    {chatLoading ? <Loader2 className="spin" size={16} /> : <Send size={16} />}
                    {chatLoading ? "Getting answer" : "Get answer"}
                  </button>
                </form>
              </section>
            </>
          ) : (
            <div className="empty-state">
              <Sparkles size={28} />
              <h2>Ready when the link is.</h2>
              <p>Your transcript, timestamps, and saved history will land here.</p>
            </div>
          )}
        </article>
      </section>

      {historyOpen && (
        <PanelModal title="History" eyebrow="Library" onClose={() => setHistoryOpen(false)}>
          <HistoryContent
            transcripts={transcripts}
            activeId={activeTranscript?.id}
            onSelect={(id) => {
              setActiveId(id);
              setHistoryOpen(false);
            }}
          />
        </PanelModal>
      )}
    </main>
  );
}

function PanelModal({ eyebrow, title, children, onClose }) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section className="panel-modal" role="dialog" aria-modal="true" aria-label={title}>
        <button className="close-btn" type="button" onClick={onClose} aria-label="Close">
          <X size={18} />
        </button>
        <span className="eyebrow">{eyebrow}</span>
        <h2>{title}</h2>
        {children}
      </section>
    </div>
  );
}

function HistoryContent({ transcripts, activeId, onSelect }) {
  if (transcripts.length === 0) return <p className="muted">Your first transcript will appear here.</p>;

  return (
    <div className="history-list modal-history-list">
      {transcripts.map((item) => (
        <button
          className={`history-item ${item.id === activeId ? "active" : ""}`}
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          style={{ alignItems: "stretch" }}
        >
          {item.thumbnail_url && (
            <img
              src={item.thumbnail_url}
              alt={item.title || "Video thumbnail"}
              loading="lazy"
              style={{
                width: "100%",
                aspectRatio: "16 / 9",
                objectFit: "cover",
                borderRadius: "14px",
                marginBottom: "0.85rem",
              }}
            />
          )}
          <span>{item.title || item.video_id}</span>
          <small>{formatDate(item.created_at)}</small>
        </button>
      ))}
    </div>
  );
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
    thumbnail_url: item.thumbnail_url || (videoId ? getThumbnailUrl(videoId) : ""),
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
  if (typeof value === "string") return formatTranscriptText(value);

  if (Array.isArray(value)) {
    return formatTranscriptText(
      value
        .map((segment) => {
          if (typeof segment === "string") return segment;
          if (segment && typeof segment === "object") return segment.text || segment.content || "";
          return "";
        })
        .filter(Boolean)
        .join(" "),
    );
  }

  if (value && typeof value === "object") {
    return formatTranscriptText(value.text || value.content || JSON.stringify(value, null, 2));
  }

  return "";
}

function getThumbnailUrl(videoId) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
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

function formatTranscriptText(value) {
  if (!value || typeof value !== "string") return "";

  return decodeHtmlEntities(value)
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/([.!?])\s+(?=[A-Z])/g, "$1\n\n")
    .trim();
}

function decodeHtmlEntities(value) {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = value;
  return textarea.value;
}

function sanitizeMessages(messages) {
  if (!Array.isArray(messages)) return [];

  return messages
    .filter((message) => message && typeof message === "object")
    .map((message) => ({
      role: message.role === "assistant" ? "assistant" : "user",
      content: typeof message.content === "string" ? message.content : "",
      created_at: message.created_at || new Date().toISOString(),
      sources: Array.isArray(message.sources)
        ? message.sources
          .filter((source) => source && typeof source === "object")
          .map((source) => ({
            chunk_index: source.chunk_index ?? 0,
            chunk_text: typeof source.chunk_text === "string" ? source.chunk_text : "",
          }))
          .filter((source) => source.chunk_text)
        : [],
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

function getApiUrl(pathname) {
  return `${apiBaseUrl.replace(/\/$/, "")}${pathname}`;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ExtensionApp />
  </React.StrictMode>,
);
