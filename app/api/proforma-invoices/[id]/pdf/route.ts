import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyAuth } from "@/lib/auth";
import { generateSukiProformaInvoicePdf } from "@/lib/generateSukiProformaInvoicePdf";

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
      quotation: { select: { id: true, quotationCode: true, paymentTerms: true, deliveryTerms: true } },
      items: { include: { product: { select: { id: true, name: true, productCode: true, hsnCode: true } } } },
    },
  });

  if (!proforma) return NextResponse.json({ success: false, message: "Proforma not found" }, { status: 404 });

  const [
    nameConfig,
    addrConfig,
    gstinConfig,
    phoneConfig,
    emailConfig,
    panConfig,
    cinConfig,
    regOffConfig,
    bankNameConfig,
    bankIfscConfig,
    bankAccountConfig,
    bankBranchConfig,
  ] = await Promise.all([
    prisma.systemConfig.findUnique({ where: { key: "company_name" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_address" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_gstin" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_phone" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_email" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_pan" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_cin" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_reg_off" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_bank_name" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_bank_ifsc" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_bank_account_no" } }),
    prisma.systemConfig.findUnique({ where: { key: "company_bank_branch" } }),
  ]);

  const generatedByName = (await prisma.user.findUnique({ where: { id: user.id }, select: { name: true } }))?.name || user.email;

  const stateCode = proforma.billGstNumber?.substring(0, 2) || proforma.customer?.gstNumber?.substring(0, 2) || "";

  const items = proforma.items.map((it) => {
    const taxable = it.quantity * it.unitPrice * (1 - (it.discountPercent || 0) / 100);
    return {
      description: it.description || it.product?.name || "—",
      hsn: it.hsn || it.product?.hsnCode || "",
      quantity: it.quantity,
      unit: it.unit || "Kgs",
      numberOfPieces: it.numberOfPieces ?? it.quantity,
      unitPrice: it.unitPrice,
      discountPercent: it.discountPercent,
      taxPercent: it.taxPercent,
      taxable,
    };
  });

  const doc = generateSukiProformaInvoicePdf({
    proformaNumber: proforma.proformaNumber,
    proformaDate: proforma.proformaDate,
    validityDate: proforma.validityDate,
    customer: proforma.customer,
    contact: proforma.contact,
    company: {
      name: nameConfig?.value || proforma.company?.name || "Shahnaz Bright Steel Industries Private Limited",
      address: addrConfig?.value || "",
      phone: phoneConfig?.value || "",
      email: emailConfig?.value || "",
      gstin: gstinConfig?.value || "",
      pan: panConfig?.value || "",
      cin: cinConfig?.value || "",
      regOff: regOffConfig?.value || "",
    },
    items,
    charges: {
      transportCharge: proforma.transportCharge,
      otherCharges: proforma.otherCharges,
      weighingLoadingCharge: proforma.weighingLoadingCharge,
      deliveryCharge: proforma.deliveryCharge,
      testingCharge: proforma.testingCharge,
    },
    bank: {
      name: bankNameConfig?.value || "",
      ifsc: bankIfscConfig?.value || "",
      accountNo: bankAccountConfig?.value || "",
      branch: bankBranchConfig?.value || "",
    },
    subtotal: proforma.subtotal,
    taxAmount: proforma.taxAmount,
    grandTotal: proforma.grandTotal,
    roundedOff: proforma.roundedOff,
    paymentTerms: proforma.paymentTerms || proforma.quotation?.paymentTerms || "",
    placeOfSupply: proforma.placeOfSupply || proforma.billState || proforma.customer?.state || "",
    state: proforma.billState || proforma.customer?.state || "",
    stateCode: proforma.billStateCode || stateCode,
    despatchThrough: proforma.despatchThrough || proforma.quotation?.deliveryTerms || "",
    vehicleNo: proforma.vehicleNo,
    customerPoNo: proforma.customerPoNo,
    customerPoDate: proforma.customerPoDate,
    ewayBillNo: proforma.ewayBillNo,
    ewayBillDate: proforma.ewayBillDate,
    irn: proforma.irn,
    ackNo: proforma.ackNo,
    ackDate: proforma.ackDate,
    billName: proforma.billName,
    billAddress: proforma.billAddress,
    billState: proforma.billState,
    billStateCode: proforma.billStateCode,
    billGstNumber: proforma.billGstNumber,
    billPhone: proforma.billPhone,
    shipName: proforma.shipName,
    shipAddress: proforma.shipAddress,
    shipState: proforma.shipState,
    shipStateCode: proforma.shipStateCode,
    shipGstNumber: proforma.shipGstNumber,
    shipPhone: proforma.shipPhone,
    preparedBy: proforma.preparedBy || generatedByName,
    verifiedBy: proforma.verifiedBy,
    declaration: proforma.declaration,
    termsAndConditions: proforma.termsAndConditions,
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
