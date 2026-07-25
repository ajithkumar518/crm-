import { hasModule, ModuleCheckSubject } from "../modules";
export type ModuleSearchItem = {
  key: string;
  label: string;
  href: string;
  icon: string;
  keywords: string[];
  type: 'module' | 'submodule' | 'setting';
  parentLabel?: string;
  parentKey?: string;
  variantMin?: number;
};

import { V1_ITEMS, V2_EXTRAS, V3_EXTRAS, V4_EXTRAS, NavItem } from "../canonical-navigation-config";

const mapToSearchItem = (item: NavItem): ModuleSearchItem => ({
  key: item.key,
  label: item.label,
  href: item.href,
  icon: item.iconEmoji,
  keywords: item.keywords,
  type: item.type,
  parentLabel: item.parentLabel,
  parentKey: item.parentKey,
  variantMin: item.variantMin,
});

const ALL_SEARCH_ITEMS = [
  ...V1_ITEMS.map(mapToSearchItem),
  ...V2_EXTRAS.map(mapToSearchItem),
  ...V3_EXTRAS.map(mapToSearchItem),
  ...V4_EXTRAS.map(mapToSearchItem),
];

export function getPermittedSearchItems(subject: ModuleCheckSubject): ModuleSearchItem[] {
  const userVariant = Number(subject.variant ?? 1);
  return ALL_SEARCH_ITEMS.filter(item => {
    // Check variant minimum first
    if (item.variantMin && userVariant < item.variantMin) return false;

    // Map the search item key (or its parent) to a ModuleKey for checking
    let keyToCheck = item.type === 'module' ? item.key : item.parentKey || item.key;
    
    // For top-level modules, check if module is enabled
    if (item.type === 'module') {
      return hasModule(subject, item.key as any);
    }
    // For submodules, check parent access
    if (item.type === 'submodule' && item.parentKey) {
      return hasModule(subject, item.parentKey as any);
    }
    
    // For settings or other items whose variantMin is already checked above
    return true; 
  });
}

// Search function — call this from the search component
export function searchModules(query: string, subject: ModuleCheckSubject): ModuleSearchItem[] {
  if (!query || query.trim().length < 1) return [];
  const q = query.toLowerCase().trim();
  const permittedItems = getPermittedSearchItems(subject);
  return permittedItems.filter(item =>
    item.label.toLowerCase().includes(q) ||
    item.key.toLowerCase().includes(q) ||
    item.keywords.some(kw => kw.toLowerCase().includes(q)) ||
    (item.parentLabel?.toLowerCase().includes(q))
  ).slice(0, 8);
}
