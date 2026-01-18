// tests/setup.ts - Configuración global de tests
import { config } from "dotenv";

// Cargar variables de entorno
config();

// Verificar que DATABASE_URL está disponible
if (!process.env.DATABASE_URL) {
  console.warn("⚠️  DATABASE_URL no configurado, algunos tests pueden fallar");
}

// Configurar modo de pruebas para evitar side effects
process.env.NODE_ENV = "test";
process.env.MH_MODO_MOCK = "true"; // Forzar modo mock para tests
