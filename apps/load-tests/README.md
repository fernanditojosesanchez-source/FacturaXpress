# FacturaXpress Load Testing Suite

Suite completa de pruebas de carga usando k6 para validar rendimiento, resiliencia y escalabilidad.

## Instalación de k6

### Windows (Chocolatey)
```powershell
choco install k6
```

### Windows (Manual)
1. Descargar desde https://k6.io/docs/get-started/installation/
2. Extraer `k6.exe` a una carpeta en PATH

### Verificar instalación
```bash
k6 version
```

## Escenarios Disponibles

### 1. Smoke Test (`smoke.js`)
**Propósito**: Verificación básica con carga mínima

- **VUs**: 1 usuario
- **Duración**: 1 minuto
- **Thresholds**:
  - P95 < 500ms
  - Tasa de fallo < 1%

```bash
npm run test:smoke
```

**Cuándo usar**: 
- Después de cada deploy
- Validación de cambios menores
- Verificación de que el sistema arranca correctamente

---

### 2. Load Test (`load.js`)
**Propósito**: Prueba de carga normal con incremento gradual

- **VUs**: 50 → 100 → 150 (incremento gradual)
- **Duración**: ~23 minutos
- **Thresholds**:
  - P95 < 1000ms
  - P99 < 2000ms
  - Tasa de fallo < 5%

```bash
npm run test:load
```

**Cuándo usar**:
- Validación de carga esperada
- Testing de capacidad normal
- Benchmarking de rendimiento

---

### 3. Stress Test (`stress.js`)
**Propósito**: Llevar el sistema al límite y encontrar el breaking point

- **VUs**: 100 → 200 → 300 → 400 → 500
- **Duración**: ~38 minutos
- **Thresholds**:
  - P95 < 3000ms (más permisivo)
  - P99 < 5000ms
  - Tasa de fallo < 10%

```bash
npm run test:stress
```

**Cuándo usar**:
- Encontrar límites del sistema
- Planificar escalamiento
- Validar comportamiento bajo estrés extremo

**Breaking Point Analysis**: El test analiza automáticamente en qué punto el sistema comienza a degradarse.

---

### 4. Spike Test (`spike.js`)
**Propósito**: Probar resilencia ante incrementos súbitos (10x)

- **VUs**: 100 → **1000 (spike en 10s)** → 100
- **Duración**: ~8 minutos
- **Thresholds**:
  - P95 < 5000ms
  - Tasa de fallo < 20% (toleramos más durante spike)

```bash
npm run test:spike
```

**Cuándo usar**:
- Validar auto-scaling
- Probar circuit breakers
- Simular tráfico viral/eventos

**Resilience Assessment**: Evalúa qué tan rápido el sistema se recupera del spike.

---

### 5. Chaos Test (`chaos.js`)
**Propósito**: Chaos engineering - simular condiciones adversas

- **Escenarios**: 
  - Network delays (10%)
  - Timeouts (5%)
  - Random errors (5%)
  - Retry logic (5%)
  - Normal traffic (75%)
- **Duración**: ~7 minutos
- **VUs**: 100 + 20 de tráfico normal

```bash
npm run test:chaos
```

**Cuándo usar**:
- Validar manejo de errores
- Probar retry mechanisms
- Identificar failure modes
- Chaos engineering practices

---

## Variables de Entorno

```bash
# Cambiar URL base
$env:BASE_URL = "https://api.production.com"
npm run test:load

# O en PowerShell
$env:BASE_URL="https://staging.api.com"; npm run test:smoke
```

## Service Level Objectives (SLOs)

### 🎯 SLOs Definidos

| Métrica | Target | Threshold |
|---------|--------|-----------|
| **Availability** | 99.9% | < 0.1% fallos |
| **Latency P95** | 500ms | < 1000ms |
| **Latency P99** | 1000ms | < 2000ms |
| **Throughput** | 1000 req/s | N/A |

### Validación de SLOs

Los tests automáticamente validan contra estos SLOs:
- ✅ **PASS**: Todos los thresholds cumplidos
- ⚠️  **WARNING**: Algunos thresholds cerca del límite
- ❌ **FAIL**: SLOs violados

## Interpretación de Resultados

### Métricas Clave

1. **http_req_duration**: Tiempo de respuesta
   - `avg`: Promedio
   - `med`: Mediana
   - `p(95)`: 95% de requests más rápidas que esto
   - `p(99)`: 99% de requests más rápidas que esto
   - `max`: Peor caso

2. **http_req_failed**: Tasa de fallos
   - `rate`: Porcentaje de requests fallidas

3. **http_reqs**: Throughput
   - `count`: Total de requests
   - `rate`: Requests por segundo

### Ejemplo de Output

```
✅ LOAD TEST RESULTS

📊 Summary:
   - Total Requests: 150,000
   - Failed Requests: 2.34%
   - Test Result: ✅ PASSED

⏱️  Response Times:
   - Average: 324.56ms
   - P95: 876.23ms
   - P99: 1456.78ms
   - Max: 3456.89ms

🚀 Throughput:
   - Requests/sec: 125.5
```

## Ejecución de Suite Completa

```bash
# Ejecutar smoke + load + stress
npm run test:all
```

**Duración total**: ~62 minutos

## Análisis Avanzado

### Exportar resultados en JSON

```bash
k6 run --out json=results.json scenarios/load.js
```

### Visualizar con k6 Cloud (opcional)

```bash
k6 login cloud
k6 run --out cloud scenarios/load.js
```

## Recomendaciones

### 1. Orden de Ejecución Recomendado

1. **Smoke** - Verificar que funciona básicamente
2. **Load** - Probar carga normal esperada
3. **Stress** - Encontrar límites
4. **Spike** - Validar resilencia
5. **Chaos** - Probar manejo de errores

### 2. Frecuencia

- **Smoke**: Cada deploy (CI/CD)
- **Load**: Semanalmente
- **Stress**: Mensualmente
- **Spike**: Antes de eventos grandes
- **Chaos**: Trimestralmente

### 3. Antes de Producción

✅ Ejecutar al menos:
- Smoke test
- Load test con carga 2x esperada
- Spike test

## Troubleshooting

### Error: "k6: command not found"

Instalar k6 o agregar al PATH.

### Timeouts durante tests

Ajustar thresholds en options de cada escenario.

### Muchos fallos (> 10%)

1. Verificar que el servidor esté corriendo
2. Revisar logs del servidor
3. Considerar aumentar recursos (CPU/memoria)
4. Optimizar queries de base de datos

## Próximos Pasos

- [ ] Configurar CI/CD para ejecutar smoke tests automáticamente
- [ ] Agregar monitoreo en tiempo real (Grafana + InfluxDB)
- [ ] Implementar alertas basadas en SLOs
- [ ] Crear dashboard de resultados históricos
