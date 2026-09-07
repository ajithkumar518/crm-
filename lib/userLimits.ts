import { prisma } from "./prisma";

// Maximum number of internal users allowed per company variant.
// null means no limit for that variant.
const VARIANT_INTERNAL_USER_LIMITS: Record<number, number | null> = {
  1: null,
  2: 5, // 1 admin + 4 additional credentials
  3: null,
  4: null,
};

export async function getInternalUserLimit(companyId: string): Promise<number | null> {
  const company = await prisma.company.findUnique({
    where: { id: companyId },
    select: { variant: true },
  });
  const variant = company?.variant || 1;
  return VARIANT_INTERNAL_USER_LIMITS[variant] ?? null;
}

export async function checkInternalUserLimit(
  companyId: string,
): Promise<{ allowed: boolean; current: number; max: number | null }> {
  const max = await getInternalUserLimit(companyId);
  if (max == null) return { allowed: true, current: 0, max: null };
  const current = await prisma.user.count({
    where: {
      companyId,
      userType: "internal",
      deletedAt: null,
    },
  });
  return { allowed: current < max, current, max };
}
