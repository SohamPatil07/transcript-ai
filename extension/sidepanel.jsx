import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { ExternalLink, RefreshCcw, Youtube } from "lucide-react";
import "./sidepanel.css";
import extensionLogo from "../Transcript-AI-Logo.png";

const appBaseUrl = (
  import.meta.env.VITE_EXTENSION_APP_URL ||
  import.meta.env.VITE_EXTENSION_API_BASE_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  ""
).trim();

function ExtensionApp() {
  const [currentVideo, setCurrentVideo] = useState(null);
  const [loadingVideo, setLoadingVideo] = useState(true);
  const [frameKey, setFrameKey] = useState(0);
  const embeddedAppUrl = useMemo(() => createEmbeddedAppUrl(appBaseUrl, currentVideo?.url || ""), [currentVideo]);

  useEffect(() => {
    void refreshCurrentTab();
  }, []);

  async function refreshCurrentTab() {
    setLoadingVideo(true);
    try {
      const [tab] = await chrome.tabs.query({
        active: true,
        lastFocusedWindow: true,
      });

      const nextVideo = describeVideoFromUrl(tab?.url || "");
      setCurrentVideo(nextVideo);
      setFrameKey((value) => value + 1);
    } finally {
      setLoadingVideo(false);
    }
  }

  async function openAppInBrowser() {
    if (!embeddedAppUrl) return;
    await chrome.tabs.create({ url: embeddedAppUrl });
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
          <button type="button" className="extension-btn" onClick={openAppInBrowser} disabled={!embeddedAppUrl}>
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
      </section>

      {embeddedAppUrl ? (
        <iframe
          key={frameKey}
          className="app-frame"
          src={embeddedAppUrl}
          title="Transcript AI"
          allow="clipboard-read; clipboard-write"
        />
      ) : (
        <section className="empty-frame">
          <p>Set `VITE_EXTENSION_APP_URL` in your `.env` so the side panel can load your existing web app.</p>
        </section>
      )}
    </main>
  );
}

function createEmbeddedAppUrl(baseUrl, currentVideoUrl) {
  if (!baseUrl) return "";

  try {
    const url = new URL(baseUrl);
    url.searchParams.set("embed", "sidepanel");
    if (currentVideoUrl) {
      url.searchParams.set("youtubeUrl", currentVideoUrl);
    }
    return url.toString();
  } catch {
    return "";
  }
}

function describeVideoFromUrl(rawUrl) {
  const videoId = extractYouTubeVideoId(rawUrl);
  return {
    url: videoId ? normalizeYouTubeUrl(rawUrl) : "",
    videoId,
  };
}

function extractYouTubeVideoId(rawUrl) {
  if (!rawUrl) return null;
  const value = String(rawUrl).trim();
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

function normalizeYouTubeUrl(rawUrl) {
  const videoId = extractYouTubeVideoId(rawUrl);
  return videoId ? `https://www.youtube.com/watch?v=${videoId}` : rawUrl;
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ExtensionApp />
  </React.StrictMode>,
);
