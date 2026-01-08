import "dotenv/config";
import { storage } from "../server/storage";
import fs from "fs";

async function main() {
  console.log("Seeding default tenant credentials...");
  
  const tenant = await storage.ensureDefaultTenant();
  console.log(`Using tenant: ${tenant.nombre} (${tenant.id})`);
  
  const p12Base64 = fs.readFileSync("test-cert.p12.base64", "utf8").trim();
  
  await storage.saveTenantCredentials(tenant.id, {
    mhUsuario: "test-user",
    mhPass: "test-pass",
    certificadoP12: p12Base64,
    certificadoPass: "password123",
    ambiente: "pruebas"
  });
  
  console.log("✅ Credenciales de prueba guardadas para el tenant por defecto.");
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
