export type ArchiveStat = {
  label: string;
  value: string;
  tone: "cyan" | "blue" | "amber" | "green" | "rose";
};

export type ArchiveSection = {
  heading: string;
  body: string;
};

export type ArchivePage = {
  slug: string;
  badge: string;
  title: string;
  subtitle: string;
  summary: string;
  stats: ArchiveStat[];
  sections: ArchiveSection[];
  sourcePaths: string[];
  ctaLabel: string;
  ctaHref: string;
};

export const archivePages: ArchivePage[] = [
  {
    slug: "index",
    badge: "Archive Hub",
    title: "Legacy landing console",
    subtitle: "A TypeScript archive view of the old V2X landing page, rebuilt as a guided snapshot instead of raw HTML.",
    summary: "The original HTML home screen bundled app launchers, stats strips, and system badges. The TSX version keeps the information architecture but presents it as an archive.",
    stats: [
      { label: "App launchers", value: "5", tone: "cyan" },
      { label: "Archived routes", value: "10", tone: "blue" },
      { label: "Theme", value: "Dark glass", tone: "amber" }
    ],
    sections: [
      { heading: "What was preserved", body: "Route launcher cards, signal coordination copy, and the old system topology remain visible for reference." },
      { heading: "What changed", body: "The raw HTML layout was replaced with a Next.js page, shared data model, and cleaner archive copy." }
    ],
    sourcePaths: ["archive/legacy/public-static/index.md", "archive/legacy/root-snapshot/index.md"],
    ctaLabel: "Open current app",
    ctaHref: "/"
  },
  {
    slug: "login",
    badge: "Auth Snapshot",
    title: "Legacy sign-in gateway",
    subtitle: "The old login flow has been captured as a TSX page with its archive-only demo state disabled.",
    summary: "This page used to manage Google sign-in, admin fallback, and session redirects. It now serves as a historical reference with the production-only text removed.",
    stats: [
      { label: "Flow", value: "Popup + redirect", tone: "cyan" },
      { label: "Fallback", value: "Disabled", tone: "rose" },
      { label: "Routes", value: "/control", tone: "green" }
    ],
    sections: [
      { heading: "Preserved behavior", body: "Google sign-in, session checking, and role-based redirects are documented in the snapshot." },
      { heading: "Archive note", body: "The demo credential path is removed from the archive source so no reusable secret remains in the page." }
    ],
    sourcePaths: ["archive/legacy/public-static/login.md", "archive/legacy/root-snapshot/login.md"],
    ctaLabel: "Open login route",
    ctaHref: "/login"
  },
  {
    slug: "user-portal",
    badge: "Role Hub",
    title: "User portal snapshot",
    subtitle: "Role selection is preserved as a routed TypeScript view with archive commentary and stronger typography.",
    summary: "The old user portal handed off to emergency, signal, and civilian vehicle roles. The archive version keeps that structure but makes the page clearly historical.",
    stats: [
      { label: "Role choices", value: "4", tone: "blue" },
      { label: "Navigation", value: "Active", tone: "cyan" },
      { label: "Status", value: "Archived", tone: "amber" }
    ],
    sections: [
      { heading: "Role selection", body: "Emergency vehicle, signal node, and civilian vehicle entry points remain visible as a historical route map." },
      { heading: "UI shape", body: "The portal now uses the shared archive shell rather than the old standalone HTML card system." }
    ],
    sourcePaths: ["archive/legacy/public-static/user-portal.md", "archive/legacy/root-snapshot/user-portal.md"],
    ctaLabel: "Open portal route",
    ctaHref: "/user-portal"
  },
  {
    slug: "admin-preview",
    badge: "Public Preview",
    title: "Admin stats preview",
    subtitle: "A cleaned-up TypeScript snapshot of the public admin metrics page with archive-safe wording.",
    summary: "This page originally exposed live counters and onboarding help. It now presents the same structure as a static historical preview.",
    stats: [
      { label: "Preview type", value: "Public", tone: "cyan" },
      { label: "Counters", value: "Static", tone: "blue" },
      { label: "Docs", value: "Neutralized", tone: "rose" }
    ],
    sections: [
      { heading: "Preview content", body: "The admin overview, status cards, and FAQ sections are kept as readable historical context." },
      { heading: "Cleanup", body: "Private contacts and dead archive links were removed before the page was ported to TSX." }
    ],
    sourcePaths: ["archive/legacy/public-static/admin-preview.md", "archive/legacy/root-snapshot/admin-preview.md"],
    ctaLabel: "Open preview route",
    ctaHref: "/admin-preview"
  },
  {
    slug: "admin",
    badge: "Admin Ops",
    title: "Admin management panel",
    subtitle: "The zero-flash admin panel is now represented as a TypeScript snapshot with a richer, softer archive visual system.",
    summary: "The original HTML admin page handled user promotion, banning, and admin verification. The archived TSX version keeps the admin story without pretending to be live.",
    stats: [
      { label: "Access", value: "Protected", tone: "rose" },
      { label: "Actions", value: "Manage", tone: "cyan" },
      { label: "Theme", value: "Archive", tone: "amber" }
    ],
    sections: [
      { heading: "What it covered", body: "Add, promote, demote, ban, and review user accounts from a single admin surface." },
      { heading: "How it reads now", body: "The interface is documented as an archived management panel rather than a current production screen." }
    ],
    sourcePaths: ["archive/legacy/public-static/admin.md", "archive/legacy/root-snapshot/admin.md"],
    ctaLabel: "Open admin route",
    ctaHref: "/admin"
  },
  {
    slug: "control",
    badge: "Operations",
    title: "Control center snapshot",
    subtitle: "The map-heavy control dashboard is now a TSX archive page with a structured summary of its live-era features.",
    summary: "This was the most complex legacy HTML page. The archive route keeps its map, ranges, unit cards, and metrics in a cleaned-up TypeScript layout.",
    stats: [
      { label: "Map layer", value: "Leaflet", tone: "cyan" },
      { label: "Panels", value: "Units + logs", tone: "blue" },
      { label: "State", value: "Archived", tone: "amber" }
    ],
    sections: [
      { heading: "Operational focus", body: "Unit tracking, GPS updates, signal controls, and admin-side telemetry are retained as documentation." },
      { heading: "Archive translation", body: "Live metrics and real-time labels were rewritten so the screen reads as a preserved control room rather than an active dispatch console." }
    ],
    sourcePaths: ["archive/legacy/public-static/control.md", "archive/legacy/root-snapshot/control.md"],
    ctaLabel: "Open control route",
    ctaHref: "/control"
  },
  {
    slug: "emergency",
    badge: "Role Node",
    title: "Emergency vehicle snapshot",
    subtitle: "The emergency role page is preserved as a TypeScript archive with the same role, GPS, and signal story.",
    summary: "The old emergency HTML focused on siren state, GPS accuracy, and coordination status. The TSX archive keeps the narrative and removes the live-system framing.",
    stats: [
      { label: "Role", value: "Emergency", tone: "rose" },
      { label: "GPS", value: "Kalman", tone: "cyan" },
      { label: "Distance", value: "Vincenty", tone: "amber" }
    ],
    sections: [
      { heading: "Preserved flows", body: "Mode selection, GPS acquisition, and event logging are still represented in the page content." },
      { heading: "Archive wording", body: "The page now reads as a snapshot, so it is clear the interactions are historical documentation." }
    ],
    sourcePaths: ["archive/legacy/public-static/emergency.md", "archive/legacy/root-snapshot/emergency.md"],
    ctaLabel: "Open emergency route",
    ctaHref: "/emergency"
  },
  {
    slug: "signal",
    badge: "Role Node",
    title: "Traffic signal snapshot",
    subtitle: "The signal node has been ported to TypeScript as an archive page with a softer, clearer narrative.",
    summary: "The archived signal screen documents the V2I receiver, intersection control, and signal preemption logic without the live wording.",
    stats: [
      { label: "Role", value: "Signal", tone: "cyan" },
      { label: "Control", value: "Intersection", tone: "blue" },
      { label: "Status", value: "Archive", tone: "amber" }
    ],
    sections: [
      { heading: "Operational summary", body: "The page reflects intersection monitoring, signal state changes, and GPS-based preemption." },
      { heading: "Design goal", body: "The TypeScript version keeps the same structure but makes it easier to maintain and style consistently." }
    ],
    sourcePaths: ["archive/legacy/public-static/signal.md", "archive/legacy/root-snapshot/signal.md"],
    ctaLabel: "Open signal route",
    ctaHref: "/signal"
  },
  {
    slug: "vehicle1",
    badge: "Role Node",
    title: "Vehicle 1 snapshot",
    subtitle: "The first civilian V2V page is now expressed in TSX and framed as a historical route rather than a live node.",
    summary: "It still documents proximity warnings, GPS tracking, and yield behavior, but the page now fits the archive language used elsewhere.",
    stats: [
      { label: "Node", value: "V2V 1", tone: "blue" },
      { label: "Alerts", value: "Proximity", tone: "cyan" },
      { label: "Status", value: "Archive", tone: "amber" }
    ],
    sections: [
      { heading: "Vehicle flow", body: "The page captures how the civilian node reacted to emergency alerts and directional guidance." },
      { heading: "Archive note", body: "The legacy signals are preserved as an explanatory snapshot, not an active client." }
    ],
    sourcePaths: ["archive/legacy/public-static/vehicle1.md", "archive/legacy/root-snapshot/vehicle1.md"],
    ctaLabel: "Open vehicle 1 route",
    ctaHref: "/vehicle1"
  },
  {
    slug: "vehicle2",
    badge: "Role Node",
    title: "Vehicle 2 snapshot",
    subtitle: "The second civilian vehicle page is represented as a TypeScript archive with matching styling and content shape.",
    summary: "This route mirrors the second V2V participant and keeps the archived GPS, alert, and yield context intact.",
    stats: [
      { label: "Node", value: "V2V 2", tone: "blue" },
      { label: "Alerts", value: "Directional", tone: "cyan" },
      { label: "Status", value: "Archive", tone: "amber" }
    ],
    sections: [
      { heading: "Vehicle flow", body: "The page documents the second civilian node and its proximity logic in the legacy stack." },
      { heading: "Archive note", body: "The content is preserved in TypeScript so it can be styled and maintained alongside the rest of the app." }
    ],
    sourcePaths: ["archive/legacy/public-static/vehicle2.md", "archive/legacy/root-snapshot/vehicle2.md"],
    ctaLabel: "Open vehicle 2 route",
    ctaHref: "/vehicle2"
  }
];

export function getArchivePage(slug: string) {
  return archivePages.find((page) => page.slug === slug);
}
