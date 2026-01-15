# 🚀 VAULT QUICK START GUIDE

**Para:** Desarrolladores  
**Tiempo de lectura:** 5 minutos  
**Actualizado:** 2026-01-14

---

## TL;DR - Lo Esencial

Desde ahora, **TODOS** los datos sensibles van a Vault. Punto. Final.

```typescript
// ❌ VIEJO (NUNCA HACER)
const encrypted = encrypt(certificate);
await db.tenantCredentials.save({ certificate: encrypted });

// ✅ NUEVO (SIEMPRE)
await storage.saveCertificateToVault(tenantId, p12, userId, ipAddress);
```

---

## 1️⃣ GUARDAR UN SECRETO

### Para: Certificado P12

```typescript
import { storage } from "../storage";

const p12Base64 = Buffer.from(uploadedFile).toString("base64");

await storage.saveCertificateToVault(
  tenantId,              // Tu tenant ID
  p12Base64,             // Base64 del archivo P12
  req.user.id,           // Quién lo guarda
  req.socket.remoteAddress // IP de origen
);

// ✅ Ya está encriptado y auditado automáticamente
```

### Para: Contraseña del Certificado

```typescript
await storage.saveCertificatePasswordToVault(
  tenantId,
  "MiContraseña123",
  req.user.id,
  getClientIP(req)
);
```

### Para: Credenciales MH

```typescript
await storage.saveMHCredentialsToVault(
  tenantId,
  "usuario@mh.gob.do",
  "MiPassword456",
  req.user.id,
  getClientIP(req)
);
```

---

## 2️⃣ LEER UN SECRETO

### Para: Certificado P12

```typescript
try {
  const p12Base64 = await storage.getCertificateFromVault(
    tenantId,
    req.user.id,
    getClientIP(req)
  );
  
  // Usar internamente
  const signature = signXML(document, p12Base64, password);
  
  // ❌ NUNCA:
  // res.json({ certificate: p12Base64 }); 
  
  // ✅ SIEMPRE:
  res.json({ success: true, signature });
  
} catch (err) {
  // Error automáticamente auditado
  res.status(401).json({ error: "Acceso denegado" });
}
```

### Para: Credenciales MH

```typescript
const { usuario, password } = await storage.getMHCredentialsFromVault(
  tenantId,
  req.user.id,
  getClientIP(req)
);

// Usar para conectar a MH
const result = await mhService.sendDocument(documento, usuario, password);
```

---

## 3️⃣ VERIFICAR SI EXISTE

```typescript
const hasCert = await storage.secretExists(tenantId, "cert_p12");

if (hasCert) {
  // Tiene certificado
  res.json({ hasCertificate: true });
} else {
  // No tiene, mostrar formulario de upload
  res.json({ hasCertificate: false });
}
```

---

## 4️⃣ ELIMINAR UN SECRETO

```typescript
// Verificar permisos primero
if (req.user.role !== "tenant_admin" && req.user.role !== "super_admin") {
  return res.status(403).json({ error: "No autorizado" });
}

// Eliminar (IRREVERSIBLE)
await storage.deleteCertificateSecretsFromVault(
  tenantId,
  req.user.id,
  getClientIP(req)
);

res.json({ success: true, message: "Certificado eliminado" });
```

---

## 5️⃣ REVISAR AUDITORÍA

```sql
-- Ver quién accedió a qué, cuándo, desde dónde
SELECT 
  user_id,
  action,
  secret_type,
  success,
  ip_address,
  error_message,
  created_at
FROM vault_access_log
WHERE tenant_id = 'abc-123-def'
ORDER BY created_at DESC
LIMIT 50;
```

---

## ⚠️ REGLAS IMPORTANTES

### Nunca

```typescript
❌ Log del secreto              → console.log(password);
❌ Enviar al cliente            → res.json({ certificate });
❌ Guardar en BD normal         → db.save({ certificate });
❌ Ignorar errores              → try { } catch { }
❌ Hardcodear secrets           → const PASS = "123";
```

### Siempre

```typescript
✅ Usar storage.* methods       → await storage.getCertificateFromVault()
✅ Pasar userId e IP            → storage.save(..., userId, ipAddress)
✅ Usar en servidor             → const p12 = await storage.get(...)
✅ Fallar si error              → throw err;
✅ Rotar contraseñas            → Crear nuevo secret, eliminar viejo
```

---

## 🔍 EJEMPLOS REALES

### Ejemplo 1: Endpoint para subir certificado

```typescript
app.post("/api/certificados/upload", requireAuth, async (req: any, res) => {
  const { p12Base64, contraseña } = req.body;
  
  // Validar
  if (!p12Base64 || !contraseña) {
    return res.status(400).json({ error: "Datos incompletos" });
  }
  
  // Guardar en Vault
  await storage.saveCertificateToVault(
    req.tenant.id,
    p12Base64,
    req.user.id,
    req.socket.remoteAddress
  );
  
  await storage.saveCertificatePasswordToVault(
    req.tenant.id,
    contraseña,
    req.user.id,
    req.socket.remoteAddress
  );
  
  // Respuesta (SIN el certificado)
  res.json({ 
    success: true,
    message: "Certificado guardado correctamente"
  });
});
```

### Ejemplo 2: Usar certificado para firmar

```typescript
app.post("/api/facturas/:id/firmar", requireAuth, async (req: any, res) => {
  const factura = await db.facturas.findOne(req.params.id);
  
  // Obtener credenciales del Vault
  const p12 = await storage.getCertificateFromVault(
    req.tenant.id,
    req.user.id,
    req.socket.remoteAddress
  );
  
  const password = await storage.getCertificatePasswordFromVault(
    req.tenant.id,
    req.user.id,
    req.socket.remoteAddress
  );
  
  // Firmar (localmente en el servidor)
  const facturaFirmada = signFactura(factura, p12, password);
  
  // Guardar localmente (sin el certificado)
  await db.facturas.update(req.params.id, { 
    signed: true,
    firmadoAt: new Date()
  });
  
  // Enviar a MH
  const result = await mhService.send(facturaFirmada);
  
  // Responder al cliente (SIN certificado ni contraseña)
  res.json({
    success: true,
    facturaId: factura.id,
    estatusMH: result.status,
    // El certificado NUNCA sale de aquí
  });
});
```

### Ejemplo 3: Credenciales MH

```typescript
app.post("/api/mh-credentials", requireAuth, async (req: any, res) => {
  const { usuario, password } = req.body;
  
  // Guardar en Vault (nunca en BD normal)
  await storage.saveMHCredentialsToVault(
    req.tenant.id,
    usuario,
    password,
    req.user.id,
    req.socket.remoteAddress
  );
  
  res.json({ success: true });
});

// Cuando se necesita usar
app.post("/api/connect-mh", requireAuth, async (req: any, res) => {
  const { usuario, password } = await storage.getMHCredentialsFromVault(
    req.tenant.id,
    req.user.id,
    req.socket.remoteAddress
  );
  
  // Conectar a MH
  const mhSession = await mhService.login(usuario, password);
  
  res.json({ 
    connected: !!mhSession,
    // Credenciales NUNCA se retornan
  });
});
```

---

## 🧪 TESTEAR VAULT

```bash
# Ver que Vault funciona
npx ts-node scripts/test-vault.ts

# Esperado
✅ TODOS LOS TESTS PASARON (9/9 - 100%)
```

---

## 📚 MÁS INFORMACIÓN

| Documento | Para |
|-----------|------|
| `VAULT_SECURITY_POLICY.md` | Políticas y reglas de seguridad |
| `VAULT_IMPLEMENTATION_STATUS.md` | Estado técnico, troubleshooting |
| `VAULT_COMPLETION_SUMMARY.md` | Resumen de implementación |
| `server/lib/vault.ts` | Documentación de funciones |

---

## ✅ CHECKLIST ANTES DE COMMIT

```
[ ] ¿Estoy usando storage.* para guardar secretos?
[ ] ¿Le paso userId e ipAddress?
[ ] ¿Estoy usando el secreto SOLO en el servidor?
[ ] ¿Nunca exponiendo el secreto al cliente?
[ ] ¿Manejando errores correctamente?
[ ] ¿Sin hardcodear secretos?
[ ] ¿Build sin errores (npm run build)?
```

---

## 🔗 COMMANDS ÚTILES

```bash
# Build
npm run build

# Test Vault
npx ts-node scripts/test-vault.ts

# Ver auditoría (si tienes acceso a Supabase)
# SELECT * FROM vault_access_log ORDER BY created_at DESC LIMIT 50;

# Listar secretos guardados (sin ver contenido)
# SELECT id, tenant_id, secret_type, reference_name FROM vault_references;
```

---

**Remember:** 🔒 De ahora en adelante, Vault es el ÚNICO lugar para secretos.

¿Preguntas? Ver `VAULT_SECURITY_POLICY.md` o revisar ejemplos en `server/routes/certificados.ts`.
