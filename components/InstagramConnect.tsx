"use client";

import { useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";

type Account = { connected: boolean; username?: string } | null;

/** Shows the Connect button until an account is connected, then renders `children`. */
export default function InstagramConnect({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<Account>(null);

  useEffect(() => {
    // Show the OAuth result once, then clean the URL.
    const result = new URLSearchParams(window.location.search).get("instagram");
    if (result === "connected") toast.success("Instagram connected");
    if (result === "error") toast.error("Could not connect Instagram. Please try again.");
    if (result === "not_configured") {
      toast.error("This app is not set up yet. The site owner needs to add the Instagram app ID and secret.");
    }
    if (result) window.history.replaceState(null, "", "/");

    fetch("/api/instagram/status", { cache: "no-store" })
      .then((res) => res.json())
      .then(setAccount)
      .catch(() => setAccount({ connected: false }));
  }, []);

  if (!account) {
    return <div className="mx-auto h-14 w-full animate-pulse rounded-full bg-white/5" />;
  }

  if (account.connected) {
    return (
      <>
        <div className="text-center">
          <p className="font-medium text-emerald-400">Instagram Connected ✓</p>
          <p className="text-sm text-zinc-400">@{account.username}</p>
        </div>
        {children}
      </>
    );
  }

  return (
    <div className="space-y-4 text-center">
      <p className="text-zinc-300">First, connect your Instagram account.</p>
      <a
        href="/api/instagram/connect"
        className="block w-full rounded-full bg-gradient-to-r from-blue-600 to-purple-600 py-4 text-lg font-bold text-white shadow-lg shadow-purple-900/30 transition hover:from-blue-500 hover:to-purple-500"
      >
        Connect Instagram
      </a>
      <p className="text-sm text-zinc-500">
        You&apos;ll log in on Instagram&apos;s own secure page with your number and password.
        This app never sees your password.
      </p>
    </div>
  );
}
