import { NextResponse } from "next/server";
import { updateCompanyVariantAction, updateCompanyModulesAction } from "@/app/actions/auth";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action, val } = body;
    if (action === "variant") {
      const result = await updateCompanyVariantAction(Number(val));
      return NextResponse.json(result);
    } else if (action === "modules") {
      const result = await updateCompanyModulesAction(Array.isArray(val) ? val : [val]);
      return NextResponse.json(result);
    }
    return NextResponse.json({ success: false, message: "Invalid action" }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message || String(err) }, { status: 500 });
  }
}
