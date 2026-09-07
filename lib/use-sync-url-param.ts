"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Syncs a URL query param with a value from the page state (e.g. deal.status).
 *
 * When `value` changes (e.g. after a stage transition), this hook updates
 * the URL query param so the sidebar active-state highlighting reflects
 * the current module/stage the user is viewing.
 *
 * @param value   - The current value to sync (e.g. deal.status). Empty/null = no-op.
 * @param paramKey - The URL query param name (e.g. "status", "stage", "type").
 */
export function useSyncUrlParam(
  value: string | undefined | null,
  paramKey: string,
) {
  const router = useRouter();

  useEffect(() => {
    if (!value) return;
    if (typeof window === "undefined") return;

    const params = new URLSearchParams(window.location.search);
    const current = params.get(paramKey) || "";
    if (current === value) return;

    params.set(paramKey, value);
    const newUrl = `${window.location.pathname}?${params.toString()}`;

    // Defer to the next tick so the AppRouter action queue is initialized
    // before we dispatch a navigation action. This prevents the intermittent
    // "Router action dispatched before initialization" error.
    const timer = setTimeout(() => {
      router.replace(newUrl, { scroll: false });
    }, 0);

    return () => clearTimeout(timer);
  }, [value, paramKey, router]);
}
