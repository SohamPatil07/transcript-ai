export function extractYouTubeVideoId(rawUrl) {
  if (!rawUrl) return null;
  const value = rawUrl.trim();

  if (/^[a-zA-Z0-9_-]{11}$/.test(value)) return value;

  try {
    const url = new URL(value.includes("://") ? value : `https://${value}`);
    const host = url.hostname.replace(/^www\./, "");

    if (host === "youtu.be") {
      return sanitizeId(url.pathname.split("/").filter(Boolean)[0]);
    }

    if (host.endsWith("youtube.com") || host.endsWith("youtube-nocookie.com")) {
      if (url.searchParams.get("v")) return sanitizeId(url.searchParams.get("v"));

      const parts = url.pathname.split("/").filter(Boolean);
      const knownPrefixes = ["shorts", "embed", "live", "v"];
      if (knownPrefixes.includes(parts[0])) return sanitizeId(parts[1]);
    }
  } catch {
    return null;
  }

  return null;
}

export function normalizeYouTubeUrl(rawUrl) {
  const id = extractYouTubeVideoId(rawUrl);
  return id ? `https://www.youtube.com/watch?v=${id}` : rawUrl.trim();
}

export function formatDate(value) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function segmentTime(value = 0) {
  const seconds = value > 1000 ? Math.floor(value / 1000) : Math.floor(value);
  const mins = String(Math.floor(seconds / 60)).padStart(2, "0");
  const secs = String(seconds % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

export function downloadTranscript(item) {
  const body = [
    item.title,
    item.video_url,
    "",
    item.transcript_text,
  ].join("\n");
  const blob = new Blob([body], { type: "text/plain;charset=utf-8" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `${item.video_id || "youtube"}-transcript.txt`;
  link.click();
  URL.revokeObjectURL(link.href);
}

function sanitizeId(value) {
  const match = value?.match(/[a-zA-Z0-9_-]{11}/);
  return match?.[0] ?? null;
}
