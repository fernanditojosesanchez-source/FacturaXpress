import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function migrateManually() {
  console.log("🛠️ Iniciando migración manual...");
  try {
    // 1. Agregar columna 'modules' a 'tenants'
    await db.execute(sql`ALTER TABLE tenants ADD COLUMN IF NOT EXISTS modules jsonb DEFAULT '{}'::jsonb`);
    console.log("✅ Columna 'modules' agregada a 'tenants'");

    // 2. Agregar columna 'external_id' a 'facturas'
    await db.execute(sql`ALTER TABLE facturas ADD COLUMN IF NOT EXISTS external_id text`);
    console.log("✅ Columna 'external_id' agregada a 'facturas'");

    // 3. Agregar columnas faltantes a 'users'
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email text UNIQUE`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS account_locked boolean DEFAULT false`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS lock_until timestamp`);
    await db.execute(sql`ALTER TABLE users ADD COLUMN IF NOT EXISTS created_at timestamp NOT NULL DEFAULT now()`);
    console.log("✅ Columnas de seguridad y auditoría agregadas a 'users'");

    // 4. Crear tabla 'api_keys' si no existe
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS api_keys (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL REFERENCES tenants(id),
        key text UNIQUE NOT NULL,
        name text NOT NULL,
        active boolean DEFAULT true,
        last_used_at timestamp,
        created_at timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log("✅ Tabla 'api_keys' creada");

    console.log("✨ Migración manual completada exitosamente.");
  } catch (error) {
    console.error("❌ Error en migración manual:", error);
  } finally {
    process.exit(0);
  }
}

migrateManually();
