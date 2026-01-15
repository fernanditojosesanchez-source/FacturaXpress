# Circuit Breaker para API del Ministerio de Hacienda

## Problema

Cuando la API del Ministerio de Hacienda está caída o no responde:
1. **Sin Circuit Breaker**: Cada request espera timeout (10-30s) → Sistema se congela
2. **Cascada de fallos**: Usuarios esperan, se agotan recursos, se bloquea todo el sistema
3. **Experiencia de usuario**: Facturas no se envían, anulaciones cuelgan

## Solución: Circuit Breaker Pattern

Implementación de **Circuit Breaker** en [server/lib/circuit-breaker.ts](server/lib/circuit-breaker.ts) que protege la API MH.

### Estados del Circuit

```
        5 fallos consecutivos
              ↓
    ┌─────────────────────────────┐
    │  CLOSED (Normal)            │  Request → MH API
    │  ✅ Todo funciona           │
    └──────────────┬──────────────┘
                   │
              (fallos acumulan)
                   ↓
    ┌─────────────────────────────┐
    │  OPEN (Caído)               │  Request → Contingencia
    │  🔴 MH no disponible        │  (sin esperar MH)
    └──────────────┬──────────────┘
                   │
          (esperar 5s base)
          (aumenta con backoff 2x)
                   ↓
    ┌─────────────────────────────┐
    │  HALF_OPEN (Probando)       │  1 request de prueba
    │  🔄 Intentando recuperación │
    └──────────────┬──────────────┘
                   │
        ┌──────────┴──────────┐
        │ (éxito)      (fallo)│
        ↓                    ↓
      CLOSED             OPEN (con backoff)
   (2 éxitos)        (vuelve a esperar)
```

## Configuración

```typescript
// server/lib/circuit-breaker.ts
const mhBreaker = new CircuitBreaker({
  failureThreshold: 5,      // 5 fallos → OPEN
  successThreshold: 2,      // 2 éxitos en HALF_OPEN → CLOSED
  timeout: 60000,           // 1 minuto antes de intentar HALF_OPEN
  resetTimeout: 5000,       // 5 segundos base (exponencial: 5s → 10s → 20s → ...)
});
```

### Parámetros

| Parámetro | Valor | Razón |
|-----------|-------|-------|
| `failureThreshold` | 5 | 5 fallos = problema confirmado |
| `successThreshold` | 2 | 2 éxitos = recuperación confirmada |
| `timeout` | 60000 ms | Esperar 1 minuto antes de HALF_OPEN |
| `resetTimeout` | 5000 ms | Backoff exponencial: 5s → 10s → 20s... |

**Backoff Exponencial**: Cuando MH sigue caído, las esperas se multiplican por 2 (máx 8x):
- 1er intento: 5s
- 2do intento: 10s
- 3er intento: 20s
- 4to intento: 40s (máx 40s)

## Integración en mhService

### Clase: MHServiceWithBreaker

Envuelve el servicio real con Circuit Breaker:

```typescript
class MHServiceWithBreaker implements MHService {
  private innerService: MHService;
  private breaker = getMHCircuitBreaker();

  async transmitirDTE(factura, tenantId): Promise<SelloMH> {
    if (this.breaker.isOpen()) {
      // Encolar en contingencia automáticamente
      await storage.enqueueContinencia({...});
      return { estado: "PENDIENTE", selloRecibido: "TEMP-..." };
    }
    
    // Intentar con protección del breaker
    return await this.breaker.execute(() =>
      this.innerService.transmitirDTE(factura, tenantId)
    );
  }
  
  // Similar para: anularDTE, invalidarDTE
}
```

### Flujo cuando MH está CAÍDO

```
1. Cliente: POST /api/facturas/enviar
   ├─ circuitBreaker.isOpen()? → SÍ
   │  └─ Encolar en storage.contingencia
   │  └─ Retornar { estado: "PENDIENTE", selloRecibido: "TEMP-..." }
   │
2. Cliente recibe: "Factura encolada. Se enviará cuando MH se recupere"
3. Storage.procesarColaContingencia() corre en background
   ├─ Cuando circuit → HALF_OPEN, intenta enviar
   ├─ Si éxito → CLOSED, procesa toda la cola
   └─ Si fallo → OPEN (con backoff), reintenta después
```

## Comportamiento por Endpoint

### `transmitirDTE` (Crítica)
- **Circuit CLOSED**: Envía directo a MH
- **Circuit OPEN**: Encola en contingencia automáticamente
- **Respuesta**: `{ estado: "PENDIENTE", selloRecibido: "TEMP-..." }` (sin espera)

### `consultarEstado` (Lectura)
- **Circuit CLOSED**: Consulta a MH
- **Circuit OPEN**: Retorna `{ estado: "NO_ENCONTRADO", mensaje: "MH no disponible" }`
- **No bloquea**: Intentamos en todos los casos

### `anularDTE` / `invalidarDTE`
- **Circuit CLOSED**: Intenta invalidar
- **Circuit OPEN**: Encola en contingencia automáticamente
- **Respuesta**: Confirmación de encolamiento (sin esperar MH)

### `procesarColaContingencia`
- Procesa incluso si circuit está OPEN
- Reintentos automáticos con backoff exponencial
- Éxitos en contingencia no afectan estado del breaker

## Monitoreo

### Estado del Circuit Breaker

```typescript
// En un endpoint de health check
const status = mhBreaker.getStatus();
// {
//   state: "CLOSED" | "OPEN" | "HALF_OPEN",
//   failureCount: 0-5,
//   successCount: 0-2,
//   backoffMultiplier: 1-8,
//   nextRetryIn: 0-40000  (milliseconds)
// }
```

### Logs Automáticos

```
✅ Circuit Breaker: éxito en CLOSED
⚠️  Circuit Breaker: fallo en CLOSED (2/5)
⚠️  Circuit Breaker: CLOSED → OPEN (5 fallos consecutivos)
🔄 Circuit Breaker: OPEN → HALF_OPEN (intentando recuperación)
✅ Circuit Breaker: HALF_OPEN → CLOSED (MH recuperado)
⚠️  Circuit Breaker: HALF_OPEN → OPEN (fallo en prueba, backoff 2x)
🔧 Circuit Breaker: reset manual
```

## Casos de Uso

### 1. MH Normal (Circuit CLOSED)
```
Cliente → POST /api/facturas/enviar
  ├─ Breaker.execute() → transmitirDTE()
  ├─ MH responde: { estado: "PROCESADO", selloRecibido: "..." }
  └─ Cliente: ✅ Factura enviada
  
Tiempo: ~2-5 segundos
```

### 2. MH Caído de Repente (5 fallos)
```
1er request → timeout → failureCount = 1
2do request → timeout → failureCount = 2
3er request → timeout → failureCount = 3
4to request → timeout → failureCount = 4
5to request → timeout → failureCount = 5 → OPEN 🔴

6to request → ¡Inmediato!
  ├─ Breaker.isOpen()? → SÍ
  ├─ Encolar en contingencia
  └─ Retornar en <100ms (sin esperar MH)
```

### 3. MH Se Recupera
```
Esperando 60s (timeout) + 5s backoff...
HALF_OPEN: Intentar 1 request de prueba
  ├─ Éxito ✅ → successCount = 1
  └─ Esperar siguiente request
  
Siguiente request:
  ├─ Éxito ✅ → successCount = 2 → CLOSED
  └─ Procesar cola de contingencia (todas las facturas encoladas)

Tiempo total recuperación: ~65 segundos + procesamiento contingencia
```

## Alternativas Consideradas

### 1. Retry Simple (❌ Rechazado)
- Problema: Esperas largas acumuladas
- Solución: Circuit Breaker es mejor

### 2. Timeout Corto (❌ Rechazado)
- Problema: Muchos falsos positivos (red lenta)
- Solución: Circuit Breaker aprende patrón

### 3. Fallback a Almacenamiento Local (✅ Implementado)
- Queue de contingencia: Todas las facturas encoladas
- Workers independientes: Reintento automático
- Combo perfecto con Circuit Breaker

## Pruebas

### Test Manual: Simular MH Caído

```bash
# 1. Forzar MH_MOCK_MODE=false en desarrollo
MH_MOCK_MODE=false npm run dev

# 2. Apagar conectividad a MH (ej: firewall local)
# o detener servidor MH si existe

# 3. Enviar 5+ facturas
POST /api/facturas/enviar

# 4. Observar logs
# ⚠️  Circuit Breaker: CLOSED → OPEN (5 fallos consecutivos)

# 5. Siguiente request es instantáneo
# 🔴 Circuit OPEN: Encolando DTE en contingencia

# 6. Recuperar MH
# Esperar 60s + 5s backoff

# 7. Observar transición
# 🔄 Circuit Breaker: OPEN → HALF_OPEN
# ✅ Circuit Breaker: HALF_OPEN → CLOSED
# [Contingencia] Procesando cola pendiente...
```

### Test Unitario (To-Do)

```typescript
describe("CircuitBreaker", () => {
  test("CLOSED → OPEN after N failures", async () => {
    const breaker = new CircuitBreaker({ failureThreshold: 3 });
    
    // Simular 3 fallos
    breaker.recordFailure();
    breaker.recordFailure();
    breaker.recordFailure();
    
    expect(breaker.getState()).toBe(CircuitState.OPEN);
  });

  test("OPEN → HALF_OPEN after timeout", async () => {
    const breaker = new CircuitBreaker({ resetTimeout: 100 });
    breaker.recordFailure(); // x3
    expect(breaker.getState()).toBe(CircuitState.OPEN);
    
    await new Promise(r => setTimeout(r, 150));
    expect(breaker.getState()).toBe(CircuitState.HALF_OPEN);
  });

  test("fallback to contingency when OPEN", async () => {
    // Mock storage.enqueueContinencia
    // Llamar transmitirDTE mientras circuit OPEN
    // Verificar que se encola en contingencia
  });
});
```

## Roadmap

### ✅ Completado
- [x] Clase CircuitBreaker (server/lib/circuit-breaker.ts)
- [x] Enum CircuitState (CLOSED, OPEN, HALF_OPEN)
- [x] Métodos: execute(), recordSuccess(), recordFailure()
- [x] Backoff exponencial
- [x] Singleton getMHCircuitBreaker()
- [x] Integración en MHServiceWithBreaker
- [x] Fallback a contingencia automático
- [x] Logs de transiciones
- [x] getStatus() para monitoreo

### 🔄 En Progreso
- [ ] Endpoint de health check (GET /api/health/mh)
- [ ] Dashboard de estado del Circuit Breaker
- [ ] Métricas Prometheus (state, failureCount, backoffMultiplier)

### ⏳ Pendiente
- [ ] Tests unitarios
- [ ] Tests de integración
- [ ] Documentación de troubleshooting
- [ ] Rate limiting per-endpoint (paso siguiente)

## Referencias

- **Patrón**: [Circuit Breaker Pattern - Martin Fowler](https://martinfowler.com/bliki/CircuitBreaker.html)
- **Implementación**: [Resilience4j Java](https://resilience4j.readme.io/docs/circuitbreaker) (inspiración)
- **Backoff**: [Exponential Backoff - AWS SDK](https://docs.aws.amazon.com/general/latest/gr/error-retry-strategy.html)
