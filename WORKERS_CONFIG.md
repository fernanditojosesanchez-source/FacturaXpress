# Variables de Entorno - Workers & Colas BullMQ

Este documento describe las variables de entorno relacionadas con **Workers BullMQ**, **Dead Letter Queues**, **Bull Board** y **métricas**.

---

## 🔧 Configuración de Colas

### Nombres de Colas

```bash
# Nombres de las colas BullMQ (opcional, defaults proporcionados)
Q_TRANSMISION_NAME=fx:transmision
Q_FIRMA_NAME=fx:firma
Q_NOTIFS_NAME=fx:notificaciones
```

**Defaults**:
- `fx:transmision` - Cola para firma + envío al MH
- `fx:firma` - Cola solo para firmado digital
- `fx:notificaciones` - Cola para Email/SMS/Webhooks

---

## ⚙️ Configuración de Workers

### Concurrency (Jobs simultáneos por worker)

```bash
# Transmisión: Jobs concurrentes (default: 5)
WORKER_TRANSMISION_CONCURRENCY=5

# Firma: Jobs concurrentes (default: 3)
WORKER_FIRMA_CONCURRENCY=3

# Notificaciones: Jobs concurrentes (default: 10)
WORKER_NOTIFICACIONES_CONCURRENCY=10
```

**Recomendaciones**:
- Transmisión: 3-10 (limitado por API del MH)
- Firma: 2-5 (CPU intensivo)
- Notificaciones: 10-50 (I/O bound)

### Rate Limiting de Workers

```bash
# Máximo de jobs por duración para transmisión
WORKER_TRANSMISION_RATE_MAX=10
WORKER_TRANSMISION_RATE_DURATION=1000  # ms
```

**Ejemplo**: 10 jobs cada 1000ms = máximo 600 jobs/minuto

---

## 🔄 Configuración de Dead Letter Queue

```bash
# Intentos antes de mover job a DLQ (default: 5)
BULLMQ_MAX_ATTEMPTS=5
```

**Backoff Exponencial**:
- Intento 1: 5 segundos
- Intento 2: 10 segundos
- Intento 3: 20 segundos
- Intento 4: 40 segundos
- Intento 5: 80 segundos

**TTL (Time To Live)**:
- Jobs completados: 7 días (mantiene últimos 1000)
- Jobs fallidos: 30 días (mantiene últimos 5000)

---

## 📊 Bull Board Dashboard

### Acceso al Dashboard

**URL**: `http://localhost:5000/admin/queues`

**Características**:
- ✅ Ver estado de todas las colas en tiempo real
- ✅ Inspeccionar jobs individuales (waiting, active, completed, failed, delayed)
- ✅ Reintentar jobs fallidos manualmente
- ✅ Ver logs y stack traces de errores
- ✅ Pausar/reanudar colas
- ✅ Limpiar jobs antiguos

**Seguridad**: Requiere autenticación de admin (configurar en producción)

---

## 📈 Métricas Prometheus

### Endpoint de Métricas

**URL**: `http://localhost:5000/metrics`

**Content-Type**: `text/plain; version=0.0.4`

### Métricas Exportadas

#### Gauge Metrics

```promql
# Jobs esperando procesamiento
bullmq_queue_waiting{queue="fx:transmision"} 15

# Jobs actualmente procesándose
bullmq_queue_active{queue="fx:transmision"} 5

# Jobs programados para el futuro
bullmq_queue_delayed{queue="fx:transmision"} 0

# Cola pausada (1) o activa (0)
bullmq_queue_paused{queue="fx:transmision"} 0
```

#### Counter Metrics

```promql
# Total de jobs completados
bullmq_queue_completed{queue="fx:transmision"} 1523

# Total de jobs fallidos
bullmq_queue_failed{queue="fx:transmision"} 12
```

### Integración con Prometheus

**prometheus.yml**:
```yaml
scrape_configs:
  - job_name: 'facturaxpress'
    scrape_interval: 15s
    static_configs:
      - targets: ['localhost:5000']
    metrics_path: '/metrics'
```

### Alertas Recomendadas

```yaml
groups:
  - name: bullmq_alerts
    rules:
      # Cola congestionada
      - alert: HighQueueBacklog
        expr: bullmq_queue_waiting > 100
        for: 5m
        annotations:
          summary: "Cola {{ $labels.queue }} con backlog alto"
          description: "{{ $labels.queue }} tiene {{ $value }} jobs esperando"

      # Alta tasa de fallos
      - alert: HighFailureRate
        expr: rate(bullmq_queue_failed[5m]) > 0.1
        for: 5m
        annotations:
          summary: "Alta tasa de fallos en {{ $labels.queue }}"

      # Cola pausada
      - alert: QueuePaused
        expr: bullmq_queue_paused == 1
        for: 1m
        annotations:
          summary: "Cola {{ $labels.queue }} está pausada"
```

---

## 🔍 Health Check con Colas

### GET /api/health

```json
{
  "status": "ok",
  "timestamp": "2026-01-16T02:42:00.000Z",
  "services": {
    "mh": {
      "circuitState": "CLOSED",
      "failureCount": 0
    },
    "queues": {
      "enabled": true,
      "queues": [
        {
          "name": "transmision",
          "waiting": 15,
          "active": 5,
          "completed": 1523,
          "failed": 12,
          "delayed": 0
        }
      ]
    }
  }
}
```

**Status Codes**:
- `200 OK` - Sistema saludable
- `503 Service Unavailable` - Circuit breaker OPEN o colas degradadas

---

## 🚀 Ejemplo de Uso

### Agregar Job a Cola

```typescript
import { addTransmisionJob } from "./lib/queues.js";

// Agregar job de transmisión
await addTransmisionJob(
  {
    tenantId: "tenant-123",
    facturaId: "factura-456",
    userId: "user-789"
  },
  {
    priority: 1,  // Alta prioridad
    delay: 5000,  // Retrasar 5 segundos
    attempts: 3,  // Máximo 3 intentos
  }
);
```

### Procesar Jobs Manualmente

```typescript
import { getQueues } from "./lib/queues.js";

const { transmisionQueue } = getQueues();

// Obtener jobs fallidos
const failed = await transmisionQueue.getFailed(0, 10);

// Reintentar job fallido
await transmisionQueue.retry(failed[0].id);

// Limpiar jobs completados antiguos
await transmisionQueue.clean(7 * 24 * 3600 * 1000, 1000, "completed");
```

---

## 🛑 Graceful Shutdown

El servidor maneja `SIGTERM` y `SIGINT` para cierre ordenado:

1. **Cerrar Workers** (espera jobs activos, máx 30s)
2. **Cerrar Servidor HTTP**
3. **Exit** con código 0 (éxito) o 1 (timeout)

```bash
# Enviar SIGTERM
kill -15 <PID>

# Enviar SIGINT (Ctrl+C)
kill -2 <PID>
```

**Logs Esperados**:
```
🛑 Iniciando graceful shutdown...
[Worker Transmisión] Esperando jobs activos...
[Worker Firma] Esperando jobs activos...
[Worker Notificaciones] Esperando jobs activos...
✅ Workers cerrados
✅ Servidor HTTP cerrado
```

---

## 📦 Dependencias

```json
{
  "bullmq": "^5.8.0",
  "@bull-board/api": "^5.x",
  "@bull-board/express": "^5.x",
  "redis": "^4.7.0"
}
```

---

## 🔗 Referencias

- [BullMQ Docs](https://docs.bullmq.io/)
- [Bull Board GitHub](https://github.com/felixmosh/bull-board)
- [Prometheus Exposition Formats](https://prometheus.io/docs/instrumenting/exposition_formats/)
- [Redis Cloud](https://redis.com/cloud/)

---

## ✅ Checklist de Producción

- [ ] Configurar Redis con TLS habilitado
- [ ] Ajustar concurrency según carga esperada
- [ ] Configurar alertas de Prometheus
- [ ] Proteger /admin/queues con autenticación
- [ ] Configurar backups de Redis (AOF/RDB)
- [ ] Monitorear uso de memoria de Redis
- [ ] Configurar rate limiting por tenant
- [ ] Implementar canales de notificación reales (Email/SMS)
- [ ] Probar graceful shutdown en staging
- [ ] Documentar runbooks para incidentes
