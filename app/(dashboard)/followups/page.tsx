// Canonical follow-up route is /follow-up ù redirect duplicate
import { redirect } from "next/navigation";
export default function FollowUpsRedirect() {
  redirect("/follow-up");
}