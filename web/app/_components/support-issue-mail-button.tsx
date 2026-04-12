"use client";

import { usePathname } from "next/navigation";

/**
 * Opens the user's mail client with a prefilled support issue report.
 */
export default function SupportIssueMailButton() {
  const pathname = usePathname();
  const supportEmail = process.env.NEXT_PUBLIC_SUPPORT_EMAIL?.trim() || "";
  const isConfigured = Boolean(supportEmail);

  const handleReport = () => {
    if (!isConfigured) {
      return;
    }

    const now = new Date().toISOString();
    const subject = encodeURIComponent(`V2X Support Issue: ${pathname}`);
    const body = encodeURIComponent(
      [
        "Issue details:",
        "- What broke:",
        "- Expected behavior:",
        "- Actual behavior:",
        "",
        "Context (auto-filled):",
        `- Page: ${pathname}`,
        `- Time (UTC): ${now}`,
        `- Browser: ${navigator.userAgent}`,
      ].join("\n"),
    );

    window.location.href = `mailto:${supportEmail}?subject=${subject}&body=${body}`;
  };

  return (
    <button
      type="button"
      className="fixed bottom-4 right-4 z-50 rounded-full border border-zinc-600 bg-zinc-900 px-4 py-2 text-sm font-semibold text-zinc-100 shadow-lg transition hover:border-zinc-300 hover:bg-zinc-800"
      onClick={handleReport}
      aria-label="Report issue by email"
      disabled={!isConfigured}
      title={
        isConfigured
          ? "Send issue report by email"
          : "Set NEXT_PUBLIC_SUPPORT_EMAIL to enable issue reporting"
      }
    >
      {isConfigured ? "Report Issue" : "Issue Email Not Configured"}
    </button>
  );
}
