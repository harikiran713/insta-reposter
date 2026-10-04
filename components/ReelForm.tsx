"use client";

import { useState, type FormEvent } from "react";
import { toast } from "sonner";
import StatusMessage, { Spinner, type Status } from "./StatusMessage";

const REEL_URL = /^https:\/\/(www\.)?instagram\.com\/([A-Za-z0-9._]+\/)?reels?\/[A-Za-z0-9_-]{5,}\/?(\?.*)?$/;

export default function ReelForm() {
  const [url, setUrl] = useState("");
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const loading = status.kind === "loading";

  async function submit(e?: FormEvent) {
    e?.preventDefault();
    if (loading) return;

    if (!REEL_URL.test(url.trim())) {
      const message = "Please enter a valid Instagram Reel URL.";
      setStatus({ kind: "error", message });
      toast.error(message);
      return;
    }

    // The server does everything in one request; these steps track its progress.
    setStatus({ kind: "loading", step: "Fetching Reel..." });
    const timers = [
      setTimeout(() => setStatus({ kind: "loading", step: "Preparing post..." }), 2000),
      setTimeout(() => setStatus({ kind: "loading", step: "Publishing to Instagram..." }), 3500),
    ];

    try {
      const res = await fetch("/api/reel/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      timers.forEach(clearTimeout);

      if (data.success) {
        setStatus({ kind: "success", instagramUrl: data.instagramUrl });
        toast.success("Reel published successfully");
        setUrl("");
      } else {
        const message = data.message ?? "Unable to publish Reel";
        setStatus({ kind: "error", message });
        toast.error(message);
      }
    } catch {
      timers.forEach(clearTimeout);
      const message = "Network error. Please check your connection.";
      setStatus({ kind: "error", message });
      toast.error(message);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-6">
      <label className="block">
        <span className="mb-2 block text-sm font-medium text-zinc-300">Paste Instagram Reel URL</span>
        <input
          type="url"
          inputMode="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://www.instagram.com/reel/..."
          disabled={loading}
          className="w-full rounded-full border border-white/10 bg-zinc-900 px-6 py-4 text-white placeholder-zinc-500 outline-none transition focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 disabled:opacity-60"
        />
      </label>

      <button
        type="submit"
        disabled={loading || !url.trim()}
        className="flex w-full items-center justify-center gap-3 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 py-4 text-lg font-bold tracking-wide text-white shadow-lg shadow-purple-900/30 transition hover:from-blue-500 hover:to-purple-500 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {loading && <Spinner />}
        POST REEL
      </button>

      <StatusMessage status={status} onRetry={() => submit()} />
    </form>
  );
}
