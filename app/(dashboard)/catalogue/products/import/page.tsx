"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Product import is now handled by the ProductImportModal on the products
 * listing page. This page redirects client-side as a fallback.
 */
export default function ProductImportRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/catalogue/products");
  }, [router]);
  return null;
}
