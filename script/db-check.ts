import "dotenv/config";
import { queryClient } from "../server/db";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("❌ DATABASE_URL no está definido. Revisa tu .env.");
    process.exit(1);
  }

  console.log("🔍 Verificando conexión a la base de datos...");
  console.log(`➡️  HOST: ${new URL(url).hostname}`);
  console.log(`➡️  SSL: ${process.env.DATABASE_SSL === "false" ? "desactivado" : "activado"}`);

  try {
    const [row] = await queryClient<{ ok: number }[]>`SELECT 1 as ok`;
    console.log("✅ Conexión exitosa. Respuesta:", row);
    process.exit(0);
  } catch (error) {
    console.error("❌ Error de conexión:", error);
    console.error("Sugerencias: usa el host del pooler de Supabase y sslmode=require");
    process.exit(1);
  }
}

void main();
