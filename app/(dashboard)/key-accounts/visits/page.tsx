"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function KeyAccountVisitsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/key-accounts/visit-schedule");
  }, [router]);
  return null;
}
