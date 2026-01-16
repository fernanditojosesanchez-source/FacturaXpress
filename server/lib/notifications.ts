/**
 * Sistema de notificaciones multi-canal
 * Soporta: Email, SMS (Twilio), Webhooks
 */

import nodemailer from "nodemailer";

interface NotificationChannel {
  type: "email" | "sms" | "webhook";
  enabled: boolean;
  config: Record<string, any>;
}

interface NotificationRequest {
  tenantId: string;
  type: "cert_expiry" | "invoice_sent" | "invoice_failed" | "custom";
  recipient: string; // email, phone, o webhook URL
  channel: "email" | "sms" | "webhook";
  subject?: string;
  body: string;
  metadata?: Record<string, any>;
}

interface NotificationResult {
  success: boolean;
  messageId?: string;
  error?: string;
  channel: string;
  timestamp: Date;
}

// ============================================
// EMAIL
// ============================================

let emailTransporter: nodemailer.Transporter | null = null;

function initEmailTransporter(): nodemailer.Transporter {
  if (emailTransporter) return emailTransporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM || "noreply@facturaxpress.sv";

  if (!host || !user || !pass) {
    throw new Error("SMTP configuration incomplete (SMTP_HOST, SMTP_USER, SMTP_PASS required)");
  }

  emailTransporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    from,
  });

  return emailTransporter;
}

async function sendEmail(email: string, subject: string, html: string): Promise<NotificationResult> {
  try {
    const transporter = initEmailTransporter();
    const info = await transporter.sendMail({
      to: email,
      subject,
      html,
    });

    return {
      success: true,
      messageId: info.messageId,
      channel: "email",
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      channel: "email",
      timestamp: new Date(),
    };
  }
}

// ============================================
// SMS (Twilio)
// ============================================

async function sendSMS(phoneNumber: string, body: string): Promise<NotificationResult> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    const fromNumber = process.env.TWILIO_FROM_NUMBER;

    if (!accountSid || !authToken || !fromNumber) {
      return {
        success: false,
        error: "Twilio configuration incomplete",
        channel: "sms",
        timestamp: new Date(),
      };
    }

    const twilio = await import("twilio");
    const client = twilio.default(accountSid, authToken);

    const message = await client.messages.create({
      body,
      from: fromNumber,
      to: phoneNumber,
    });

    return {
      success: true,
      messageId: message.sid,
      channel: "sms",
      timestamp: new Date(),
    };
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      channel: "sms",
      timestamp: new Date(),
    };
  }
}

// ============================================
// WEBHOOK
// ============================================

async function sendWebhook(
  url: string,
  payload: Record<string, any>,
  maxRetries: number = 3
): Promise<NotificationResult> {
  try {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "User-Agent": "FacturaXpress/1.0",
            "X-Webhook-Timestamp": new Date().toISOString(),
          },
          body: JSON.stringify(payload),
          timeout: 10000,
        });

        if (response.ok) {
          return {
            success: true,
            messageId: `webhook-${Date.now()}`,
            channel: "webhook",
            timestamp: new Date(),
          };
        }

        lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (err) {
        lastError = err as Error;

        // Exponential backoff para reintentos
        if (attempt < maxRetries) {
          const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError || new Error("Webhook failed after retries");
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      channel: "webhook",
      timestamp: new Date(),
    };
  }
}

// ============================================
// PLANTILLAS DE NOTIFICACIONES
// ============================================

function getEmailTemplate(type: string, data: Record<string, any>): { subject: string; html: string } {
  switch (type) {
    case "cert_expiry":
      return {
        subject: `⚠️ Certificado Digital Expirando en ${data.daysRemaining} días`,
        html: `
          <h2>Alerta de Certificado Digital</h2>
          <p>Su certificado digital expirará en <strong>${data.daysRemaining} día(s)</strong>.</p>
          <p><strong>Detalles:</strong></p>
          <ul>
            <li>Huella: ${data.fingerprint}</li>
            <li>Válido hasta: ${data.validUntil}</li>
            <li>Empresa: ${data.companyName}</li>
          </ul>
          <p style="color: #e74c3c;"><strong>Acción requerida:</strong> Renueve su certificado lo antes posible.</p>
          <hr />
          <p style="font-size: 0.9em; color: #7f8c8d;">
            Este es un mensaje automático. No responda a este correo.
          </p>
        `,
      };

    case "invoice_failed":
      return {
        subject: `❌ Error al Transmitir Factura #${data.invoiceNumber}`,
        html: `
          <h2>Error en Transmisión de Factura</h2>
          <p>Hubo un problema al transmitir la factura <strong>#${data.invoiceNumber}</strong> al MH.</p>
          <p><strong>Error:</strong> ${data.errorMessage}</p>
          <p><strong>Acciones sugeridas:</strong></p>
          <ol>
            <li>Verifique la conexión a Internet</li>
            <li>Verifique que el Ministerio de Hacienda esté disponible</li>
            <li>Intente transmitir nuevamente desde el sistema</li>
          </ol>
        `,
      };

    default:
      return {
        subject: "Notificación de FacturaXpress",
        html: `<p>${data.body || "Notificación"}</p>`,
      };
  }
}

function getSMSTemplate(type: string, data: Record<string, any>): string {
  switch (type) {
    case "cert_expiry":
      return `⚠️ Certificado expira en ${data.daysRemaining}d. Renueve: ${data.renewUrl || "www.facturaxpress.sv"}`;

    case "invoice_failed":
      return `❌ Error transmitiendo factura #${data.invoiceNumber}. Reintente o contacte soporte.`;

    default:
      return data.body || "Notificación de FacturaXpress";
  }
}

// ============================================
// INTERFAZ PÚBLICA
// ============================================

export async function sendNotification(
  request: NotificationRequest,
  maxRetries: number = 3
): Promise<NotificationResult> {
  const { channel, recipient, type, subject, body, metadata = {} } = request;

  try {
    switch (channel) {
      case "email": {
        const template = getEmailTemplate(type, metadata);
        return await sendEmail(recipient, subject || template.subject, template.html);
      }

      case "sms": {
        const smsBody = getSMSTemplate(type, metadata);
        return await sendSMS(recipient, smsBody);
      }

      case "webhook": {
        const payload = {
          tenantId: request.tenantId,
          type,
          timestamp: new Date().toISOString(),
          metadata,
        };
        return await sendWebhook(recipient, payload, maxRetries);
      }

      default:
        return {
          success: false,
          error: `Canal desconocido: ${channel}`,
          channel,
          timestamp: new Date(),
        };
    }
  } catch (error) {
    return {
      success: false,
      error: (error as Error).message,
      channel,
      timestamp: new Date(),
    };
  }
}

export async function sendBulkNotifications(
  requests: NotificationRequest[]
): Promise<NotificationResult[]> {
  return Promise.all(requests.map((req) => sendNotification(req)));
}

export function isEmailConfigured(): boolean {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
  );
}

export function isSMSConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM_NUMBER
  );
}

export function isWebhookConfigured(): boolean {
  return true; // Los webhooks no necesitan configuración global
}
