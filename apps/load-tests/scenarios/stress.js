import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

// Stress Test: Llevar el sistema al límite y más allá
export const options = {
  stages: [
    { duration: '2m', target: 100 },  // Warmup
    { duration: '5m', target: 100 },  // Baseline
    { duration: '2m', target: 200 },  // Incremento 1
    { duration: '5m', target: 200 },  
    { duration: '2m', target: 300 },  // Incremento 2
    { duration: '5m', target: 300 },  
    { duration: '2m', target: 400 },  // Incremento 3
    { duration: '5m', target: 400 },  
    { duration: '2m', target: 500 },  // Incremento 4 (breaking point?)
    { duration: '5m', target: 500 },  
    { duration: '10m', target: 0 },   // Recovery
  ],
  thresholds: {
    http_req_duration: ['p(95)<3000', 'p(99)<5000'], // Más permisivo que load test
    http_req_failed: ['rate<0.1'],                   // Toleramos hasta 10% de fallos
    errors: ['rate<0.15'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

export default function () {
  const endpoints = [
    '/api/facturas',
    '/api/productos',
    '/api/receptores',
    '/api/health',
  ];

  const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
  const res = http.get(`${BASE_URL}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
    },
    tags: { name: endpoint },
  });

  const checkResult = check(res, {
    'status is 2xx or 401 or 503': (r) => 
      (r.status >= 200 && r.status < 300) || 
      r.status === 401 || 
      r.status === 503, // Service Unavailable es esperado bajo estrés
    'response time < 5s': (r) => r.timings.duration < 5000,
  });

  errorRate.add(!checkResult);

  // Menos think time = más presión
  sleep(Math.random() * 1 + 0.5); // 0.5-1.5 segundos
}

export function handleSummary(data) {
  const breakingPoint = analyzeBreakingPoint(data);
  
  console.log(`
╔════════════════════════════════════════════════════════════╗
║                   STRESS TEST RESULTS                      ║
╚════════════════════════════════════════════════════════════╝

🔥 Stress Analysis:
   - Peak VUs: 500
   - Total Requests: ${data.metrics.http_reqs.values.count}
   - Failed Rate: ${(data.metrics.http_req_failed.values.rate * 100).toFixed(2)}%
   - Breaking Point: ${breakingPoint}

⚠️  Performance Under Stress:
   - P95: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms
   - P99: ${data.metrics.http_req_duration.values['p(99)'].toFixed(2)}ms
   - Max: ${data.metrics.http_req_duration.values.max.toFixed(2)}ms

💡 Recommendations:
${generateRecommendations(data)}
  `);

  return {
    'stdout': '',
    'stress-test-results.json': JSON.stringify(data, null, 2),
  };
}

function analyzeBreakingPoint(data) {
  const failRate = data.metrics.http_req_failed.values.rate;
  const p99 = data.metrics.http_req_duration.values['p(99)'];
  
  if (failRate > 0.2 || p99 > 10000) {
    return '⚠️  System struggled above 400 VUs';
  } else if (failRate > 0.1 || p99 > 5000) {
    return '⚠️  Degradation noticed above 300 VUs';
  } else {
    return '✅ System stable up to 500 VUs';
  }
}

function generateRecommendations(data) {
  const recommendations = [];
  
  if (data.metrics.http_req_failed.values.rate > 0.05) {
    recommendations.push('   - Consider scaling horizontally (add more instances)');
  }
  
  if (data.metrics.http_req_duration.values['p(95)'] > 2000) {
    recommendations.push('   - Optimize database queries');
    recommendations.push('   - Implement caching strategy');
  }
  
  if (data.metrics.http_req_duration.values['p(99)'] > 5000) {
    recommendations.push('   - Review slow endpoints');
    recommendations.push('   - Consider adding circuit breakers');
  }
  
  if (recommendations.length === 0) {
    return '   ✅ No major issues detected!';
  }
  
  return recommendations.join('\n');
}
