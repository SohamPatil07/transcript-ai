import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ClerkProvider,
  SignUpButton,
  SignedIn,
  SignedOut,
  UserButton,
  useAuth,
  useUser,
} from "@clerk/clerk-react";
import {
  Check,
  Clipboard,
  Clock3,
  Download,
  FileText,
  History,
  ImagePlus,
  Link2,
  Loader2,
  Menu,
  MessageSquare,
  Play,
  Save,
  Send,
  Sparkles,
  Trash2,
  User,
  X,
} from "lucide-react";
import {
  downloadTranscript,
  extractYouTubeVideoId,
  formatDate,
  normalizeYouTubeUrl,
} from "./utils";
import "./styles.css";

const clerkKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;
const apiBaseUrl = resolveApiBaseUrl();
const extensionContext = readExtensionContext();
const isDesktop = Boolean(window.desktopApp?.isDesktop);
const baseOrigin = window.location.origin;

// Listen for Electron load errors
if (window.desktopApp?.onLoadError) {
  window.desktopApp.onLoadError((error) => {
    console.error("Electron load error:", error);
    const root = document.getElementById("root");
    if (root) {
      root.innerHTML = `
        <div style="padding: 2rem; text-align: center; font-family: sans-serif;">
          <h2>Application Load Error</h2>
          <p>Error code: ${error.code}</p>
          <p>Description: ${error.description}</p>
          <p>Please check your internet connection or try restarting the application.</p>
          <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; cursor: pointer;">Reload</button>
        </div>
      `;
    }
  });
}

if (!clerkKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY in .env");
}

function App() {
  const { isLoaded, isSignedIn, getToken, userId } = useAuth();
  const { user } = useUser();
  const [url, setUrl] = useState("");
  const [transcripts, setTranscripts] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [messageKind, setMessageKind] = useState("error");
  const [menuOpen, setMenuOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileName, setProfileName] = useState("");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMessage, setProfileMessage] = useState("");
  const [profileMessageKind, setProfileMessageKind] = useState("success");
  const [copied, setCopied] = useState(false);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [chatLoading, setChatLoading] = useState(false);
  const [question, setQuestion] = useState("");

  const activeTranscript = useMemo(
    () => transcripts.find((item) => item.id === activeId) ?? transcripts[0],
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
    if (!isLoaded || !userId) {
      setTranscripts([]);
      setActiveId(null);
      return;
    }

    const items = readHistory(userId);
    setTranscripts(items);
    setActiveId(items[0]?.id ?? null);
  }, [isLoaded, userId]);

  useEffect(() => {
    if (!extensionContext.prefillUrl) return;
    if (url) return;
    setUrl(normalizeYouTubeUrl(extensionContext.prefillUrl));
  }, [url]);

  useEffect(() => {
    if (user) setProfileName(user.fullName || user.firstName || "");
  }, [user]);

  useEffect(() => {
    if (!menuOpen) return;
    function closeMenu(event) {
      if (!event.target.closest(".nav-menu-wrap")) setMenuOpen(false);
    }
    document.addEventListener("click", closeMenu);
    return () => document.removeEventListener("click", closeMenu);
  }, [menuOpen]);

  useEffect(() => {
    if (!message) return;
    const timeout = window.setTimeout(() => setMessage(""), 4000);
    return () => window.clearTimeout(timeout);
  }, [message]);

  useEffect(() => {
    if (!profileMessage) return;
    const timeout = window.setTimeout(() => setProfileMessage(""), 3500);
    return () => window.clearTimeout(timeout);
  }, [profileMessage]);

  async function handleSubmit(event) {
    event.preventDefault();
    setMessage("");
    setMessageKind("error");

    const videoId = extractYouTubeVideoId(url);
    if (!videoId) {
      setMessage("Paste a valid YouTube, Shorts, embed, live, or youtu.be link.");
      return;
    }

    if (!isSignedIn) {
      setMessage("Sign in to start your free transcription.");
      return;
    }

    setLoading(true);
    try {
      const token = await getToken();
      const response = await fetch(getApiUrl("/.netlify/functions/transcribe"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ url: normalizeYouTubeUrl(url) }),
      });
      const payload = await readJsonResponse(response);
      if (!response.ok) {
        let errorMsg = payload.error || "Transcript request failed.";
        
        // Check for transcript-specific errors
        if (payload.debug?.responseStructure && payload.debug.responseStructure.includes("NoTransc")) {
          errorMsg = "This video doesn't have available captions. Try another video that has captions enabled.";
        }
        
        if (payload.debug) {
          console.error("Debug info from server:", payload.debug);
        }
        throw new Error(errorMsg);
      }

      const nextItems = [sanitizeTranscript(payload.transcription), ...transcripts];
      setTranscripts(nextItems);
      setActiveId(payload.transcription.id);
      writeHistory(userId, nextItems);
      setUrl("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setLoading(false);
    }
  }

  function deleteTranscript(id) {
    const nextItems = transcripts.filter((item) => item.id !== id);
    setTranscripts(nextItems);
    setActiveId(nextItems[0]?.id ?? null);
    if (userId) writeHistory(userId, nextItems);
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

  async function updateProfile(event) {
    event.preventDefault();
    if (!user || profileSaving) return;

    setProfileSaving(true);
    setProfileMessage("");
    try {
      const [firstName, ...rest] = profileName.trim().split(/\s+/).filter(Boolean);
      await user.update({
        firstName: firstName || "",
        lastName: rest.join(" "),
      });
      await user.reload();
      setProfileMessageKind("success");
      setProfileMessage("Profile updated");
    } catch (error) {
      setProfileMessageKind("error");
      setProfileMessage(error?.message || "Profile update failed.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function uploadAvatar(event) {
    const file = event.target.files?.[0];
    if (!file || !user) return;

    setProfileSaving(true);
    setProfileMessage("");
    try {
      if (typeof user.setProfileImage !== "function") {
        throw new Error("Profile image upload is unavailable for this Clerk session.");
      }
      await user.setProfileImage({ file });
      await user.reload();
      setProfileMessageKind("success");
      setProfileMessage("Profile picture updated");
    } catch (error) {
      setProfileMessageKind("error");
      setProfileMessage(error?.message || "Profile picture update failed.");
    } finally {
      setProfileSaving(false);
    }
  }

  async function handleSummarize() {
    if (!activeTranscript || !isSignedIn || summaryLoading) return;

    setSummaryLoading(true);
    setMessage("");
    try {
      const token = await getToken();
      const response = await fetch(getApiUrl("/.netlify/functions/summarize"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
      if (userId) writeHistory(userId, nextItems);
    } catch (error) {
      setMessageKind("error");
      setMessage(error.message || "Failed to summarize transcript.");
    } finally {
      setSummaryLoading(false);
    }
  }

  async function handleAskQuestion(event) {
    event.preventDefault();
    if (!activeTranscript || !isSignedIn || chatLoading) return;

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
    if (userId) writeHistory(userId, optimisticItems);
    setQuestion("");

    try {
      const token = await getToken();
      const response = await fetch(getApiUrl("/.netlify/functions/chat"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
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
      if (userId) writeHistory(userId, completedItems);
    } catch (error) {
      const rolledBackItems = updateTranscriptRecord(transcripts, activeTranscript.id, {
        messages: activeMessages,
      });
      setTranscripts(rolledBackItems);
      if (userId) writeHistory(userId, rolledBackItems);
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
        <span>
          {extensionContext.isEmbedded
            ? "Opened from the Chrome side panel. The current YouTube URL has been prefilled for you."
            : "Logged-in users get unlimited transcription access for the next 7 days."}
        </span>
      </section>

      <header className="topbar">
        <a className="brand" href="/" aria-label="Transcript AI home">
          <span className="brand-mark">T</span>
          <span>Transcript AI</span>
        </a>

        <div className="account">
          <SignedOut>
            <SignUpButton mode={isDesktop || extensionContext.isEmbedded ? "redirect" : "modal"}>
              <button className="pill-btn" type="button">
                Login
              </button>
            </SignUpButton>
          </SignedOut>
          <SignedIn>
            <UserButton afterSignOutUrl="/" />
          </SignedIn>
        </div>

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
            <nav className="nav-menu" aria-label="App menu">
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
                  setProfileOpen(true);
                  setMenuOpen(false);
                }}
              >
                <User size={17} />
                Profile
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
          <button type="submit" disabled={loading || !isLoaded}>
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
          <HistoryContent
            isSignedIn={isSignedIn}
            transcripts={transcripts}
            activeId={activeTranscript?.id}
            onSelect={setActiveId}
          />
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
                    disabled={summaryLoading || !isSignedIn}
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
                    disabled={!isSignedIn || chatLoading}
                  />
                  <button type="submit" disabled={!isSignedIn || chatLoading || !question.trim()}>
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
            isSignedIn={isSignedIn}
            transcripts={transcripts}
            activeId={activeTranscript?.id}
            onSelect={(id) => {
              setActiveId(id);
              setHistoryOpen(false);
            }}
          />
        </PanelModal>
      )}

      {profileOpen && (
        <PanelModal title="Profile" eyebrow="Account" onClose={() => setProfileOpen(false)}>
          {!isSignedIn ? (
            <div className="profile-locked">
              <p className="muted">Sign in to view and update your profile.</p>
              <SignUpButton mode="modal">
                <button className="pill-btn" type="button">Login</button>
              </SignUpButton>
            </div>
          ) : (
            <>
              {profileMessage && <p className={`notice auth-notice ${profileMessageKind}`}>{profileMessage}</p>}
              <form className="profile-form" onSubmit={updateProfile}>
                <div className="avatar-edit">
                  {user?.imageUrl ? (
                    <img src={user.imageUrl} alt="Profile" />
                  ) : (
                    <span>
                      <User size={34} />
                    </span>
                  )}
                  <label className="upload-btn">
                    <ImagePlus size={17} />
                    Add picture
                    <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={uploadAvatar} />
                  </label>
                </div>
                <label>
                  Name
                  <input value={profileName} onChange={(event) => setProfileName(event.target.value)} />
                </label>
                <label>
                  Email
                  <input value={user?.primaryEmailAddress?.emailAddress || ""} disabled />
                </label>
                <button type="submit" disabled={profileSaving}>
                  {profileSaving ? <Loader2 className="spin" size={17} /> : <Save size={17} />}
                  Save profile
                </button>
              </form>
            </>
          )}
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

function HistoryContent({ isSignedIn, transcripts, activeId, onSelect }) {
  if (!isSignedIn) return <p className="muted">Sign in to save and revisit transcriptions.</p>;
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

function readHistory(userId) {
  try {
    const rawItems = JSON.parse(localStorage.getItem(historyKey(userId)) || "[]");
    return Array.isArray(rawItems) ? rawItems.map(sanitizeTranscript) : [];
  } catch {
    return [];
  }
}

function writeHistory(userId, items) {
  localStorage.setItem(historyKey(userId), JSON.stringify(items.slice(0, 50).map(sanitizeTranscript)));
}

function historyKey(userId) {
  return `transcript-ai:history:${userId}`;
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

function readExtensionContext() {
  try {
    const params = new URLSearchParams(window.location.search);
    return {
      isEmbedded: params.get("embed") === "sidepanel",
      prefillUrl: params.get("youtubeUrl") || "",
    };
  } catch {
    return {
      isEmbedded: false,
      prefillUrl: "",
    };
  }
}

function getApiUrl(pathname) {
  if (!apiBaseUrl) return pathname;
  return `${apiBaseUrl.replace(/\/$/, "")}${pathname}`;
}

function resolveApiBaseUrl() {
  const desktopBaseUrl = window.desktopApp?.apiBaseUrl;
  if (typeof desktopBaseUrl === "string" && desktopBaseUrl.trim()) {
    return desktopBaseUrl.trim();
  }

  const viteBaseUrl = import.meta.env.VITE_API_BASE_URL;
  if (typeof viteBaseUrl === "string" && viteBaseUrl.trim()) {
    return viteBaseUrl.trim();
  }

  return "";
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ClerkProvider publishableKey={clerkKey} afterSignOutUrl="/">
      <App />
    </ClerkProvider>
  </React.StrictMode>,
);
