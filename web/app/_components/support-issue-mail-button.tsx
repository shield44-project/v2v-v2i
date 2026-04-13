"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";

const REPO_ISSUES_URL = "https://github.com/shield44-project/v2v-v2i/issues/new/choose";

export default function SupportIssueMailButton() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";
  const appVersion = process.env.NEXT_PUBLIC_APP_VERSION?.trim() || "dev";
  const isConfigured = Boolean(supportEmail);

  const scenario = typeof window === "undefined" ? "n/a" : localStorage.getItem("v2x-demo-scenario") || "n/a";

  const openMailto = () => {
    if (!isConfigured) return;
    const now = new Date().toISOString();
    const debug = typeof window !== "undefined" ? localStorage.getItem("v2x-debug-info") : null;
    const subject = encodeURIComponent(`[V2X ${appVersion}] Issue report: ${pathname}`);
    const body = encodeURIComponent(
      [
        "Please describe the issue below:",
        "- What happened:",
        "- Expected:",
        "",
        "Auto-filled context:",
        `- App version: ${appVersion}`,
        `- Scenario: ${scenario}`,
        `- Page: ${pathname}`,
        `- Time (UTC): ${now}`,
        `- Browser: ${typeof navigator !== "undefined" ? navigator.userAgent : "n/a"}`,
        debug ? `- Debug: ${debug}` : "",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
    setOpen(false);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-zinc-950/90 px-4 py-2 text-xs font-semibold text-cyan-200 shadow-[0_0_16px_rgba(0,229,255,0.2)] backdrop-blur"
      >
        <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-300" />
        Report Issue
      </button>
      {open && (
        <div className="mt-2 min-w-[260px] rounded-xl border border-zinc-700 bg-zinc-950/95 p-3 text-xs text-zinc-300 shadow-2xl backdrop-blur">
          <p className="mb-2 text-zinc-400">v{appVersion} · scenario: {scenario}</p>
          <button
            type="button"
            onClick={openMailto}
            disabled={!isConfigured}
            className="mb-2 w-full rounded-md border border-cyan-500/40 bg-cyan-500/10 px-3 py-2 text-left text-cyan-200 disabled:cursor-not-allowed disabled:opacity-50"
            title={isConfigured ? "Open prefilled mail compose" : "Set NEXT_PUBLIC_SUPPORT_EMAIL to enable mailto"}
          >
            Email Support (mailto)
          </button>
          <a
            href={REPO_ISSUES_URL}
            target="_blank"
            rel="noreferrer"
            className="block w-full rounded-md border border-zinc-700 bg-black/40 px-3 py-2 text-left text-zinc-200 hover:border-zinc-500"
            onClick={() => setOpen(false)}
          >
            Open GitHub Issues
          </a>
        </div>
      )}
    </div>
  );
}
