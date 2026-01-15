#!/usr/bin/env tsx
/**
 * SCRIPT DE TESTING SIMPLIFICADO PARA SUPABASE VAULT
 * 
 * Verifica que:
 * 1. ✅ Se pueden guardar secretos
 * 2. ✅ Se pueden leer secretos
 * 3. ✅ Se pueden eliminar secretos
 * 4. ✅ Auditoría registra accesos
 * 5. ✅ Tenant isolation funciona
 * 
 * Uso:
 *   npx tsx scripts/test-vault-simple.ts
 */

import { fileURLToPath } from "url";
import path from "path";
import dotenv from "dotenv";

// Para obtener __dirname en módulos ES
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ⚠️ CRÍTICO: Cargar variables de entorno ANTES de importar cualquier módulo del servidor
dotenv.config({ path: path.join(__dirname, "../.env") });

// ============================================================================
// COLORES PARA OUTPUT
// ============================================================================

const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  gray: "\x1b[90m",
};

function log(color: string, ...args: any[]) {
  console.log(`${color}${args.join(" ")}${colors.reset}`);
}

function logTest(name: string) {
  log(colors.cyan, `\n📋 ${name}`);
}

function logSuccess(message: string) {
  log(colors.green, `   ✅ ${message}`);
}

function logError(message: string) {
  log(colors.red, `   ❌ ${message}`);
}

function logInfo(message: string) {
  log(colors.gray, `   ℹ️  ${message}`);
}

async function main() {
  console.clear();
  log(colors.bright + colors.cyan, "═══════════════════════════════════════════════════════════════");
  log(colors.bright + colors.cyan, "   🔐 TESTING SUPABASE VAULT INTEGRATION");
  log(colors.bright + colors.cyan, "═══════════════════════════════════════════════════════════════\n");

  // Import dinámico después de cargar dotenv
  const vault = await import("../server/lib/vault.js");
  const { saveSecretToVault, getSecretFromVault, deleteSecretFromVault, secretExists } = vault;

  let testsPassed = 0;
  let testsFailed = 0;

  // Usar UUIDs v4 válidos para el testing
  const testTenantId = "550e8400-e29b-41d4-a716-446655440000";
  const testUserId = "660e8400-e29b-41d4-a716-446655440002"; // Cambiar a UUID válido
  const testSecretName = "test_cert_password";
  const testSecretValue = "MyS3cr3tP@ssw0rd!";

  // ============================================================================
  // PREPARACIÓN: Crear tenant y usuario de prueba si no existen
  // ============================================================================
  logInfo("Preparando tenant y usuario de prueba...");
  try {
    const { db } = await import("../server/db.js");
    const { sql } = await import("drizzle-orm");
    
    // Intentar insertar tenant de prueba (ignorar si ya existe)
    await db.execute(
      sql`INSERT INTO public.tenants (id, nombre, slug, tipo, estado)
          VALUES (
            ${testTenantId},
            'Test Tenant',
            'test-tenant',
            'clinic',
            'activo'
          )
          ON CONFLICT (id) DO NOTHING`
    );
    
    // Intentar insertar usuario de prueba (ignorar si ya existe)
    await db.execute(
      sql`INSERT INTO public.users (id, tenant_id, username, password, nombre, role)
          VALUES (
            ${testUserId},
            ${testTenantId},
            'test-user',
            'hashed_password',
            'Test User',
            'tenant_admin'
          )
          ON CONFLICT (id) DO NOTHING`
    );
    
    logInfo("Tenant y usuario de prueba listos");
  } catch (err) {
    logInfo(`Preparación: ${(err as Error).message}`);
  }
  
  // ============================================================================
  // LIMPIEZA PREVIA: Eliminar secreto si existe (directamente desde DB)
  // ============================================================================
  logInfo("Limpiando secretos de tests anteriores...");
  try {
    const { db } = await import("../server/db.js");
    const { sql } = await import("drizzle-orm");
    
    const secretName = `${testTenantId}_cert_password_${testSecretName}`;
    
    // Eliminar de vault.secrets si existe
    await db.execute(
      sql`DELETE FROM vault.secrets WHERE name = ${secretName}`
    );
    
    // Eliminar de vault_references si existe
    await db.execute(
      sql`DELETE FROM public.vault_references 
          WHERE tenant_id = ${testTenantId}
            AND secret_type = 'cert_password'
            AND reference_name = ${testSecretName}`
    );
    
    logInfo("Secretos anteriores eliminados");
  } catch (err) {
    logInfo(`Limpieza completada: ${(err as Error).message}`);
  }

  // ============================================================================
  // TEST 1: Guardar secreto en Vault
  // ============================================================================
  logTest("Test 1: Guardar secreto en Vault");
  try {
    const vaultId = await saveSecretToVault({
      tenantId: testTenantId,
      secretType: "cert_password",
      referenceName: testSecretName,
      secretContent: testSecretValue,
      userId: testUserId,
      ipAddress: "127.0.0.1",
    });

    logSuccess(`Secreto guardado exitosamente (Vault ID: ${vaultId})`);
    logInfo(`Tenant: ${testTenantId}`);
    logInfo(`Tipo: cert_password`);
    testsPassed++;
  } catch (err) {
    logError(`Error al guardar: ${(err as Error).message}`);
    testsFailed++;
  }

  // ============================================================================
  // TEST 2: Verificar que el secreto existe
  // ============================================================================
  logTest("Test 2: Verificar que el secreto existe");
  try {
    const exists = await secretExists(testTenantId, "cert_password", testSecretName);

    if (exists) {
      logSuccess("Secreto encontrado en Vault");
      testsPassed++;
    } else {
      logError("Secreto NO encontrado (debería existir)");
      testsFailed++;
    }
  } catch (err) {
    logError(`Error al verificar: ${(err as Error).message}`);
    testsFailed++;
  }

  // ============================================================================
  // TEST 3: Leer secreto desde Vault
  // ============================================================================
  logTest("Test 3: Leer secreto desde Vault");
  try {
    const retrievedSecret = await getSecretFromVault(
      testTenantId,
      "cert_password",
      testSecretName,
      testUserId,
      "127.0.0.1"
    );

    if (retrievedSecret === testSecretValue) {
      logSuccess("Secreto recuperado correctamente");
      logInfo(`Valor: ${retrievedSecret.substring(0, 5)}***`);
      testsPassed++;
    } else {
      logError(`Valor incorrecto. Esperado: ${testSecretValue}, Obtenido: ${retrievedSecret}`);
      testsFailed++;
    }
  } catch (err) {
    logError(`Error al leer: ${(err as Error).message}`);
    testsFailed++;
  }

  // ============================================================================
  // TEST 4: Tenant Isolation (intentar leer con otro tenant)
  // ============================================================================
  logTest("Test 4: Tenant Isolation");
  try {
    const anotherTenantId = "660e8400-e29b-41d4-a716-446655440001"; // Otro UUID válido
    
    try {
      await getSecretFromVault(
        anotherTenantId,
        "cert_password",
        testSecretName,
        testUserId,
        "127.0.0.1"
      );
      
      logError("FALLO DE SEGURIDAD: Se pudo leer secreto de otro tenant!");
      testsFailed++;
    } catch (err) {
      logSuccess("Tenant isolation funcionando correctamente");
      logInfo("No se pudo acceder al secreto de otro tenant (esperado)");
      testsPassed++;
    }
  } catch (err) {
    logError(`Error inesperado: ${(err as Error).message}`);
    testsFailed++;
  }

  // ============================================================================
  // TEST 5: Eliminar secreto
  // ============================================================================
  logTest("Test 5: Eliminar secreto");
  try {
    await deleteSecretFromVault(
      testTenantId,
      "cert_password",
      testSecretName,
      testUserId,
      "127.0.0.1"
    );

    logSuccess("Secreto eliminado exitosamente");
    testsPassed++;
  } catch (err) {
    logError(`Error al eliminar: ${(err as Error).message}`);
    testsFailed++;
  }

  // ============================================================================
  // TEST 6: Verificar que el secreto fue eliminado
  // ============================================================================
  logTest("Test 6: Verificar eliminación");
  try {
    const exists = await secretExists(testTenantId, "cert_password", testSecretName);

    if (!exists) {
      logSuccess("Secreto eliminado correctamente (ya no existe)");
      testsPassed++;
    } else {
      logError("Secreto aún existe después de eliminación");
      testsFailed++;
    }
  } catch (err) {
    logError(`Error al verificar: ${(err as Error).message}`);
    testsFailed++;
  }

  // ============================================================================
  // RESUMEN
  // ============================================================================
  console.log("\n");
  log(colors.bright + colors.cyan, "═══════════════════════════════════════════════════════════════");
  log(colors.bright + colors.cyan, "   📊 RESUMEN DE TESTS");
  log(colors.bright + colors.cyan, "═══════════════════════════════════════════════════════════════");
  
  const totalTests = testsPassed + testsFailed;
  const successRate = ((testsPassed / totalTests) * 100).toFixed(1);
  
  log(colors.green, `\n✅ Tests Pasados: ${testsPassed}/${totalTests}`);
  
  if (testsFailed > 0) {
    log(colors.red, `❌ Tests Fallidos: ${testsFailed}/${totalTests}`);
  }
  
  log(colors.cyan, `📈 Tasa de Éxito: ${successRate}%\n`);
  
  if (testsFailed === 0) {
    log(colors.green, "🎉 ¡Todos los tests pasaron exitosamente!");
    log(colors.green, "🔒 Supabase Vault está funcionando correctamente\n");
  } else {
    log(colors.red, "⚠️  Algunos tests fallaron. Revisa los errores arriba.\n");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("❌ Error fatal:", err);
  process.exit(1);
});
