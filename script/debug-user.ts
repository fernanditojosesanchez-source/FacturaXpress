import "dotenv/config";
import { storage } from "../server/storage";

async function debugUser() {
  console.log("🕵️‍♂️ Investigando usuario 'admin'...");
  
  const admin = await storage.getUserByUsername("admin");
  if (!admin) {
    console.log("❌ El usuario admin NO existe.");
    return;
  }

  console.log(`👤 Usuario: ${admin.username} | Rol: ${admin.role}`);
  console.log(`🏢 Tenant ID del Usuario: ${admin.tenantId}`);

  const facturas = await storage.getFacturas(admin.tenantId || "");
  console.log(`📄 Facturas encontradas para este tenant: ${facturas.length}`);
  
  if (facturas.length > 0) {
    console.log("--- Últimas 3 facturas ---");
    facturas.slice(0, 3).forEach(f => {
      console.log(`- Fecha: ${f.fecEmi} | Cliente: ${f.receptor.nombre} | Total: $${f.resumen.totalPagar}`);
    });
  } else {
    console.log("⚠️ Este usuario NO tiene facturas visibles.");
    
    // Buscar si existen facturas en otros tenants
    console.log("\n--- Buscando en TODOS los tenants ---");
    const tenants = await storage.listTenants();
    for (const t of tenants) {
      if (t.id === admin.tenantId) continue;
      const fs = await storage.getFacturas(t.id);
      if (fs.length > 0) {
        console.log(`🚨 ENCONTRADO: Tenant '${t.nombre}' (${t.id}) tiene ${fs.length} facturas.`);
        console.log("   -> Tu usuario admin NO está viendo este tenant.");
      }
    }
  }

  process.exit(0);
}

debugUser();
