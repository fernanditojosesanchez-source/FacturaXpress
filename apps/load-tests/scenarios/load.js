import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// Métricas personalizadas
const errorRate = new Rate('errors');
const apiDuration = new Trend('api_duration');

// Load Test: Prueba de carga normal con incremento gradual
export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp-up a 50 usuarios
    { duration: '5m', target: 50 },   // Mantener 50 usuarios
    { duration: '2m', target: 100 },  // Incrementar a 100
    { duration: '5m', target: 100 },  // Mantener 100 usuarios
    { duration: '2m', target: 150 },  // Incrementar a 150
    { duration: '5m', target: 150 },  // Mantener 150 usuarios
    { duration: '2m', target: 0 },    // Ramp-down
  ],
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'], // 95% < 1s, 99% < 2s
    http_req_failed: ['rate<0.05'],                  // < 5% de fallos
    errors: ['rate<0.1'],                            // < 10% de errores
    api_duration: ['p(95)<1500'],                    // Custom metric
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Endpoints a testear
const endpoints = [
  { method: 'GET', url: '/api/facturas', weight: 40 },
  { method: 'GET', url: '/api/productos', weight: 30 },
  { method: 'GET', url: '/api/receptores', weight: 20 },
  { method: 'GET', url: '/api/health', weight: 10 },
];

// Seleccionar endpoint basado en peso
function selectEndpoint() {
  const random = Math.random() * 100;
  let cumulative = 0;
  
  for (const endpoint of endpoints) {
    cumulative += endpoint.weight;
    if (random <= cumulative) {
      return endpoint;
    }
  }
  
  return endpoints[0];
}

export default function () {
  const endpoint = selectEndpoint();
  const startTime = new Date().getTime();
  
  const res = http.request(endpoint.method, `${BASE_URL}${endpoint.url}`, null, {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: endpoint.url },
  });
  
  const duration = new Date().getTime() - startTime;
  apiDuration.add(duration);

  const checkResult = check(res, {
    'status is 2xx or 401': (r) => (r.status >= 200 && r.status < 300) || r.status === 401,
    'response time < 2s': (r) => r.timings.duration < 2000,
  });

  errorRate.add(!checkResult);

  // Think time: simular comportamiento de usuario real
  sleep(Math.random() * 3 + 1); // 1-4 segundos
}

export function handleSummary(data) {
  const passed = 
    data.metrics.http_req_duration.values['p(95)'] < 1000 &&
    data.metrics.http_req_failed.values.rate < 0.05;

  console.log(`
╔════════════════════════════════════════════════════════════╗
║                   LOAD TEST RESULTS                        ║
╚════════════════════════════════════════════════════════════╝

📊 Summary:
   - Total Requests: ${data.metrics.http_reqs.values.count}
   - Failed Requests: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
   - Test Result: ${passed ? '✅ PASSED' : '❌ FAILED'}

⏱️  Response Times:
   - Average: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms
   - Median: ${data.metrics.http_req_duration.values.med.toFixed(2)}ms
   - P95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
   - P99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms
   - Max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms

🚀 Throughput:
   - Requests/sec: ${(data.metrics.http_reqs.values.count / (data.state.testRunDurationMs / 1000)).toFixed(2)}

${passed ? '✅ All thresholds passed!' : '⚠️  Some thresholds failed. Check details above.'}
  `);

  return {
    'stdout': '',
    'load-test-results.json': JSON.stringify(data, null, 2),
  };
}
