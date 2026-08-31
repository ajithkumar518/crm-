// STRICT variant-to-settings map
// Each variant shows ONLY the items listed here — nothing more, nothing less
// This is the single source of truth for settings sidebar navigation
// NOTE: Users & Roles & Permissions are handled separately via userManagementSubItems
//       and are NOT listed here. This map covers only the Settings expandable section.

import { getNavItems, NavItem } from "../canonical-navigation-config";

export type SettingsItem = {
  key: string;
  label: string;
  href: string;
};

const mapToSettingsItem = (item: NavItem): SettingsItem => ({
  key: item.href.replace('/settings/', ''),
  label: item.label,
  href: item.href,
});

const buildSettingsMapForVariant = (variant: number): SettingsItem[] => {
  const items = getNavItems(variant);
  return items
    .filter(item => item.type === 'setting' && item.href.startsWith('/settings/') && item.href !== '/settings/roles')
    .map(mapToSettingsItem);
};

export const VARIANT_SETTINGS_MAP: Record<number, SettingsItem[]> = {
  1: buildSettingsMapForVariant(1),
  2: buildSettingsMapForVariant(2),
  3: buildSettingsMapForVariant(3),
  4: buildSettingsMapForVariant(4),
};

export function getSettingsForVariant(variant: number): SettingsItem[] {
  return VARIANT_SETTINGS_MAP[variant] ?? VARIANT_SETTINGS_MAP[1];
}

// Items that must NEVER appear in any variant's settings navigation
export const BLOCKED_SETTINGS_KEYS = [
  'customer-portal',
  'portal-activation',
  'portal-users',
  'portal-user-types',
  'portal-settings',
  'portal',
  'tax-master',
  'document-types',
  'sample-configuration',
];
