/**
 * PII-Aware Logger
 * Sanitiza datos sensibles (DUI, NIT, Nombres, Correos) antes de loguear.
 * @see AUDITORIA_SEGURIDAD_2026_01.md - Punto #2 (Seguridad: Fuga de Información)
 */

const PII_FIELDS = ["numDocumento", "nombre", "correo", "telefono", "direccion", "nit", "nrc"];

/**
 * Máscara recursiva para objetos que puedan contener PII
 */
function maskPII(obj: any): any {
  if (!obj || typeof obj !== "object") return obj;

  if (Array.isArray(obj)) {
    return obj.map(item => maskPII(item));
  }

  const masked: any = {};
  for (const [key, value] of Object.entries(obj)) {
    if (PII_FIELDS.includes(key) && typeof value === "string") {
      if (value.length <= 4) {
        masked[key] = "****";
      } else {
        masked[key] = value.substring(0, 2) + "****" + value.substring(value.length - 2);
      }
    } else if (typeof value === "object") {
      masked[key] = maskPII(value);
    } else {
      masked[key] = value;
    }
  }
  return masked;
}

const formatArgs = (args: any[]) => args.map(arg => typeof arg === "object" ? maskPII(arg) : arg);

export const logger = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV !== "production") {
      console.debug("[DEBUG]", ...formatArgs(args));
    }
  },
  info: (...args: any[]) => {
    console.log("[INFO]", ...formatArgs(args));
  },
  warn: (...args: any[]) => {
    console.warn("[WARN]", ...formatArgs(args));
  },
  error: (...args: any[]) => {
    console.error("[ERROR]", ...formatArgs(args));
  },
};

