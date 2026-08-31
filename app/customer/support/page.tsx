import { getMeAction } from "@/app/actions/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import SupportClient from "./SupportClient";

// Mark as dynamic since getMeAction() uses cookies() which requires server-side rendering
export const dynamic = 'force-dynamic';

export default async function CustomerSupportPage() {
  const userRes = await getMeAction();
  if (!userRes.success || !userRes.data || userRes.data.role !== "Customer") {
    redirect("/login");
  }

  const user = userRes.data;

  // Retrieve customer record
  const customer = await prisma.customer.findUnique({
    where: { email: user.email },
  });

  // Query support visits associated with this customer
  const tickets = customer
    ? await prisma.customerVisit.findMany({
        where: {
          customerId: customer.id,
          purpose: "Support",
        },
        orderBy: {
          createdAt: "desc",
        },
      })
    : [];

  // Normalize ticket data for serialization
  const normalizedTickets = tickets.map((t) => ({
    id: t.id,
    meetingSummary: t.meetingSummary,
    outcome: t.outcome,
    createdAt: t.createdAt,
    status: t.status,
  }));

  return <SupportClient initialTickets={normalizedTickets} />;
}
