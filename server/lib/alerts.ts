import { storage } from "../storage.js";
import { logAudit } from "./audit.js";
import { sendToSIEM } from "./siem.js";
import { sendNotification } from "./notifications.js";

function daysUntil(dateISO?: string | null): number | null {
  if (!dateISO) return null;
  const target = new Date(dateISO).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

/**
 * Verifica expiración de certificados y envía notificaciones
 * Retorna cantidad de alertas generadas
 */
export async function checkCertExpiryAndNotify(): Promise<{ alerts: number }> {
  const tenants = await storage.listTenants();
  const thresholds = [90, 60, 30, 15, 7];
  let alerts = 0;

  for (const tenant of tenants) {
    const certs = await storage.getCertificados(tenant.id);
    
    for (const cert of certs) {
      const remaining = daysUntil((cert as any).validoHasta || null);
      if (remaining === null || remaining <= 0) continue;

      const threshold = thresholds.find((th) => remaining <= th);
      if (threshold === undefined) continue;

      alerts++;

      const details = {
        tenantId: tenant.id,
        certificadoId: (cert as any).id,
        validoHasta: (cert as any).validoHasta,
        fingerprint: (cert as any).huella,
        remainingDays: remaining,
        threshold,
        companyName: tenant.nombre,
      };

      // Log de auditoría
      await logAudit({
        userId: null,
        action: "cert_expiry_warning",
        ipAddress: "system",
        details,
      });

      // Enviar a SIEM
      await sendToSIEM({
        type: "cert_expiry_warning",
        level: remaining <= 7 ? "warn" : "info",
        tenantId: tenant.id,
        details,
      });

      // Obtener canales de notificación configurados del tenant
      const notificationChannels = await getNotificationChannels(tenant.id);

      // Enviar notificaciones
      const notifications = notificationChannels.map((channel) => ({
        tenantId: tenant.id,
        type: "cert_expiry" as const,
        channel: channel.type as "email" | "sms" | "webhook",
        recipient: channel.recipient,
        body: `Su certificado digital expira en ${remaining} día(s). Válido hasta: ${new Date((cert as any).validoHasta).toLocaleDateString("es-SV")}`,
        metadata: {
          daysRemaining: remaining,
          validUntil: new Date((cert as any).validoHasta).toLocaleDateString("es-SV"),
          fingerprint: (cert as any).huella,
          companyName: tenant.nombre,
          renewUrl: process.env.CERT_RENEWAL_URL || "https://facturaxpress.sv/renovar",
        },
      }));

      // Enviar todas las notificaciones en paralelo
      const results = await Promise.all(
        notifications.map((n) => sendNotification(n).catch((err) => ({ success: false, error: err.message, channel: n.channel, timestamp: new Date() })))
      );

      // Log de resultados
      const successful = results.filter((r) => r.success).length;
      const failed = results.filter((r) => !r.success).length;

      console.log(
        `🔔 Certificado expira en ${remaining}d: ${successful} notificación(es) enviada(s)${failed > 0 ? `, ${failed} falló(s)` : ""}`
      );
    }
  }

  return { alerts };
}

/**
 * Obtiene canales de notificación configurados para un tenant
 * Lee de tabla de configuración (implementar según BD)
 */
async function getNotificationChannels(
  tenantId: string
): Promise<Array<{ type: "email" | "sms" | "webhook"; recipient: string; enabled: boolean }>> {
  // TODO: Implementar persistencia en BD
  // Por ahora retorna valores por defecto desde .env

  const channels: Array<{ type: "email" | "sms" | "webhook"; recipient: string; enabled: boolean }> = [];

  // Email del tenant (si existe en configuración)
  const tenantEmail = process.env[`TENANT_${tenantId}_EMAIL`] || process.env.DEFAULT_ALERT_EMAIL;
  if (tenantEmail) {
    channels.push({
      type: "email",
      recipient: tenantEmail,
      enabled: true,
    });
  }

  // Teléfono para SMS (si existe)
  const tenantPhone = process.env[`TENANT_${tenantId}_PHONE`] || process.env.DEFAULT_ALERT_PHONE;
  if (tenantPhone) {
    channels.push({
      type: "sms",
      recipient: tenantPhone,
      enabled: process.env.TWILIO_ACCOUNT_SID ? true : false,
    });
  }

  // Webhooks (si existen)
  const tenantWebhook = process.env[`TENANT_${tenantId}_WEBHOOK`] || process.env.DEFAULT_ALERT_WEBHOOK;
  if (tenantWebhook) {
    channels.push({
      type: "webhook",
      recipient: tenantWebhook,
      enabled: true,
    });
  }

  return channels.filter((c) => c.enabled);
}

/**
 * Inicia el scheduler de alertas de certificados
 */
export function startCertificateAlertsScheduler(): NodeJS.Timeout | null {
  const minutes = parseInt(process.env.CERT_ALERT_INTERVAL_MINUTES || "60", 10);
  if (Number.isNaN(minutes) || minutes <= 0) return null;

  const run = async () => {
    try {
      const { alerts } = await checkCertExpiryAndNotify();
      if (alerts > 0) {
        console.log(`🔔 Alertas de certificados procesadas: ${alerts}`);
      }
    } catch (error) {
      console.error("[Alerts] Error en verificación de certificados:", (error as Error).message);
    }
  };

  // Ejecutar al inicio y luego programado
  run().catch(() => {});
  return setInterval(() => run().catch(() => {}), minutes * 60 * 1000);
}
