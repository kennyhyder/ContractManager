// tests/performance/scenarios/contract-creation.js
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { randomString, randomItem } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics
const createContractTrend = new Trend('contract_creation_duration');
const createContractRate = new Rate('contract_creation_success');
const documentUploadTrend = new Trend('document_upload_duration');
const documentUploadRate = new Rate('document_upload_success');

export const options = {
  scenarios: {
    // Scenario 1: Steady contract creation load
    steady_creation: {
      executor: 'constant-arrival-rate',
      rate: 10, // 10 contracts per second
      timeUnit: '1s',
      duration: '5m',
      preAllocatedVUs: 50,
      maxVUs: 100,
    },
    // Scenario 2: Burst creation (simulate end of month rush)
    burst_creation: {
      executor: 'ramping-arrival-rate',
      startRate: 5,
      timeUnit: '1s',
      preAllocatedVUs: 50,
      maxVUs: 200,
      stages: [
        { duration: '30s', target: 5 },   // Warm up
        { duration: '1m', target: 50 },   // Ramp to 50/s
        { duration: '2m', target: 100 },  // Peak load
        { duration: '1m', target: 10 },   // Cool down
      ],
    },
    // Scenario 3: Complex contract creation (with attachments)
    complex_creation: {
      executor: 'per-vu-iterations',
      vus: 20,
      iterations: 50,
      maxDuration: '10m',
    },
  },
  thresholds: {
    'contract_creation_duration': ['p(95)<2000', 'p(99)<5000'],
    'contract_creation_success': ['rate>0.95'],
    'document_upload_duration': ['p(95)<3000'],
    'document_upload_success': ['rate>0.9'],
    'http_req_duration': ['p(95)<1000'],
    'http_req_failed': ['rate<0.05'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Test data generators
function generateContractData() {
  const contractTypes = ['service', 'nda', 'purchase', 'employment', 'lease'];
  const clients = [
    'Acme Corporation',
    'Global Industries Ltd',
    'Tech Innovations Inc',
    'Future Systems LLC',
    'Dynamic Solutions Co'
  ];
  
  return {
    title: `Performance Test Contract ${randomString(8)}`,
    clientName: randomItem(clients),
    clientEmail: `client-${randomString(6)}@example.com`,
    type: randomItem(contractTypes),
    value: Math.floor(Math.random() * 1000000) + 10000,
    startDate: new Date().toISOString(),
    endDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
    content: generateContractContent(),
    tags: generateTags(),
    metadata: {
      department: randomItem(['Sales', 'Legal', 'HR', 'IT', 'Finance']),
      priority: randomItem(['low', 'medium', 'high', 'urgent']),
      customFields: generateCustomFields()
    }
  };
}

function generateContractContent() {
  // Generate realistic contract content
  const clauses = [];
  const numClauses = Math.floor(Math.random() * 10) + 5;
  
  for (let i = 0; i < numClauses; i++) {
    clauses.push(`
      <h2>${i + 1}. Clause Title ${randomString(5)}</h2>
      <p>This is a performance test clause with content ${randomString(20)}. 
      The parties agree to the terms and conditions set forth in this section,
      including but not limited to ${randomString(15)}.</p>
      <p>Additional terms: ${randomString(50)}</p>
    `);
  }
  
  return clauses.join('\n');
}

function generateTags() {
  const availableTags = [
    'urgent', 'renewal', 'amendment', 'confidential', 
    'high-value', 'international', 'standard', 'custom'
  ];
  const numTags = Math.floor(Math.random() * 4) + 1;
  const tags = [];
  
  for (let i = 0; i < numTags; i++) {
    tags.push(randomItem(availableTags));
  }
  
  return [...new Set(tags)]; // Remove duplicates
}

function generateCustomFields() {
  return {
    field1: randomString(10),
    field2: Math.floor(Math.random() * 1000),
    field3: randomItem(['Option A', 'Option B', 'Option C']),
    field4: new Date().toISOString(),
    field5: Math.random() > 0.5
  };
}

function generateDocument() {
  const documentTypes = ['pdf', 'docx', 'xlsx', 'png', 'jpg'];
  const type = randomItem(documentTypes);
  const size = Math.floor(Math.random() * 5 * 1024 * 1024); // Up to 5MB
  
  return {
    name: `document-${randomString(8)}.${type}`,
    type: `application/${type}`,
    size: size,
    content: randomString(size) // Simulated content
  };
}

// Main test function
export default function () {
  const scenario = __ENV.SCENARIO || 'steady_creation';
  
  // Login and get token
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: `perftest-${__VU}@example.com`,
    password: 'PerfTest123!'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (!check(loginRes, { 'login successful': (r) => r.status === 200 })) {
    console.error('Login failed');
    return;
  }
  
  const token = JSON.parse(loginRes.body).token;
  const authHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  // Execute based on scenario
  switch (scenario) {
    case 'steady_creation':
      performSteadyCreation(authHeaders);
      break;
    case 'burst_creation':
      performBurstCreation(authHeaders);
      break;
    case 'complex_creation':
      performComplexCreation(authHeaders);
      break;
    default:
      performSteadyCreation(authHeaders);
  }
}

function performSteadyCreation(headers) {
  // Simple contract creation
  const contractData = generateContractData();
  const startTime = new Date();
  
  const createRes = http.post(
    `${BASE_URL}/api/contracts`,
    JSON.stringify(contractData),
    { headers, tags: { type: 'create_contract' } }
  );
  
  const duration = new Date() - startTime;
  createContractTrend.add(duration);
  
  const success = check(createRes, {
    'contract created': (r) => r.status === 201,
    'has contract ID': (r) => JSON.parse(r.body)._id !== undefined
  });
  
  createContractRate.add(success);
  
  if (success) {
    const contractId = JSON.parse(createRes.body)._id;
    
    // Occasionally add a comment
    if (Math.random() < 0.3) {
      http.post(
        `${BASE_URL}/api/contracts/${contractId}/comments`,
        JSON.stringify({ text: `Performance test comment ${randomString(20)}` }),
        { headers }
      );
    }
  }
  
  sleep(randomItem([0.5, 1, 1.5, 2])); // Variable think time
}

function performBurstCreation(headers) {
  // Rapid contract creation with minimal processing
  const contracts = [];
  const batchSize = 5;
  
  // Create multiple contracts rapidly
  for (let i = 0; i < batchSize; i++) {
    const contractData = {
      title: `Burst Contract ${Date.now()}-${i}`,
      clientName: `Client ${__VU}-${i}`,
      value: Math.floor(Math.random() * 50000) + 1000,
      type: 'standard',
      status: 'draft'
    };
    
    contracts.push(
      http.post(
        `${BASE_URL}/api/contracts`,
        JSON.stringify(contractData),
        { headers, tags: { type: 'burst_create' } }
      )
    );
  }
  
  // Check all responses
  contracts.forEach((res, index) => {
    check(res, {
      [`contract ${index} created`]: (r) => r.status === 201
    });
  });
  
  sleep(0.1); // Minimal think time for burst
}

function performComplexCreation(headers) {
  // Create contract with all features
  const contractData = generateContractData();
  
  // Step 1: Create contract
  const createStartTime = new Date();
  const createRes = http.post(
    `${BASE_URL}/api/contracts`,
    JSON.stringify(contractData),
    { headers, tags: { type: 'complex_create' } }
  );
  
  const createDuration = new Date() - createStartTime;
  createContractTrend.add(createDuration);
  
  if (!check(createRes, { 'contract created': (r) => r.status === 201 })) {
    createContractRate.add(false);
    return;
  }
  
  createContractRate.add(true);
  const contract = JSON.parse(createRes.body);
  const contractId = contract._id;
  
  // Step 2: Upload documents
  const numDocuments = Math.floor(Math.random() * 3) + 1;
  for (let i = 0; i < numDocuments; i++) {
    const doc = generateDocument();
    const uploadStartTime = new Date();
    
    const formData = {
      file: http.file(doc.content, doc.name, doc.type),
      description: `Test document ${i + 1}`
    };
    
    const uploadRes = http.post(
      `${BASE_URL}/api/contracts/${contractId}/documents`,
      formData,
      { 
        headers: { 'Authorization': `Bearer ${headers.Authorization}` },
        tags: { type: 'document_upload' }
      }
    );
    
    const uploadDuration = new Date() - uploadStartTime;
    documentUploadTrend.add(uploadDuration);
    
    const uploadSuccess = check(uploadRes, {
      'document uploaded': (r) => r.status === 201
    });
    
    documentUploadRate.add(uploadSuccess);
  }
  
  // Step 3: Set up approval workflow
  if (contractData.value > 100000) {
    http.post(
      `${BASE_URL}/api/contracts/${contractId}/submit-approval`,
      JSON.stringify({
        approverId: 'manager-id',
        notes: 'High value contract requires approval'
      }),
      { headers }
    );
  }
  
  // Step 4: Add collaborators
  const collaborators = ['user1@example.com', 'user2@example.com'];
  collaborators.forEach(email => {
    http.post(
      `${BASE_URL}/api/contracts/${contractId}/share`,
      JSON.stringify({
        email: email,
        permissions: ['read', 'comment']
      }),
      { headers }
    );
  });
  
  // Step 5: Add metadata and tags
  http.patch(
    `${BASE_URL}/api/contracts/${contractId}/metadata`,
    JSON.stringify({
      customFields: generateCustomFields(),
      tags: [...contractData.tags, 'performance-test']
    }),
    { headers }
  );
  
  sleep(randomItem([2, 3, 4])); // Longer think time for complex operations
}

// Setup function to create test users
export function setup() {
  const setupData = {
    users: []
  };
  
  // Create test users for each VU
  for (let i = 1; i <= 200; i++) {
    const userData = {
      email: `perftest-${i}@example.com`,
      password: 'PerfTest123!',
      firstName: `PerfTest`,
      lastName: `User${i}`,
      role: 'user'
    };
    
    const res = http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify(userData),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    if (res.status === 201 || res.status === 409) { // 409 if user already exists
      setupData.users.push(userData);
    }
  }
  
  return setupData;
}

// Teardown function
export function teardown(data) {
  // Clean up test data if needed
  console.log('Contract creation performance test completed');
}

// Handle test summary
export function handleSummary(data) {
  const summary = {
    'contract_creation_summary.json': JSON.stringify(data),
    stdout: textSummary(data, { indent: ' ', enableColors: true })
  };
  
  // Add HTML report if needed
  if (__ENV.HTML_REPORT) {
    summary['contract_creation_report.html'] = htmlReport(data);
  }
  
  return summary;
}

function textSummary(data, options) {
  // Generate text summary
  return `
Contract Creation Performance Test Results
==========================================
Total Requests: ${data.metrics.http_reqs.values.count}
Failed Requests: ${data.metrics.http_req_failed.values.passes}

Contract Creation Metrics:
- Success Rate: ${(data.metrics.contract_creation_success.values.rate * 100).toFixed(2)}%
- Avg Duration: ${data.metrics.contract_creation_duration.values.avg.toFixed(2)}ms
- P95 Duration: ${data.metrics.contract_creation_duration.values['p(95)'].toFixed(2)}ms

Document Upload Metrics:
- Success Rate: ${(data.metrics.document_upload_success.values.rate * 100).toFixed(2)}%
- Avg Duration: ${data.metrics.document_upload_duration.values.avg.toFixed(2)}ms
`;
}