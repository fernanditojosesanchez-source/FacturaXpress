export interface SIEMEvent {
  type: string;
  timestamp?: string;
  level?: "info" | "warn" | "error";
  userId?: string | null;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  details?: any;
}

function getEnvBool(name: string, def = false): boolean {
  const v = process.env[name];
  if (v === undefined) return def;
  return ["1", "true", "yes", "on"].includes(String(v).toLowerCase());
}

export async function sendToSIEM(event: SIEMEvent): Promise<void> {
  const url = process.env.SIEM_WEBHOOK_URL;
  if (!url) return; // Deshabilitado si no hay endpoint

  const apiKey = process.env.SIEM_API_KEY;
  const body = {
    ...event,
    timestamp: event.timestamp || new Date().toISOString(),
    app: "FacturaXpress",
    env: process.env.NODE_ENV || "development",
  };

  try {
    await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(apiKey ? { "X-API-Key": apiKey } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // No romper el flujo si el SIEM falla
    if (getEnvBool("SIEM_LOG_ERRORS", true)) {
      console.error("[SIEM] Error enviando evento:", (err as Error).message);
    }
  }
}
