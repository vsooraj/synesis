import { db, auditLogTable } from "@workspace/db";

export async function logAction(
  tenantId: number,
  userId: number | null,
  action: string,
  entityType: string,
  entityId?: string | number,
  detail?: Record<string, unknown>,
  ipAddress?: string,
): Promise<void> {
  try {
    await db.insert(auditLogTable).values({
      tenantId,
      userId,
      action,
      entityType,
      entityId: entityId?.toString(),
      detail,
      ipAddress,
    });
  } catch {
    // Audit log failure should never crash the main request
  }
}
