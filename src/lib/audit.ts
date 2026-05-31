import { prisma } from "@/lib/prisma";

export type AuditAction =
  | "LOGIN"
  | "PAYROLL_RUN"
  | "PAYROLL_RELEASE"
  | "PAYROLL_RELEASE_ALL"
  | "EMPLOYEE_SEPARATE"
  | "DOCUMENT_ADD"
  | "DOCUMENT_DELETE"
  | "LEAVE_APPROVE"
  | "LEAVE_REJECT"
  | "LEAVE_REVOKE"
  | "ROLE_CHANGE"
  | "COMPANY_UPDATE";

interface LogAuditParams {
  companyId?: string | null;
  userId?: string | null;
  action: AuditAction;
  target?: string | null;
  targetId?: string | null;
  meta?: Record<string, unknown> | null;
}

export async function logAudit(params: LogAuditParams): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        companyId: params.companyId ?? null,
        userId:    params.userId ?? null,
        action:    params.action,
        target:    params.target ?? null,
        targetId:  params.targetId ?? null,
        meta:      params.meta ? JSON.stringify(params.meta) : null,
      },
    });
  } catch {
    // Fire-and-forget: audit logging must never break the calling action
  }
}
