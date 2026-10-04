export type Status =
  | { kind: "idle" }
  | { kind: "loading"; step: string }
  | { kind: "success"; instagramUrl?: string }
  | { kind: "error"; message: string };

export function Spinner() {
  return (
    <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
  );
}

export default function StatusMessage({ status, onRetry }: { status: Status; onRetry: () => void }) {
  if (status.kind === "idle") return null;

  if (status.kind === "loading") {
    return (
      <div className="flex items-center justify-center gap-3 text-zinc-300" aria-live="polite">
        <Spinner />
        <span>{status.step}</span>
      </div>
    );
  }

  if (status.kind === "success") {
    return (
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center" aria-live="polite">
        <p className="font-semibold text-emerald-400">✓ Reel published successfully</p>
        {status.instagramUrl && (
          <a
            href={status.instagramUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-sm text-indigo-300 underline hover:text-indigo-200"
          >
            View on Instagram
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center" aria-live="assertive">
      <p className="font-semibold text-red-400">✕ Failed to publish Reel</p>
      <p className="mt-1 text-sm text-zinc-300">{status.message}</p>
      <button
        onClick={onRetry}
        className="mt-3 rounded-full border border-white/15 px-5 py-1.5 text-sm text-white transition hover:bg-white/10"
      >
        Try Again
      </button>
    </div>
  );
}
