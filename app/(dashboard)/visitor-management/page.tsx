// Visitor Management is a Variant 2+ module ù disabled in Variant 1 (BRD º6)
import { redirect } from "next/navigation";
export default function VisitorManagementDisabled() {
  redirect("/dashboard");
}