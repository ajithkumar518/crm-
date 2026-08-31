"use client";
import { use, useEffect } from "react";
import { useRouter } from "next/navigation";
import { CRMSpinner } from "@/components/CRMSpinner";

export default function OpportunityWorkspacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();

  useEffect(() => {
    router.replace(`/sales-pipeline/${id}/opportunity-detail`);
  }, [id, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <CRMSpinner />
    </div>
  );
}
