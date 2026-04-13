export type ModuleDefinition = {
  slug: string;
  title: string;
  badge: string;
  description: string;
  highlights: string[];
  primaryAction: string;
};

export const moduleDefinitions: ModuleDefinition[] = [
  {
    slug: "control",
    title: "Control Center",
    badge: "Operations",
    description: "Central admin operations view with live map, V2V/V2I zones, and event analytics.",
    highlights: [
      "Leaflet + OpenStreetMap telemetry",
      "V2V 25m and V2I 50m overlays",
      "Logs and node health monitoring",
    ],
    primaryAction: "Open Control Console",
  },
  {
    slug: "emergency",
    title: "Emergency Vehicle",
    badge: "Priority Unit",
    description: "Emergency vehicle broadcast module with GPS smoothing and predictive routing.",
    highlights: [
      "Kalman filter ON/OFF",
      "1s realtime GPS broadcast",
      "V2V proximity monitoring",
      "AI risk and yield guidance",
    ],
    primaryAction: "Activate Emergency Mode",
  },
  {
    slug: "signal",
    title: "Traffic Signal",
    badge: "Infrastructure",
    description: "4-way traffic signal with dynamic emergency override logic.",
    highlights: [
      "Heading-aware EV priority",
      "50m V2I detection radius",
      "Normal vs override cycle",
      "AI signal risk copilot",
    ],
    primaryAction: "Open Signal Controls",
  },
  {
    slug: "vehicle1",
    title: "Vehicle 1",
    badge: "Civilian Node",
    description: "Civilian V2V module with high-accuracy EV proximity detection.",
    highlights: [
      "Vincenty distance tracking",
      "Yield direction guidance",
      "Siren warning alerts",
    ],
    primaryAction: "Open Vehicle 1 View",
  },
  {
    slug: "vehicle2",
    title: "Vehicle 2",
    badge: "Civilian Node",
    description: "Secondary civilian V2V node with synchronized emergency awareness.",
    highlights: [
      "Realtime EV detection",
      "Warning/normal state",
      "Fallback sync support",
    ],
    primaryAction: "Open Vehicle 2 View",
  },
  {
    slug: "admin",
    title: "Admin Control Center",
    badge: "Secure",
    description: "Administration workspace for access, policy, and controls.",
    highlights: [
      "Role and access review",
      "Policy and enforcement checks",
      "System configuration audit",
      "AI incident forecasting panel",
    ],
    primaryAction: "Open Admin Workspace",
  },
  {
    slug: "admin-preview",
    title: "Admin Preview",
    badge: "Read-only",
    description: "High-level read-only summary for stakeholder visibility.",
    highlights: [
      "Operational snapshot",
      "Read-only KPI tiles",
      "Critical alerts overview",
    ],
    primaryAction: "Open Preview",
  },
  {
    slug: "user-portal",
    title: "User Portal",
    badge: "Access",
    description: "Operator-facing portal for quick role and mission access.",
    highlights: [
      "Role handoff panel",
      "Session and identity view",
      "Operator activity summary",
    ],
    primaryAction: "Open User Portal",
  },
];

export function getModuleBySlug(slug: string): ModuleDefinition | undefined {
  return moduleDefinitions.find((moduleItem) => moduleItem.slug === slug);
}
