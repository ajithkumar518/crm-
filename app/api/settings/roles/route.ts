import { NextResponse } from "next/server";
import { verifyAuth } from "@/lib/auth";

const ROLES = [
  { name: "Admin", description: "Full system access" },
  { name: "SalesManager", description: "Team management, approvals, reports" },
  { name: "SalesExecutive", description: "Lead/opportunity management, own data" },
  { name: "CostingEngineer", description: "RFQ costing sheet management" },
  { name: "Customer", description: "Portal access, own quotations/orders" },
  { name: "SuperAdmin", description: "Platform-level access, support mode" },
];

export async function GET() {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });
  if (user.role !== "Admin") {
    return NextResponse.json({ success: false, message: "Only Admins can view role settings" }, { status: 403 });
  }

  return NextResponse.json({ success: true, data: ROLES });
}
