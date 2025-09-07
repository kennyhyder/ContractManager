// tests/performance/load-tests.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const errorRate = new Rate('errors');

export const options = {
  stages: [
    { duration: '2m', target: 10 },   // Ramp up to 10 users
    { duration: '5m', target: 50 },   // Ramp up to 50 users
    { duration: '10m', target: 100 }, // Stay at 100 users
    { duration: '5m', target: 50 },   // Ramp down to 50 users
    { duration: '2m', target: 0 },    // Ramp down to 0 users
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.1'],             // Error rate must be below 10%
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';

export function setup() {
  // Setup test data
  const setupData = http.post(`${BASE_URL}/api/test/setup`, JSON.stringify({
    users: 100,
    contracts: 1000
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  return JSON.parse(setupData.body);
}

export default function (data) {
  // Login
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: `user${Math.floor(Math.random() * 100)}@loadtest.com`,
    password: 'LoadTest123!'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });

  const success = check(loginRes, {
    'login successful': (r) => r.status === 200,
    'token received': (r) => JSON.parse(r.body).token !== undefined
  });

  errorRate.add(!success);

  if (!success) return;

  const token = JSON.parse(loginRes.body).token;
  const authHeaders = {
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  };

  // Get contracts list
  const contractsRes = http.get(`${BASE_URL}/api/contracts?page=1&limit=20`, authHeaders);
  
  check(contractsRes, {
    'contracts fetched': (r) => r.status === 200,
    'response time OK': (r) => r.timings.duration < 300
  });

  sleep(1);

  // Get random contract detail
  const contracts = JSON.parse(contractsRes.body).contracts;
  if (contracts.length > 0) {
    const randomContract = contracts[Math.floor(Math.random() * contracts.length)];
    const detailRes = http.get(`${BASE_URL}/api/contracts/${randomContract._id}`, authHeaders);
    
    check(detailRes, {
      'contract detail fetched': (r) => r.status === 200
    });
  }

  sleep(1);

  // Create new contract (10% of requests)
  if (Math.random() < 0.1) {
    const createRes = http.post(`${BASE_URL}/api/contracts`, JSON.stringify({
      title: `Load Test Contract ${Date.now()}`,
      clientName: 'Load Test Client',
      value: Math.floor(Math.random() * 100000)
    }), authHeaders);

    check(createRes, {
      'contract created': (r) => r.status === 201
    });
  }

  sleep(2);
}

export function teardown(data) {
  // Cleanup test data
  http.del(`${BASE_URL}/api/test/cleanup`, {
    headers: { 'Content-Type': 'application/json' }
  });
}