import http from 'k6/http';
import { check, sleep } from 'k6';

// Smoke Test: Prueba básica con carga mínima para verificar que el sistema funciona
export const options = {
  vus: 1, // 1 usuario virtual
  duration: '1m', // 1 minuto de duración
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% de requests < 500ms
    http_req_failed: ['rate<0.01'],   // < 1% de fallos
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  // Health check
  const healthRes = http.get(`${BASE_URL}/api/health`);
  check(healthRes, {
    'health check status is 200': (r) => r.status === 200,
    'health check response time < 500ms': (r) => r.timings.duration < 500,
  });

  sleep(1);

  // Test de endpoint de facturas (GET)
  const facturasRes = http.get(`${BASE_URL}/api/facturas`, {
    headers: {
      'Content-Type': 'application/json',
    },
  });

  check(facturasRes, {
    'facturas status is 200 or 401': (r) => r.status === 200 || r.status === 401,
  });

  sleep(1);
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data, { indent: ' ', enableColors: true }),
    'smoke-test-results.json': JSON.stringify(data),
  };
}

function textSummary(data, options) {
  const indent = options?.indent || '';
  const enableColors = options?.enableColors || false;
  
  return `
${indent}✅ Smoke Test Completed
${indent}
${indent}Metrics:
${indent}  - Requests: ${data.metrics.http_reqs?.values.count || 0}
${indent}  - Duration: ${data.metrics.http_req_duration?.values.avg?.toFixed(2) || 0}ms (avg)
${indent}  - P95: ${data.metrics.http_req_duration?.values['p(95)']?.toFixed(2) || 0}ms
${indent}  - Failed: ${((data.metrics.http_req_failed?.values.rate || 0) * 100).toFixed(2)}%
`;
}
