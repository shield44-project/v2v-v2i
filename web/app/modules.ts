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
    description: "Central operations view for emergency routing and system health.",
    highlights: [
      "Live incident timeline",
      "Route and junction visibility",
      "Cross-node coordination",
    ],
    primaryAction: "Open Control Console",
  },
  {
    slug: "emergency",
    title: "Emergency Vehicle",
    badge: "Priority Unit",
    description: "Mission panel for emergency crews and response actions.",
    highlights: [
      "Dispatch status channel",
      "ETA and route readiness",
      "Priority corridor controls",
    ],
    primaryAction: "Activate Emergency Mode",
  },
  {
    slug: "signal",
    title: "Traffic Signal",
    badge: "Infrastructure",
    description: "Signal orchestration panel for preemption and traffic flow.",
    highlights: [
      "Signal preemption state",
      "Approach detection markers",
      "Intersection command queue",
    ],
    primaryAction: "Open Signal Controls",
  },
  {
    slug: "vehicle1",
    title: "Vehicle 1",
    badge: "Civilian Node",
    description: "Connected civilian vehicle telemetry and awareness panel.",
    highlights: [
      "Nearby hazard channel",
      "Yield coordination prompts",
      "Lane awareness feed",
    ],
    primaryAction: "Open Vehicle 1 View",
  },
  {
    slug: "vehicle2",
    title: "Vehicle 2",
    badge: "Civilian Node",
    description: "Secondary civilian vehicle node for distributed monitoring.",
    highlights: [
      "Local alert stream",
      "Proximity guidance",
      "Fallback communication state",
    ],
    primaryAction: "Open Vehicle 2 View",
  },
  {
    slug: "admin",
    title: "Admin",
    badge: "Secure",
    description: "Administration workspace for access, policy, and controls.",
    highlights: [
      "Role and access review",
      "Policy and enforcement checks",
      "System configuration audit",
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
