import { storage } from "../storage.js";
import { logAudit } from "./audit.js";
import { sendToSIEM } from "./siem.js";

function daysUntil(dateISO?: string | null): number | null {
  if (!dateISO) return null;
  const target = new Date(dateISO).getTime();
  const now = Date.now();
  return Math.ceil((target - now) / (1000 * 60 * 60 * 24));
}

export async function checkCertExpiryAndNotify(): Promise<{ alerts: number }> {
  const tenants = await storage.listTenants();
  const thresholds = [90, 60, 30, 15, 7];
  let alerts = 0;

  for (const t of tenants) {
    const certs = await storage.getCertificados(t.id);
    for (const c of certs) {
      const remaining = daysUntil((c as any).validoHasta || null);
      if (remaining === null) continue;

      const hit = thresholds.find((th) => remaining <= th && remaining >= 0);
      if (hit !== undefined) {
        alerts++;
        const details = {
          tenantId: t.id,
          certificadoId: (c as any).id,
          validoHasta: (c as any).validoHasta,
          remainingDays: remaining,
          threshold: hit,
        };
        await logAudit({ userId: null, action: "cert_expiry_warning", ipAddress: "system", details });
        await sendToSIEM({ type: "cert_expiry_warning", level: remaining <= 7 ? "warn" : "info", tenantId: t.id, details });
      }
    }
  }

  return { alerts };
}

export function startCertificateAlertsScheduler(): NodeJS.Timeout | null {
  const minutes = parseInt(process.env.CERT_ALERT_INTERVAL_MINUTES || "60", 10);
  if (Number.isNaN(minutes) || minutes <= 0) return null;

  const run = async () => {
    try {
      const { alerts } = await checkCertExpiryAndNotify();
      if (alerts > 0) console.log(`🔔 Alertas de certificados: ${alerts}`);
    } catch (e) {
      console.error("[Alerts] Error en verificación de certificados:", (e as Error).message);
    }
  };

  // Ejecutar al inicio y luego programado
  run().catch(() => {});
  return setInterval(() => run().catch(() => {}), minutes * 60 * 1000);
}
