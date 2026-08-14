import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { generateProformaPdf } from "@/lib/generateProformaPdf";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await verifyAuth();
  if (!user) return NextResponse.json({ success: false, message: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const proforma = await prisma.proformaInvoice.findFirst({
    where: { id, companyId: user.companyId },
    include: {
      customer: { select: { id: true, name: true, customerCode: true, billingAddress: true, shippingAddress: true, city: true, state: true, gstNumber: true, phone: true, email: true } },
      contact: { select: { id: true, name: true, email: true, phone: true } },
      company: { select: { id: true, name: true } },
      quotation: { select: { id: true, quotationCode: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true } } } },
    },
  });

  if (!proforma) return NextResponse.json({ success: false, message: "Proforma not found" }, { status: 404 });

  const [addrConfig, gstinConfig, phoneConfig, emailConfig] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: "company_address" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_gstin" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_phone" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_email" } }),
  ]);

  const generatedByName = (await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }))?.name || user.email;

  const doc = generateProformaPdf({
    proformaNumber: proforma.proformaNumber,
    proformaDate: proforma.proformaDate,
    validityDate: proforma.validityDate,
    status: proforma.status,
    customer: proforma.customer,
    contact: proforma.contact,
    company: proforma.company,
    quotationCode: proforma.quotation?.quotationCode || null,
    items: proforma.items.map((it) => ({
      description: it.description || it.product?.name || "—",
      productType: it.productType,
      materialGrade: it.materialGrade,
      materialSize: it.materialSize,
      rmMake: it.rmMake,
      lengthMm: it.lengthMm,
      numberOfPieces: it.numberOfPieces,
      quantity: it.quantity,
      unit: it.unit,
      unitPrice: it.unitPrice,
      discountPercent: it.discountPercent,
      taxPercent: it.taxPercent,
      lineTotal: it.lineTotal,
      cuttingCharge: it.cuttingCharge,
      deliveryDays: it.deliveryDays,
      remarks: it.remarks,
    })),
    subtotal: proforma.subtotal,
    taxAmount: proforma.taxAmount,
    discountPercent: proforma.discountPercent,
    grandTotal: proforma.grandTotal,
    paymentTerms: proforma.paymentTerms,
    deliveryTerms: proforma.deliveryTerms,
    termsAndConditions: proforma.termsAndConditions,
    notes: proforma.notes,
    companyAddress: addrConfig?.value || "",
    companyGstin: gstinConfig?.value || "",
    companyPhone: phoneConfig?.value || "",
    companyEmail: emailConfig?.value || "",
    generatedByName,
  });

  const pdfBytes = doc.output("arraybuffer");
  const fileName = `${proforma.proformaNumber}.pdf`;

  return new NextResponse(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${fileName}"`,
      "Content-Length": String(pdfBytes.byteLength),
    },
  });
}
