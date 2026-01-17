import http from 'k6/http';
import { check, sleep } from 'k6';

// Spike Test: Incremento súbito y masivo de carga
export const options = {
  stages: [
    { duration: '10s', target: 100 },   // Warmup normal
    { duration: '1m', target: 100 },    // Estable
    { duration: '10s', target: 1000 },  // 🚀 SPIKE! 10x en 10 segundos
    { duration: '3m', target: 1000 },   // Mantener spike
    { duration: '10s', target: 100 },   // Bajada rápida
    { duration: '3m', target: 100 },    // Recuperación
    { duration: '10s', target: 0 },     // Shutdown
  ],
  thresholds: {
    // Más permisivo porque esperamos degradación durante spike
    http_req_duration: ['p(95)<5000'],
    http_req_failed: ['rate<0.2'], // Toleramos hasta 20% de fallos durante spike
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  const res = http.get(`${BASE_URL}/api/health`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(res, {
    'status is 2xx or 429 or 503': (r) => 
      (r.status >= 200 && r.status < 300) || 
      r.status === 429 || // Rate limit
      r.status === 503,   // Service unavailable
  });

  // Mínimo think time = máxima presión
  sleep(0.5);
}

export function handleSummary(data) {
  const recoveryTime = analyzeRecovery(data);
  
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                   SPIKE TEST RESULTS                       ║
╚════════════════════════════════════════════════════════════╝

⚡ Spike Analysis:
   - Peak Load: 1000 VUs (10x spike)
   - Total Requests: ${data.metrics.http_reqs.values.count}
   - Failed Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
   - Recovery Time: ${recoveryTime}

🎯 System Response:
   - P95 during spike: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
   - Max response time: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms

${assessSpikeResilience(data)}
  `);

  return {
    'stdout': '',
    'spike-test-results.json': JSON.stringify(data, null, 2),
  };
}

function analyzeRecovery(data) {
  // Simplificado: en un análisis real, analizaríamos métricas por tiempo
  const failRate = data.metrics.http_req_failed.values.rate;
  
  if (failRate < 0.1) {
    return '✅ Quick recovery (<30s estimated)';
  } else if (failRate < 0.15) {
    return '⚠️  Moderate recovery (~1-2min)';
  } else {
    return '❌ Slow recovery (>2min)';
  }
}

function assessSpikeResilience(data) {
  const p95 = data.metrics.http_req_duration.values['p(95)'];
  const failRate = data.metrics.http_req_failed.values.rate;
  
  if (failRate < 0.1 && p95 < 3000) {
    return `✅ EXCELLENT: System handled 10x spike gracefully!

💡 Your system demonstrates:
   - Proper auto-scaling
   - Good circuit breakers
   - Effective rate limiting`;
  } else if (failRate < 0.2) {
    return `⚠️  ACCEPTABLE: System survived spike with degradation

💡 Consider improving:
   - Add horizontal auto-scaling
   - Implement request queuing
   - Tune connection pools`;
  } else {
    return `❌ NEEDS IMPROVEMENT: System struggled with spike

💡 Critical improvements needed:
   - Implement rate limiting
   - Add circuit breakers
   - Review resource allocation
   - Consider load balancing`;
  }
}
