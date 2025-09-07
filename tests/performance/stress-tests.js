// tests/performance/stress-tests.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';
import exec from 'k6/execution';

const errorRate = new Rate('errors');
const successRate = new Rate('success');

export const options = {
  scenarios: {
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '1m', target: 200 },  // Rapid ramp up
        { duration: '2m', target: 500 },  // Push to high load
        { duration: '2m', target: 1000 }, // Stress test
        { duration: '1m', target: 500 },  // Scale down
        { duration: '1m', target: 0 },    // Recovery
      ],
    },
    spike_test: {
      executor: 'shared-iterations',
      vus: 1000,
      iterations: 1000,
      startTime: '5m', // Start after stress test
      maxDuration: '1m',
    },
  },
  thresholds: {
    http_req_duration: ['p(90)<1000'], // 90% of requests under 1s even under stress
    errors: ['rate<0.2'],              // Allow higher error rate under stress
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const users = [];

export function setup() {
  // Create test users
  for (let i = 0; i < 100; i++) {
    users.push({
      email: `stress${i}@test.com`,
      password: 'StressTest123!',
      token: null
    });
  }
  return { users };
}

export default function (data) {
  const scenario = exec.scenario.name;
  const user = data.users[exec.vu.id % data.users.length];

  if (scenario === 'stress_test') {
    stressTestScenario(user);
  } else if (scenario === 'spike_test') {
    spikeTestScenario(user);
  }
}

function stressTestScenario(user) {
  // Simulate realistic user behavior under stress
  
  // Login if not already
  if (!user.token) {
    const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
      email: user.email,
      password: user.password
    }), {
      headers: { 'Content-Type': 'application/json' },
      timeout: '10s'
    });

    const loginSuccess = check(loginRes, {
      'login successful': (r) => r.status === 200
    });

    if (loginSuccess) {
      user.token = JSON.parse(loginRes.body).token;
    } else {
      errorRate.add(1);
      return;
    }
  }

  const authHeaders = {
    headers: {
      'Authorization': `Bearer ${user.token}`,
      'Content-Type': 'application/json'
    },
    timeout: '10s'
  };

  // Simulate heavy operations
  const operations = [
    () => {
      // Search with complex filters
      const searchRes = http.get(
        `${BASE_URL}/api/contracts?search=test&status=active&sort=value:desc&page=1&limit=50`,
        authHeaders
      );
      return check(searchRes, { 'search successful': (r) => r.status === 200 });
    },
    () => {
      // Generate report (CPU intensive)
      const reportRes = http.get(
        `${BASE_URL}/api/analytics/report?type=detailed&format=pdf`,
        authHeaders
      );
      return check(reportRes, { 'report generated': (r) => r.status === 200 });
    },
    () => {
      // Bulk operation
      const bulkRes = http.post(
        `${BASE_URL}/api/contracts/bulk`,
        JSON.stringify({
          action: 'updateStatus',
          contractIds: Array.from({ length: 20 }, (_, i) => `contract${i}`),
          data: { status: 'active' }
        }),
        authHeaders
      );
      return check(bulkRes, { 'bulk operation successful': (r) => r.status === 200 });
    },
    () => {
      // File upload simulation
      const uploadRes = http.post(
        `${BASE_URL}/api/contracts/upload`,
        {
          file: http.file('Large content'.repeat(10000), 'large.pdf')
        },
        authHeaders
      );
      return check(uploadRes, { 'upload successful': (r) => r.status === 201 });
    }
  ];

  // Execute random operation
  const operation = operations[Math.floor(Math.random() * operations.length)];
  const success = operation();
  
  successRate.add(success ? 1 : 0);
  errorRate.add(success ? 0 : 1);

  sleep(Math.random() * 2); // Random think time
}

function spikeTestScenario(user) {
  // Simulate sudden spike in specific endpoint
  const contractsRes = http.get(`${BASE_URL}/api/contracts`, {
    headers: { 'Content-Type': 'application/json' },
    timeout: '5s'
  });

  const success = check(contractsRes, {
    'spike request handled': (r) => r.status < 500 // Allow client errors
  });

  successRate.add(success ? 1 : 0);
  errorRate.add(success ? 0 : 1);
}

export function handleSummary(data) {
  return {
    'stress-test-summary.html': htmlReport(data),
    'stress-test-summary.json': JSON.stringify(data),
  };
}

function htmlReport(data) {
  return `
    <html>
      <head><title>Stress Test Results</title></head>
      <body>
        <h1>Stress Test Summary</h1>
        <h2>Key Metrics</h2>
        <ul>
          <li>Total Requests: ${data.metrics.http_reqs.values.count}</li>
          <li>Failed Requests: ${data.metrics.http_req_failed.values.passes}</li>
          <li>Avg Response Time: ${data.metrics.http_req_duration.values.avg.toFixed(2)}ms</li>
          <li>95th Percentile: ${data.metrics.http_req_duration.values['p(95)'].toFixed(2)}ms</li>
          <li>Error Rate: ${(data.metrics.errors.values.rate * 100).toFixed(2)}%</li>
        </ul>
      </body>
    </html>
  `;
}