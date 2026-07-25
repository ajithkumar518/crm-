import { ModuleGate } from "@/components/ModuleGate";
import { redirect } from "next/navigation";

function Redirector() {
  redirect("/catalogue/categories");
  return null;
}

export default function SettingsProductCategoriesPage() {
  return (
    <ModuleGate variantMin={2}>
      <Redirector />
    </ModuleGate>
  );
}
