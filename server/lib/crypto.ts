import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// La clave maestra debe venir de las variables de entorno para máxima seguridad
const ALGORITHM = "aes-256-cbc";

if (process.env.NODE_ENV === "production" && !process.env.ENCRYPTION_KEY) {
  throw new Error("CRITICAL: ENCRYPTION_KEY environment variable is required in production.");
}

const MASTER_KEY = process.env.ENCRYPTION_KEY || "default-secret-key-change-it-in-prod";

// Derivar una clave de 32 bytes a partir de la MASTER_KEY
// const key = scryptSync(MASTER_KEY, "salt", 32); // REMOVED: Static key with static salt

export function encrypt(text: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(MASTER_KEY, salt, 32);
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${salt.toString("hex")}:${iv.toString("hex")}:${encrypted}`;
}

export function decrypt(text: string): string {
  const parts = text.split(":");
  
  let salt: Buffer;
  let ivHex: string;
  let encryptedText: string;

  if (parts.length === 3) {
    // New format: salt:iv:ciphertext
    salt = Buffer.from(parts[0], "hex");
    ivHex = parts[1];
    encryptedText = parts[2];
  } else if (parts.length === 2) {
    // Legacy format: iv:ciphertext (uses static salt "salt")
    salt = Buffer.from("salt"); // The hardcoded salt from previous version
    ivHex = parts[0];
    encryptedText = parts[1];
  } else {
    throw new Error("Formato de texto encriptado inválido");
  }

  if (!ivHex || !encryptedText) {
    throw new Error("Datos de encriptación corruptos");
  }

  const key = scryptSync(MASTER_KEY, salt, 32);
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
