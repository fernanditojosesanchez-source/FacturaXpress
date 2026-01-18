// tests/setup.ts - Configuración global de tests
import { config } from "dotenv";

// Cargar variables de entorno: primero .env.test, luego .env como fallback
config({ path: ".env.test" });
config();

// Asegurar DATABASE_URL presente para evitar throws al importar db.ts
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "postgres://postgres:postgres@127.0.0.1:5432/test";
}

// Configurar modo de pruebas para evitar side effects
process.env.NODE_ENV = "test";
process.env.MH_MODO_MOCK = "true"; // Forzar modo mock para tests
