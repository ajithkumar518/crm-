import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { generateProformaPdf } from "@/lib/generateProformaPdf";
import { sendEmail } from "@/lib/email";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
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

  const recipientEmail = proforma.contact?.email || proforma.customer?.email;
  if (!recipientEmail) {
    return NextResponse.json({ success: false, message: "No contact or customer email found" }, { status: 400 });
  }

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

  const pdfBuffer = Buffer.from(doc.output("arraybuffer"));
  const fileName = `${proforma.proformaNumber}.pdf`;

  const htmlBody = `
    <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
      <div style="background-color:#0D2137;padding:20px;text-align:center;">
        <h2 style="color:#ffffff;margin:0;">SUKI CRM</h2>
      </div>
      <div style="padding:24px;">
        <p>Dear <strong>${proforma.contact?.name || proforma.customer?.name || "Customer"}</strong>,</p>
        <p>Please find attached the Proforma Invoice <strong>${proforma.proformaNumber}</strong> from <strong>${proforma.company?.name || "SUKI Software"}</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin-top:15px;font-size:14px;">
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Proforma No</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">${proforma.proformaNumber}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Quotation Ref</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">${proforma.quotation?.quotationCode || "—"}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Grand Total</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;font-weight:bold;">₹${proforma.grandTotal.toFixed(2)}</td></tr>
          <tr><td style="padding:8px;border-bottom:1px solid #e2e8f0;color:#64748b;">Valid Until</td><td style="padding:8px;border-bottom:1px solid #e2e8f0;">${proforma.validityDate ? new Date(proforma.validityDate).toLocaleDateString() : "—"}</td></tr>
        </table>
        <p style="margin-top:24px;color:#475569;font-size:14px;">Please review the attached PDF for full details. If you have any questions, feel free to reach out.</p>
        <p style="margin-top:24px;color:#475569;font-size:13px;">Regards,<br/>${generatedByName}<br/>${proforma.company?.name || "SUKI Software"}</p>
      </div>
    </div>
  `;

  let emailSent = false;
  let emailWarning = "";
  try {
    await sendEmail({
      to: recipientEmail,
      subject: `Proforma Invoice ${proforma.proformaNumber} from ${proforma.company?.name || "SUKI Software"}`,
      html: htmlBody,
      attachments: [{ filename: fileName, content: pdfBuffer, contentType: "application/pdf" }],
    });
    emailSent = true;
  } catch (e: any) {
    emailWarning = `Email delivery failed: ${e.message}`;
  }

  const status = emailSent && proforma.status === "Draft" ? "Sent" : proforma.status;
  const updated = await prisma.proformaInvoice.update({
    where: { id },
    data: { status },
    include: {
      customer: { select: { id: true, name: true, customerCode: true } },
      quotation: { select: { id: true, quotationCode: true } },
    },
  });

  await prisma.communicationLog.create({
    data: {
      channel: "Email",
      direction: "Outbound",
      status: emailSent ? "Sent" : "Failed",
      content: `Proforma ${proforma.proformaNumber} emailed to ${recipientEmail}. ${emailWarning}`.trim(),
      customerId: proforma.customerId || null,
      sentByUserId: user.id,
      sentAt: new Date(),
      companyId: user.companyId ?? null,
    },
  }).catch(() => {});

  return NextResponse.json({
    success: true,
    data: updated,
    message: emailSent ? "Proforma sent successfully" : `PDF ready, but ${emailWarning}`,
  });
}
