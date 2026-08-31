import { ModuleGate } from "@/components/ModuleGate";
function DecisionSummaryPage() {
  return null;
}


export default function DecisionSummaryPageWrapper(props: any) {
  return (
    <ModuleGate variantMin={3}>
      <DecisionSummaryPage {...props} />
    </ModuleGate>
  );
}
