import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign In | Shahnaz CRM",
  description:
    "Sign in to your Shahnaz CRM account to manage your marketing campaigns and customer relationships.",
};

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
