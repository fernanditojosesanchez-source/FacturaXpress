import "dotenv/config";
import { storage } from "../server/storage";
import { db } from "../server/db";
import { users } from "../shared/schema";
import { eq } from "drizzle-orm";
import bcrypt from "bcrypt";

async function resetAdmin() {
  console.log("🛠️  Reseteando usuario 'admin'...");

  try {
    const password = "admin";
    const hashedPassword = await bcrypt.hash(password, 10);
    
    // 1. Verificar si existe
    const existing = await storage.getUserByUsername("admin");
    const tenant = await storage.ensureDefaultTenant(); // Obtener siempre el tenant
    
    if (existing) {
      // Actualizar
      await db.update(users)
        .set({ 
          password: hashedPassword,
          accountLocked: false,
          lockUntil: null,
          role: "super_admin",
          tenantId: tenant.id // <--- IMPORTANTE: Forzar el vínculo con el tenant
        })
        .where(eq(users.username, "admin"));
      console.log(`✅ Usuario 'admin' actualizado y vinculado al tenant: ${tenant.nombre}`);
    } else {
      // Crear de cero
      const tenant = await storage.ensureDefaultTenant();
      await storage.createUser({
        username: "admin",
        password: hashedPassword,
        role: "super_admin",
        tenantId: tenant.id
      });
      console.log("✅ Usuario 'admin' creado desde cero. Contraseña: 'admin'");
    }

  } catch (error) {
    console.error("❌ Error al resetear admin:", error);
  } finally {
    process.exit(0);
  }
}

resetAdmin();
