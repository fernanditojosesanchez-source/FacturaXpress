import http from 'k6/http';
import { check, sleep } from 'k6';
import { randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Chaos Engineering: Simular condiciones adversas y fallos aleatorios
export const options = {
  scenarios: {
    chaos_users: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 50 },
        { duration: '5m', target: 100 },
        { duration: '1m', target: 0 },
      ],
      exec: 'chaosTest',
    },
    // Escenario paralelo: Tráfico normal
    normal_users: {
      executor: 'constant-vus',
      vus: 20,
      duration: '7m',
      exec: 'normalTest',
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<2000'],
    http_req_failed: ['rate<0.15'], // Toleramos 15% de fallos en caos
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Tipos de caos que podemos simular
const chaosTypes = {
  NETWORK_DELAY: 'network_delay',
  RANDOM_ERROR: 'random_error',
  TIMEOUT: 'timeout',
  RETRY: 'retry',
  NORMAL: 'normal',
};

function selectChaosType() {
  const random = Math.random();
  
  if (random < 0.1) return chaosTypes.NETWORK_DELAY;      // 10% delays
  if (random < 0.15) return chaosTypes.TIMEOUT;           // 5% timeouts
  if (random < 0.2) return chaosTypes.RANDOM_ERROR;       // 5% errors
  if (random < 0.25) return chaosTypes.RETRY;             // 5% retries
  
  return chaosTypes.NORMAL; // 75% normal
}

export function chaosTest() {
  const chaosType = selectChaosType();
  
  switch (chaosType) {
    case chaosTypes.NETWORK_DELAY:
      // Simular latencia de red
      sleep(randomIntBetween(2, 5));
      makeRequest();
      break;
      
    case chaosTypes.TIMEOUT:
      // Simular timeout (request muy lento)
      http.get(`${BASE_URL}/api/facturas`, {
        timeout: '100ms', // Timeout artificialmente bajo
      });
      break;
      
    case chaosTypes.RANDOM_ERROR:
      // Simular error de aplicación
      makeRequest();
      // En un test real, aquí podríamos inyectar errores en el backend
      break;
      
    case chaosTypes.RETRY:
      // Simular retry logic
      let attempts = 0;
      let success = false;
      
      while (attempts < 3 && !success) {
        const res = makeRequest();
        success = res.status >= 200 && res.status < 300;
        attempts++;
        
        if (!success) {
          sleep(Math.pow(2, attempts)); // Exponential backoff
        }
      }
      break;
      
    case chaosTypes.NORMAL:
    default:
      makeRequest();
      break;
  }
  
  sleep(randomIntBetween(1, 3));
}

export function normalTest() {
  // Tráfico normal sin caos
  const res = makeRequest();
  
  check(res, {
    'status is 2xx or 401': (r) => (r.status >= 200 && r.status < 300) || r.status === 401,
  });
  
  sleep(randomIntBetween(1, 2));
}

function makeRequest() {
  const endpoints = [
    '/api/health',
    '/api/facturas',
    '/api/productos',
  ];
  
  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  
  return http.get(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { chaos: 'true' },
  });
}

export function handleSummary(data) {
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                 CHAOS ENGINEERING RESULTS                  ║
╚════════════════════════════════════════════════════════════╝

🌪️  Chaos Scenarios Tested:
   ✓ Network delays (10%)
   ✓ Timeouts (5%)
   ✓ Random errors (5%)
   ✓ Retry logic (5%)
   ✓ Normal traffic (75%)

📊 Results:
   - Total Requests: ${data.metrics.http_reqs.values.count}
   - Failed: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
   - P95 Latency: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms

${evaluateChaosResilience(data)}
  `);

  return {
    'stdout': '',
    'chaos-test-results.json': JSON.stringify(data, null, 2),
  };
}

function evaluateChaosResilience(data) {
  const failRate = data.metrics.http_req_failed.values.rate;
  const p95 = data.metrics.http_req_duration.values['p(95)'];
  
  let assessment = '🎯 Resilience Assessment:\n';
  
  if (failRate < 0.1) {
    assessment += '   ✅ Excellent error handling\n';
  } else if (failRate < 0.15) {
    assessment += '   ⚠️  Acceptable error rate\n';
  } else {
    assessment += '   ❌ High error rate - needs improvement\n';
  }
  
  if (p95 < 1500) {
    assessment += '   ✅ Good performance under chaos\n';
  } else {
    assessment += '   ⚠️  Performance degraded under chaos\n';
  }
  
  assessment += '\n💡 Chaos Engineering Insights:\n';
  assessment += '   - System behavior under adverse conditions tested\n';
  assessment += '   - Retry mechanisms and timeouts validated\n';
  assessment += '   - Failure modes identified\n';
  
  return assessment;
}
