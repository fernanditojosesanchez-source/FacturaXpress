import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

// La clave maestra debe venir de las variables de entorno para máxima seguridad
const ALGORITHM = "aes-256-cbc";
const MASTER_KEY = process.env.ENCRYPTION_KEY || "default-secret-key-change-it-in-prod";

// Derivar una clave de 32 bytes a partir de la MASTER_KEY
const key = scryptSync(MASTER_KEY, "salt", 32);

export function encrypt(text: string): string {
  const iv = randomBytes(16);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return `${iv.toString("hex")}:${encrypted}`;
}

export function decrypt(text: string): string {
  const [ivHex, encryptedText] = text.split(":");
  if (!ivHex || !encryptedText) {
    throw new Error("Formato de texto encriptado inválido");
  }
  const iv = Buffer.from(ivHex, "hex");
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  let decrypted = decipher.update(encryptedText, "hex", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
