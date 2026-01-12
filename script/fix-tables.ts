import { db } from "../server/db";
import { sql } from "drizzle-orm";

async function createTables() {
  console.log("🛠️ Verificando y creando tablas faltantes...");
  try {
    // Crear tabla certificados si no existe
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS certificados (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        nombre text NOT NULL,
        archivo text NOT NULL,
        huella text NOT NULL,
        algoritmo text DEFAULT 'RSA',
        emisor text,
        sujeto text,
        valido_desde timestamp,
        valido_hasta timestamp,
        dias_para_expiracion integer,
        contrasena_enc text,
        estado text DEFAULT 'pendiente',
        activo boolean DEFAULT false,
        es_productivo boolean DEFAULT false,
        certificado_valido boolean DEFAULT false,
        ultima_validacion timestamp,
        errores_validacion jsonb,
        url_descarga text,
        creado_por varchar,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT unq_huella UNIQUE(tenant_id, huella)
      )
    `);
    console.log("✅ Tabla 'certificados' verificada/creada");

    // Crear tabla receptores si no existe
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS receptores (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        tipo_documento text NOT NULL,
        num_documento text NOT NULL,
        nombre text NOT NULL,
        nrc text,
        cod_actividad text,
        desc_actividad text,
        direccion jsonb NOT NULL,
        telefono text,
        correo text,
        created_at timestamp NOT NULL DEFAULT now(),
        CONSTRAINT unq_doc UNIQUE(tenant_id, num_documento)
      )
    `);
    console.log("✅ Tabla 'receptores' verificada/creada");

    // Crear tabla productos si no existe
    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS productos (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        tenant_id uuid NOT NULL,
        nombre text NOT NULL,
        codigo text,
        descripcion text,
        precio_unitario decimal(16, 6) NOT NULL,
        uni_medida integer DEFAULT 20,
        tipo_item text DEFAULT '2',
        activo boolean DEFAULT true,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);
    console.log("✅ Tabla 'productos' verificada/creada");

    console.log("✨ Tablas verificadas exitosamente.");
  } catch (error) {
    console.error("❌ Error verificando tablas:", error);
  } finally {
    process.exit(0);
  }
}

createTables();
