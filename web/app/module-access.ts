import { ADMIN_EMAILS_HARDCODED } from "@/lib/v2x/admin";
import type { ModuleDefinition } from "@/app/modules";

export const NORMAL_USER_MODULE_SLUGS = ["emergency", "vehicle1", "vehicle2", "gas-emission-simulation"] as const;

const NORMAL_USER_MODULE_SET = new Set<string>(NORMAL_USER_MODULE_SLUGS);

export function isAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return ADMIN_EMAILS_HARDCODED.includes(email.toLowerCase().trim());
}

export function canAccessModule(slug: string, email?: string | null): boolean {
  if (isAdminEmail(email)) return true;
  return NORMAL_USER_MODULE_SET.has(slug);
}

export function getVisibleModules(modules: ModuleDefinition[], email?: string | null): ModuleDefinition[] {
  if (isAdminEmail(email)) return modules;
  return modules.filter((moduleItem) => NORMAL_USER_MODULE_SET.has(moduleItem.slug));
}
