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
    if (!isConfigured) return;

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
      onClick={handleReport}
      disabled={!isConfigured}
      aria-label="Report issue by email"
      title={
        isConfigured
          ? "Send issue report by email"
          : "Set NEXT_PUBLIC_SUPPORT_EMAIL to enable issue reporting"
      }
      style={{
        position: "fixed",
        bottom: "1.25rem",
        right: "1.25rem",
        zIndex: 50,
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        padding: "8px 16px",
        borderRadius: "9999px",
        border: "1px solid rgba(0,229,255,0.3)",
        background: "rgba(0,229,255,0.06)",
        color: isConfigured ? "#67e8f9" : "#71717a",
        fontSize: "0.8rem",
        fontWeight: 600,
        cursor: isConfigured ? "pointer" : "default",
        backdropFilter: "blur(8px)",
        transition: "all 0.2s ease",
        boxShadow: isConfigured ? "0 0 12px rgba(0,229,255,0.1)" : "none",
      }}
      onMouseEnter={(e) => {
        if (!isConfigured) return;
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.6)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 20px rgba(0,229,255,0.2)";
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.1)";
      }}
      onMouseLeave={(e) => {
        if (!isConfigured) return;
        (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(0,229,255,0.3)";
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 0 12px rgba(0,229,255,0.1)";
        (e.currentTarget as HTMLButtonElement).style.background = "rgba(0,229,255,0.06)";
      }}
    >
      {isConfigured && (
        <span
          style={{
            width: 6,
            height: 6,
            borderRadius: "50%",
            background: "#00e5ff",
            boxShadow: "0 0 6px #00e5ff",
            animation: "glowPulse 2s ease-in-out infinite",
            flexShrink: 0,
          }}
        />
      )}
      {isConfigured ? "Report Issue" : "Issue Email Not Configured"}
    </button>
  );
}
