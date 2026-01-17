/**
 * Vista Soporte Sigma - Servicio de negocio
 * Gestión de acceso de soporte y logs sin PII
 */

import { db } from "../db.js";
import { eq, and, desc, sql, gt } from "drizzle-orm";
import { 
  sigmaSupportAccessTable,
  sigmaSupportLogsTable,
  sigmaSupportMetricasTable,
  sigmaSupportTicketsTable
} from "../../shared/schema-sigma-support.js";
import { logAudit } from "./audit.js";
import { sendToSIEM } from "./siem.js";

interface GrantAccessInput {
  supportUserId: string;
  supportUserName: string;
  supportEmail: string;
  tenantId: string;
  tenantNombre: string;
  tipoAcceso: "readonly" | "readwrite" | "fullaccess";
  razon: string;
  fechaFin?: Date;
  permisos: {
    canViewLogs: boolean;
    canViewMetrics: boolean;
    canViewAudit: boolean;
    canExportData: boolean;
  };
}

interface SupportAction {
  action: string;
  recurso: string;
  resourceId?: string;
  detalles?: string;
  exitoso: boolean;
  error?: string;
}

/**
 * Otorga acceso temporal a soporte Sigma
 */
export async function grantSigmaSupportAccess(
  adminUserId: string,
  data: GrantAccessInput
): Promise<{
  accessId: string;
  validoHasta: Date;
}> {
  try {
    const validoHasta = data.fechaFin || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 días por defecto

    // Insertar en sigma_support_access
    const [access] = await db.insert(sigmaSupportAccessTable).values({
      supportUserId: data.supportUserId,
      supportUserName: data.supportUserName,
      supportEmail: data.supportEmail,
      tenantId: data.tenantId,
      tenantNombre: data.tenantNombre,
      tipoAcceso: data.tipoAcceso,
      razon: data.razon,
      fechaInicio: new Date(),
      fechaFin: validoHasta,
      activo: true,
      canViewLogs: data.permisos.canViewLogs,
      canViewMetrics: data.permisos.canViewMetrics,
      canViewAudit: data.permisos.canViewAudit,
      canExportData: data.permisos.canExportData,
      otorgadoPor: adminUserId,
    }).returning();

    const accessId = access.id;

    console.log(
      `[SigmaSupport] Acceso otorgado a ${data.supportUserName} para tenant ${data.tenantNombre}`
    );

    // Auditoría con datos sin PII
    await logAudit({
      action: "sigma_support_access_granted" as any,
      tenantId: "system",
      userId: adminUserId,
      ipAddress: "admin",
      details: {
        accessId,
        supportUserId: data.supportUserId,
        tenantId: data.tenantId,
        tipoAcceso: data.tipoAcceso,
        razon: data.razon,
        validoHasta,
      },
    });

    // SIEM event
    await sendToSIEM({
      type: "sigma_support_access_granted",
      level: "warn", // Acceso a soporte es crítico, monitorearlo
      tenantId: "system",
      details: {
        accessId,
        supportUserId: data.supportUserId,
        tenantId: data.tenantId,
        tipo: data.tipoAcceso,
        razon: data.razon,
      },
    });

    return { accessId, validoHasta };
  } catch (error: any) {
    console.error("[SigmaSupport] Error otorgando acceso:", error);
    throw error;
  }
}

/**
 * Revoca acceso de soporte
 */
export async function revokeSigmaSupportAccess(
  adminUserId: string,
  accessId: string,
  razon?: string
): Promise<void> {
  try {
    console.log(`[SigmaSupport] Revocando acceso ${accessId}`);

    // Actualizar revokedAt y activo en BD
    await db
      .update(sigmaSupportAccessTable)
      .set({
        activo: false,
        revokedAt: new Date(),
        revisadoPor: adminUserId,
      })
      .where(eq(sigmaSupportAccessTable.id, accessId));

    // Auditoría
    await logAudit({
      action: "sigma_support_access_revoked" as any,
      tenantId: "system",
      userId: adminUserId,
      ipAddress: "admin",
      details: {
        accessId,
        razon,
      },
    });

    // SIEM event
    await sendToSIEM({
      type: "sigma_support_access_revoked",
      level: "warn",
      tenantId: "system",
      details: {
        accessId,
        razon,
      },
    });
  } catch (error: any) {
    console.error("[SigmaSupport] Error revocando acceso:", error);
    throw error;
  }
}

/**
 * Registra una acción de soporte (sin PII)
 */
export async function logSupportAction(
  supportUserId: string,
  supportUserName: string,
  action: SupportAction
): Promise<void> {
  try {
    // Insertar en sigma_support_logs
    await db.insert(sigmaSupportLogsTable).values({
      supportUserId,
      supportUserName,
      accion: action.action,
      recurso: action.recurso,
      resourceId: action.resourceId || null,
      detalles: action.detalles,
      exitoso: action.exitoso,
      error: action.error,
    });

    const icon = action.exitoso ? "✅" : "❌";
    console.log(
      `[SigmaSupport] ${icon} ${supportUserName}: ${action.action} en ${action.recurso}`
    );

    // SIEM event - solo si hay error
    if (!action.exitoso) {
      await sendToSIEM({
        type: "sigma_support_action_failed",
        level: "error",
        tenantId: "system",
        details: {
          supportUserId,
          accion: action.action,
          recurso: action.recurso,
          error: action.error,
        },
      });
    }
  } catch (error: any) {
    console.error("[SigmaSupport] Error registrando acción:", error);
  }
}

/**
 * Obtiene accesos activos de soporte
 */
export async function getActiveSupportAccesses(
  tenantId?: string
): Promise<
  Array<{
    accessId: string;
    supportUserName: string;
    tipoAcceso: string;
    validoHasta: Date;
    razon: string;
  }>
> {
  const conditions = [
    eq(sigmaSupportAccessTable.activo, true),
    gt(sigmaSupportAccessTable.fechaFin, new Date()),
  ];

  if (tenantId) {
    conditions.push(eq(sigmaSupportAccessTable.tenantId, tenantId));
  }

  const accesses = await db
    .select({
      accessId: sigmaSupportAccessTable.id,
      supportUserName: sigmaSupportAccessTable.supportUserName,
      tipoAcceso: sigmaSupportAccessTable.tipoAcceso,
      validoHasta: sigmaSupportAccessTable.fechaFin,
      razon: sigmaSupportAccessTable.razon,
    })
    .from(sigmaSupportAccessTable)
    .where(and(...conditions))
    .orderBy(desc(sigmaSupportAccessTable.createdAt));

  return accesses.map(a => ({
    accessId: a.accessId,
    supportUserName: a.supportUserName,
    tipoAcceso: a.tipoAcceso,
    validoHasta: a.validoHasta!,
    razon: a.razon,
  }));
}

/**
 * Estadísticas de soporte
 */
export async function getSupportStats(): Promise<{
  accessesActivos: number;
  logsUltimas24h: number;
  ticketsAbiertos: number;
  ticketsCriticos: number;
}> {
  const hace24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Accesos activos
  const [{ count: accessesActivos }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sigmaSupportAccessTable)
    .where(
      and(
        eq(sigmaSupportAccessTable.activo, true),
        gt(sigmaSupportAccessTable.fechaFin, new Date())
      )
    );

  // Logs últimas 24h
  const [{ count: logsUltimas24h }] = await db
    .select({ count: sql<number>`count(*)` })
    .from(sigmaSupportLogsTable)
    .where(gt(sigmaSupportLogsTable.createdAt, hace24h));

  // Tickets abiertos y críticos
  const [ticketStats] = await db
    .select({
      abiertos: sql<number>`count(*) filter (where estado = 'abierto')`,
      criticos: sql<number>`count(*) filter (where severidad = 'critica' and estado = 'abierto')`,
    })
    .from(sigmaSupportTicketsTable);

  return {
    accessesActivos: Number(accessesActivos),
    logsUltimas24h: Number(logsUltimas24h),
    ticketsAbiertos: Number(ticketStats?.abiertos || 0),
    ticketsCriticos: Number(ticketStats?.criticos || 0),
  };
}

/**
 * Crea un ticket de soporte
 */
export async function createSupportTicket(
  tenantId: string,
  createdBy: string,
  data: {
    titulo: string;
    descripcion: string;
    categoria: string;
    severidad: "baja" | "normal" | "alta" | "critica";
  }
): Promise<{
  ticketId: string;
  numeroTicket: string;
}> {
  try {
    const numeroTicket = `TKT-${Date.now()}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;

    // Insertar en sigma_support_tickets
    const [ticket] = await db.insert(sigmaSupportTicketsTable).values({
      tenantId,
      tenantNombre: 'Tenant', // Podríamos buscar el nombre real del tenant si lo necesitamos
      numeroTicket,
      titulo: data.titulo,
      descripcion: data.descripcion,
      categoria: data.categoria,
      severidad: data.severidad,
      estado: 'abierto',
      creadoPor: createdBy,
    }).returning();

    const ticketId = ticket.id;

    console.log(
      `[SigmaSupport] Ticket creado: ${numeroTicket} - ${data.titulo} [${data.severidad}]`
    );

    // Auditoría
    await logAudit({
      action: "support_ticket_created" as any,
      tenantId,
      userId: createdBy,
      ipAddress: "system",
      details: {
        ticketId,
        numeroTicket,
        categoria: data.categoria,
        severidad: data.severidad,
      },
    });

    // SIEM event
    await sendToSIEM({
      type: "support_ticket_created",
      level: data.severidad === "critica" ? "error" : "info",
      tenantId,
      details: {
        numeroTicket,
        categoria: data.categoria,
        severidad: data.severidad,
      },
    });

    return { ticketId, numeroTicket };
  } catch (error: any) {
    console.error("[SigmaSupport] Error creando ticket:", error);
    throw error;
  }
}
