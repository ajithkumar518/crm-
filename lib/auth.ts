import { cookies } from "next/headers";
import jwt from "jsonwebtoken";
import { prisma } from "@/lib/prisma";

const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error("JWT_SECRET environment variable is missing.");
}


export interface TokenPayload {
  id: string;
  email: string;
  role: string;
  companyId?: string | null;
  variant?: number;
  enabledModules?: string;
  serviceCrmEnabled?: boolean;
  disableServiceCrm?: boolean;
  supportMode?: boolean;
  iat: number;
  exp: number;
}

/** Domain-based email validation has been disabled to allow any valid email
 *  for internal user credentials. Kept as a no-op for backward compatibility. */
export function isInternalEmail(_email: string): boolean {
  return true;
}

/** @deprecated Domain-based email validation is no longer enforced. */
export function requiresInternalEmail(_role: string): boolean {
  return false;
}

export async function verifyAuth(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get("token")?.value;

  if (!token) {
    return null;
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET as string, {
      algorithms: ["HS256"],
    }) as any;
    if (decoded.userId && !decoded.id) {
      decoded.id = decoded.userId;
    }
    return decoded as TokenPayload;
  } catch (error) {
    console.error("JWT Verification Error:", error);
    return null;
  }
}

export function requireRole(
  payload: TokenPayload | null,
  allowedRoles: string[],
) {
  if (!payload) return false;
  return allowedRoles.includes(payload.role);
}

/** Returns the dashboard URL for a given role */
export function getRoleRedirect(role: string): string {
  switch (role) {
    case "SuperAdmin":
      return "/dashboard";
    case "Admin":
      return "/dashboard";
    case "SalesManager":
      return "/dashboard";
    case "SalesExecutive":
      return "/dashboard";
    case "ServiceManager":
      return "/service/dashboard/my";
    case "ServiceEngineer":
      return "/service/my-visits";
    case "Customer":
      return "/customer/portal";
    default:
      return "/dashboard";
  }
}

/** Checks if the user has delete permission for a specific module */
export async function requireDeletePermission(
  moduleName: string,
): Promise<TokenPayload> {
  const payload = await verifyAuth();
  if (!payload) throw new Error("Unauthorized");

  if (payload.role === "Admin" || payload.role === "SuperAdmin") {
    return payload;
  }

  const perm = await prisma.rolePermission.findUnique({
    where: { role_module: { role: payload.role, module: moduleName } },
  });

  if (!perm || !perm.canDelete) {
    throw new Error(
      "You do not have permission to delete records in this module.",
    );
  }

  return payload;
}
