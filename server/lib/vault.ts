/**
 * Vault Security Service
 * Manejo estricto de secretos sensibles usando Supabase Vault
 * 
 * POLÍTICAS DE SEGURIDAD:
 * - Certificados P12: SIEMPRE en Vault (nunca en DB directa)
 * - Contraseñas: SIEMPRE en Vault (nunca en DB directa)
 * - API Keys: SIEMPRE en Vault (nunca en DB directa)
 * - Credenciales MH: SIEMPRE en Vault (nunca en DB directa)
 */

import { db } from "../db.js";
import { sql } from "drizzle-orm";

export type VaultSecretType = "cert_p12" | "cert_password" | "mh_password" | "api_key" | "user_credentials";

export interface VaultSecretConfig {
  tenantId: string;
  secretType: VaultSecretType;
  referenceName: string;
  secretContent: string;
  userId: string;
  ipAddress?: string;
}

/**
 * Guardar secreto en Vault (ESTRICTO)
 * @throws Error si falla
 */
export async function saveSecretToVault(config: VaultSecretConfig): Promise<string> {
  const { tenantId, secretType, referenceName, secretContent, userId, ipAddress } = config;

  // Validaciones estrictas
  if (!secretContent || secretContent.trim().length === 0) {
    throw new Error("El contenido del secreto no puede estar vacío");
  }

  if (secretContent.length > 100000) {
    throw new Error("El secreto es demasiado grande (máximo 100KB)");
  }

  // Tipos de secreto permitidos
  const allowedTypes: VaultSecretType[] = ["cert_p12", "cert_password", "mh_password", "api_key", "user_credentials"];
  if (!allowedTypes.includes(secretType)) {
    throw new Error(`Tipo de secreto no válido: ${secretType}`);
  }

  try {
    // Crear secreto en Vault a través de PostgreSQL
    const secretName = `${tenantId}_${secretType}_${referenceName}`;
    const secretDescription = `Secret ${secretType} for tenant ${tenantId}`;
    
    const result = await db.execute(
      sql`SELECT vault.create_secret(
        ${secretContent},
        ${secretName},
        ${secretDescription}
      ) as secret_id`
    );

    const secretId = (result[0] as any)?.secret_id;

    if (!secretId) {
      throw new Error("No se pudo crear el secreto en Vault");
    }

    // Registrar en vault_references (con manejo de duplicados)
    await db.execute(
      sql`INSERT INTO public.vault_references (tenant_id, secret_type, secret_id, reference_name, created_by)
          VALUES (
            ${tenantId},
            ${secretType},
            ${secretId},
            ${referenceName},
            ${userId}
          )
          ON CONFLICT (tenant_id, secret_type, reference_name) 
          DO UPDATE SET secret_id = EXCLUDED.secret_id, updated_at = NOW()`
    );

    // Log de auditoría
    await logVaultAccess({
      userId,
      tenantId,
      action: "write",
      secretType,
      success: true,
      ipAddress,
    });

    console.log(`✅ Secreto guardado en Vault: ${secretType}/${referenceName}`);
    return secretId;
  } catch (error) {
    // Log de auditoría de fallo
    await logVaultAccess({
      userId,
      tenantId,
      action: "write",
      secretType,
      success: false,
      ipAddress,
      errorMessage: (error as Error).message,
    }).catch(() => {}); // Ignorar errores en auditoría

    throw new Error(`Error al guardar secreto en Vault: ${(error as Error).message}`);
  }
}

/**
 * Obtener secreto de Vault (DESENCRIPTADO)
 * CUIDADO: Solo usar dentro del servidor, nunca enviar al cliente
 * @throws Error si no existe o falla
 */
export async function getSecretFromVault(
  tenantId: string,
  secretType: VaultSecretType,
  referenceName: string,
  userId: string,
  ipAddress?: string
): Promise<string> {
  try {
    // Obtener secreto desencriptado
    const result = await db.execute(
      sql`SELECT decrypted_secret 
          FROM vault.decrypted_secrets vs
          INNER JOIN public.vault_references vr ON vs.id = vr.secret_id
          WHERE vr.tenant_id = ${tenantId}
            AND vr.secret_type = ${secretType}
            AND vr.reference_name = ${referenceName}
          LIMIT 1`
    );

    if (!result || result.length === 0) {
      throw new Error(`Secreto no encontrado: ${secretType}/${referenceName}`);
    }

    const secret = (result[0] as any)?.decrypted_secret;

    if (!secret) {
      throw new Error("Fallo al desencriptar secreto");
    }

    // Log de auditoría
    await logVaultAccess({
      userId,
      tenantId,
      action: "read",
      secretType,
      success: true,
      ipAddress,
    });

    return secret;
  } catch (error) {
    // Log de auditoría de fallo
    await logVaultAccess({
      userId,
      tenantId,
      action: "read",
      secretType,
      success: false,
      ipAddress,
      errorMessage: (error as Error).message,
    }).catch(() => {}); // Ignorar errores en auditoría

    throw new Error(`Error al obtener secreto de Vault: ${(error as Error).message}`);
  }
}

/**
 * Eliminar secreto de Vault (IRREVERSIBLE)
 * @throws Error si falla
 */
export async function deleteSecretFromVault(
  tenantId: string,
  secretType: VaultSecretType,
  referenceName: string,
  userId: string,
  ipAddress?: string
): Promise<void> {
  try {
    // Obtener ID del secreto primero
    const result = await db.execute(
      sql`SELECT secret_id FROM public.vault_references
          WHERE tenant_id = ${tenantId}
            AND secret_type = ${secretType}
            AND reference_name = ${referenceName}
          LIMIT 1`
    );

    if (!result || result.length === 0) {
      throw new Error(`Secreto no encontrado: ${secretType}/${referenceName}`);
    }

    const secretId = (result[0] as any)?.secret_id;

    // Eliminar de Vault
    await db.execute(
      sql`DELETE FROM vault.secrets WHERE id = ${secretId}`
    );

    // Eliminar referencia
    await db.execute(
      sql`DELETE FROM public.vault_references
          WHERE tenant_id = ${tenantId}
            AND secret_type = ${secretType}
            AND reference_name = ${referenceName}`
    );

    // Log de auditoría
    await logVaultAccess({
      userId,
      tenantId,
      action: "delete",
      secretType,
      success: true,
      ipAddress,
    });

    console.log(`✅ Secreto eliminado de Vault: ${secretType}/${referenceName}`);
  } catch (error) {
    // Log de auditoría de fallo
    await logVaultAccess({
      userId,
      tenantId,
      action: "delete",
      secretType,
      success: false,
      ipAddress,
      errorMessage: (error as Error).message,
    }).catch(() => {}); // Ignorar errores en auditoría

    throw new Error(`Error al eliminar secreto de Vault: ${(error as Error).message}`);
  }
}

/**
 * Registrar acceso a Vault en auditoría
 */
async function logVaultAccess(config: {
  userId: string;
  tenantId: string;
  action: "read" | "write" | "delete" | "failed_access";
  secretType: VaultSecretType;
  success: boolean;
  ipAddress?: string;
  errorMessage?: string;
}): Promise<void> {
  try {
    await db.execute(
      sql`INSERT INTO public.vault_access_log (user_id, tenant_id, action, secret_type, success, ip_address, error_message)
          VALUES (
            ${config.userId},
            ${config.tenantId},
            ${config.action},
            ${config.secretType},
            ${config.success},
            ${config.ipAddress || null},
            ${config.errorMessage || null}
          )`
    );
  } catch (error) {
    // No logear errores de clave foránea ya que el user_id puede no existir en testing
    const isFKError = error && (error as any).code === '23503';
    if (!isFKError) {
      console.error("Error registrando acceso a Vault:", error);
    }
  }
}

/**
 * Validar que un secreto existe en Vault
 */
export async function secretExists(
  tenantId: string,
  secretType: VaultSecretType,
  referenceName: string
): Promise<boolean> {
  try {
    const result = await db.execute(
      sql`SELECT 1 FROM public.vault_references
          WHERE tenant_id = ${tenantId}
            AND secret_type = ${secretType}
            AND reference_name = ${referenceName}
          LIMIT 1`
    );

    return result && result.length > 0;
  } catch {
    return false;
  }
}

/**
 * Obtener todos los secretos de un tenant (sin desencriptar)
 * Solo metadatos para auditoría/gestión
 */
export async function listTenantSecrets(tenantId: string) {
  try {
    const result = await db.execute(
      sql`SELECT secret_type, reference_name, created_at, created_by, updated_at
          FROM public.vault_references
          WHERE tenant_id = ${tenantId}::uuid
          ORDER BY created_at DESC`
    );

    return (result || []) as unknown as Array<{
      secret_type: string;
      reference_name: string;
      created_at: string;
      created_by: string;
      updated_at: string;
    }>;
  } catch (error) {
    console.error("Error listando secrets:", error);
    return [];
  }
}
