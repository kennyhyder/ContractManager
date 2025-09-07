// tests/performance/scenarios/search-performance.js
import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { randomItem, randomIntBetween } from 'https://jslib.k6.io/k6-utils/1.2.0/index.js';

// Custom metrics for search performance
const searchDuration = new Trend('search_duration');
const searchSuccess = new Rate('search_success_rate');
const resultsCount = new Counter('search_results_returned');
const cacheHitRate = new Rate('cache_hit_rate');
const elasticSearchDuration = new Trend('elasticsearch_duration');
const facetedSearchDuration = new Trend('faceted_search_duration');

export const options = {
  scenarios: {
    // Scenario 1: Basic search patterns
    basic_search: {
      executor: 'constant-vus',
      vus: 20,
      duration: '5m',
      exec: 'basicSearchScenario',
    },
    // Scenario 2: Complex filtered searches
    complex_search: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '2m', target: 30 },
        { duration: '5m', target: 50 },
        { duration: '2m', target: 0 },
      ],
      exec: 'complexSearchScenario',
    },
    // Scenario 3: Autocomplete/typeahead
    typeahead_search: {
      executor: 'constant-arrival-rate',
      rate: 100, // 100 requests per second
      timeUnit: '1s',
      duration: '3m',
      preAllocatedVUs: 50,
      exec: 'typeaheadScenario',
    },
    // Scenario 4: Export and bulk operations
    export_search: {
      executor: 'per-vu-iterations',
      vus: 10,
      iterations: 20,
      maxDuration: '10m',
      exec: 'exportScenario',
    },
  },
  thresholds: {
    'search_duration': ['p(95)<500', 'p(99)<1000'],
    'search_success_rate': ['rate>0.99'],
    'elasticsearch_duration': ['p(95)<200'],
    'faceted_search_duration': ['p(95)<800'],
    'cache_hit_rate': ['rate>0.7'],
    'http_req_duration{type:search}': ['p(95)<600'],
    'http_req_duration{type:typeahead}': ['p(95)<100'],
  },
};

const BASE_URL = __ENV.BASE_URL || 'http://localhost:5000';

// Search term generators
const searchTerms = {
  common: [
    'agreement', 'contract', 'service', 'terms', 'payment',
    'confidential', 'nda', 'amendment', 'renewal', 'termination'
  ],
  clientNames: [
    'Acme', 'Global', 'Tech', 'Industries', 'Corporation',
    'Systems', 'Solutions', 'Innovations', 'Dynamic', 'Future'
  ],
  contractTypes: [
    'service-agreement', 'non-disclosure', 'purchase-order',
    'employment', 'lease', 'licensing', 'partnership'
  ],
  statuses: ['draft', 'active', 'pending', 'expired', 'terminated'],
  dateRanges: [
    { start: '2024-01-01', end: '2024-03-31' },
    { start: '2024-04-01', end: '2024-06-30' },
    { start: '2024-07-01', end: '2024-09-30' },
    { start: '2024-10-01', end: '2024-12-31' }
  ]
};

// Helper function to build search queries
function buildSearchQuery(complexity = 'basic') {
  let query = {};
  
  switch (complexity) {
    case 'basic':
      query = {
        q: randomItem(searchTerms.common),
        limit: 20
      };
      break;
      
    case 'filtered':
      query = {
        q: randomItem(searchTerms.common),
        status: randomItem(searchTerms.statuses),
        type: randomItem(searchTerms.contractTypes),
        limit: 20
      };
      break;
      
    case 'complex':
      const dateRange = randomItem(searchTerms.dateRanges);
      query = {
        q: `${randomItem(searchTerms.common)} ${randomItem(searchTerms.clientNames)}`,
        status: randomItem(searchTerms.statuses),
        type: randomItem(searchTerms.contractTypes),
        clientName: randomItem(searchTerms.clientNames),
        valueMin: randomIntBetween(1000, 50000),
        valueMax: randomIntBetween(50001, 1000000),
        startDate: dateRange.start,
        endDate: dateRange.end,
        tags: randomItem(['urgent', 'renewal', 'amendment']),
        sortBy: randomItem(['createdAt', 'value', 'endDate', 'title']),
        sortOrder: randomItem(['asc', 'desc']),
        page: randomIntBetween(1, 5),
        limit: randomItem([10, 20, 50])
      };
      break;
      
    case 'faceted':
      query = {
        q: randomItem(searchTerms.common),
        facets: ['status', 'type', 'clientName', 'tags', 'valueRange'],
        includeFacetCounts: true,
        limit: 20
      };
      break;
  }
  
  return query;
}

// Basic search scenario
export function basicSearchScenario() {
  const token = login();
  if (!token) return;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  group('Basic Search Operations', () => {
    // Simple keyword search
    const simpleQuery = buildSearchQuery('basic');
    const simpleSearch = timeRequest(() => 
      http.get(`${BASE_URL}/api/contracts/search?${encodeQuery(simpleQuery)}`, {
        headers,
        tags: { type: 'search', complexity: 'basic' }
      })
    );
    
    processSearchResponse(simpleSearch.response, simpleSearch.duration, 'basic');
    
    sleep(randomItem([0.5, 1, 1.5]));
    
    // Filtered search
    const filteredQuery = buildSearchQuery('filtered');
    const filteredSearch = timeRequest(() =>
      http.get(`${BASE_URL}/api/contracts/search?${encodeQuery(filteredQuery)}`, {
        headers,
        tags: { type: 'search', complexity: 'filtered' }
      })
    );
    
    processSearchResponse(filteredSearch.response, filteredSearch.duration, 'filtered');
    
    sleep(randomItem([1, 2]));
  });
}

// Complex search scenario
export function complexSearchScenario() {
  const token = login();
  if (!token) return;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  group('Complex Search Operations', () => {
    // Multi-criteria search
    const complexQuery = buildSearchQuery('complex');
    const complexSearch = timeRequest(() =>
      http.get(`${BASE_URL}/api/contracts/search?${encodeQuery(complexQuery)}`, {
        headers,
        tags: { type: 'search', complexity: 'complex' }
      })
    );
    
    processSearchResponse(complexSearch.response, complexSearch.duration, 'complex');
    
    // Faceted search for filtering UI
    const facetedQuery = buildSearchQuery('faceted');
    const facetedSearch = timeRequest(() =>
      http.get(`${BASE_URL}/api/contracts/search?${encodeQuery(facetedQuery)}`, {
        headers,
        tags: { type: 'search', complexity: 'faceted' }
      })
    );
    
    facetedSearchDuration.add(facetedSearch.duration);
    processSearchResponse(facetedSearch.response, facetedSearch.duration, 'faceted');
    
    // Advanced search with aggregations
    const aggregationSearch = timeRequest(() =>
      http.post(`${BASE_URL}/api/contracts/search/advanced`, JSON.stringify({
        query: {
          bool: {
            must: [
              { match: { content: randomItem(searchTerms.common) } },
              { range: { value: { gte: 10000, lte: 100000 } } }
            ],
            filter: [
              { term: { status: 'active' } }
            ]
          }
        },
        aggregations: {
          by_status: { terms: { field: 'status' } },
          by_month: { 
            date_histogram: { 
              field: 'createdAt', 
              interval: 'month' 
            } 
          },
          avg_value: { avg: { field: 'value' } }
        }
      }), {
        headers,
        tags: { type: 'search', complexity: 'aggregation' }
      })
    );
    
    check(aggregationSearch.response, {
      'aggregation search successful': (r) => r.status === 200,
      'has aggregation results': (r) => {
        const body = JSON.parse(r.body);
        return body.aggregations !== undefined;
      }
    });
    
    sleep(randomItem([2, 3]));
  });
}

// Typeahead/autocomplete scenario
export function typeaheadScenario() {
  const token = login();
  if (!token) return;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  // Simulate user typing
  const searchTerm = randomItem(searchTerms.common);
  const typingSequence = [];
  
  // Build typing sequence
  for (let i = 1; i <= searchTerm.length; i++) {
    if (i >= 3) { // Start searching after 3 characters
      typingSequence.push(searchTerm.substring(0, i));
    }
  }
  
  group('Typeahead Search', () => {
    typingSequence.forEach((partial, index) => {
      const typeaheadSearch = timeRequest(() =>
        http.get(`${BASE_URL}/api/contracts/suggest?q=${partial}&limit=10`, {
          headers,
          tags: { type: 'typeahead' }
        })
      );
      
      check(typeaheadSearch.response, {
        'typeahead successful': (r) => r.status === 200,
        'returns suggestions': (r) => {
          const body = JSON.parse(r.body);
          return Array.isArray(body.suggestions) && body.suggestions.length > 0;
        },
        'fast response': (r) => r.timings.duration < 100
      });
      
      // Simulate typing delay
      sleep(randomItem([0.1, 0.2, 0.3]));
    });
  });
}

// Export scenario - testing heavy search operations
export function exportScenario() {
  const token = login();
  if (!token) return;
  
  const headers = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json'
  };
  
  group('Export and Bulk Operations', () => {
    // Large result set export
    const exportQuery = {
      q: randomItem(searchTerms.common),
      status: 'active',
      limit: 1000, // Large limit
      format: randomItem(['csv', 'xlsx', 'json'])
    };
    
    const exportSearch = timeRequest(() =>
      http.get(`${BASE_URL}/api/contracts/export?${encodeQuery(exportQuery)}`, {
        headers,
        tags: { type: 'export' },
        timeout: '60s'
      })
    );
    
    check(exportSearch.response, {
      'export successful': (r) => r.status === 200,
      'correct content type': (r) => {
        const format = exportQuery.format;
        const contentType = r.headers['Content-Type'];
        return contentType.includes(format) || 
               contentType.includes('application/octet-stream');
      }
    });
    
    // Bulk search operations
    const bulkSearches = [];
    for (let i = 0; i < 5; i++) {
      bulkSearches.push({
        index: 'contracts',
        query: buildSearchQuery(randomItem(['basic', 'filtered', 'complex']))
      });
    }
    
    const bulkSearch = timeRequest(() =>
      http.post(`${BASE_URL}/api/search/bulk`, JSON.stringify({
        searches: bulkSearches
      }), {
        headers,
        tags: { type: 'bulk_search' }
      })
    );
    
    check(bulkSearch.response, {
      'bulk search successful': (r) => r.status === 200,
      'all searches completed': (r) => {
        const body = JSON.parse(r.body);
        return body.results && body.results.length === bulkSearches.length;
      }
    });
    
    sleep(randomItem([3, 5]));
  });
}

// Helper functions
function login() {
  const loginRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: `searchtest-${__VU}@example.com`,
    password: 'SearchTest123!'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (check(loginRes, { 'login successful': (r) => r.status === 200 })) {
    return JSON.parse(loginRes.body).token;
  }
  return null;
}

function timeRequest(requestFn) {
  const startTime = new Date();
  const response = requestFn();
  const duration = new Date() - startTime;
  
  return { response, duration };
}

function processSearchResponse(response, duration, searchType) {
  const success = check(response, {
    'search successful': (r) => r.status === 200,
    'has results': (r) => {
      const body = JSON.parse(r.body);
      return body.results !== undefined;
    }
  });
  
  searchSuccess.add(success);
  searchDuration.add(duration);
  
  if (success) {
    const body = JSON.parse(response.body);
    resultsCount.add(body.results.length);
    
    // Check for cache headers
    const cacheHeader = response.headers['X-Cache'];
    if (cacheHeader) {
      cacheHitRate.add(cacheHeader === 'HIT' ? 1 : 0);
    }
    
    // Check for Elasticsearch timing
    const esTime = response.headers['X-Elasticsearch-Time'];
    if (esTime) {
      elasticSearchDuration.add(parseInt(esTime));
    }
  }
}

function encodeQuery(params) {
  return Object.keys(params)
    .map(key => `${key}=${encodeURIComponent(params[key])}`)
    .join('&');
}

// Setup - create test users and sample data
export function setup() {
  const setupData = {
    users: [],
    sampleContracts: []
  };
  
  // Create test users
  for (let i = 1; i <= 100; i++) {
    const userData = {
      email: `searchtest-${i}@example.com`,
      password: 'SearchTest123!',
      firstName: `Search`,
      lastName: `Test${i}`
    };
    
    const res = http.post(
      `${BASE_URL}/api/auth/register`,
      JSON.stringify(userData),
      { headers: { 'Content-Type': 'application/json' } }
    );
    
    if (res.status === 201 || res.status === 409) {
      setupData.users.push(userData);
    }
  }
  
  // Create sample contracts for searching
  const adminToken = getAdminToken();
  if (adminToken) {
    const headers = {
      'Authorization': `Bearer ${adminToken}`,
      'Content-Type': 'application/json'
    };
    
    // Create diverse set of contracts
    for (let i = 0; i < 1000; i++) {
      const contractData = {
        title: `${randomItem(searchTerms.common)} Contract ${i}`,
        clientName: `${randomItem(searchTerms.clientNames)} ${randomItem(['Inc', 'LLC', 'Corp'])}`,
        type: randomItem(searchTerms.contractTypes),
        status: randomItem(searchTerms.statuses),
        value: randomIntBetween(1000, 1000000),
        content: generateSearchableContent(),
        tags: generateRandomTags(),
        metadata: {
          createdByDepartment: randomItem(['Sales', 'Legal', 'HR', 'Finance']),
          region: randomItem(['North', 'South', 'East', 'West']),
          priority: randomItem(['low', 'medium', 'high', 'urgent'])
        }
      };
      
      const res = http.post(
        `${BASE_URL}/api/contracts`,
        JSON.stringify(contractData),
        { headers }
      );
      
      if (res.status === 201) {
        setupData.sampleContracts.push(JSON.parse(res.body));
      }
    }
  }
  
  return setupData;
}

function getAdminToken() {
  const adminRes = http.post(`${BASE_URL}/api/auth/login`, JSON.stringify({
    email: 'admin@example.com',
    password: 'AdminPass123!'
  }), {
    headers: { 'Content-Type': 'application/json' }
  });
  
  if (adminRes.status === 200) {
    return JSON.parse(adminRes.body).token;
  }
  return null;
}

function generateSearchableContent() {
  const paragraphs = [];
  const numParagraphs = randomIntBetween(3, 10);
  
  for (let i = 0; i < numParagraphs; i++) {
    const words = [];
    const numWords = randomIntBetween(50, 150);
    
    for (let j = 0; j < numWords; j++) {
      // Mix common search terms with random words
      if (Math.random() < 0.1) {
        words.push(randomItem(searchTerms.common));
      } else {
        words.push(randomItem(['the', 'and', 'or', 'but', 'with', 'shall', 'must', 'may', 'will']));
      }
    }
    
    paragraphs.push(words.join(' '));
  }
  
  return paragraphs.join('\n\n');
}

function generateRandomTags() {
  const allTags = [
    'urgent', 'renewal', 'amendment', 'confidential', 'high-value',
    'standard', 'custom', 'international', 'domestic', 'priority'
  ];
  
  const numTags = randomIntBetween(1, 5);
  const tags = [];
  
  for (let i = 0; i < numTags; i++) {
    tags.push(randomItem(allTags));
  }
  
  return [...new Set(tags)];
}

// Teardown
export function teardown(data) {
  console.log('Search performance test completed');
}

// Summary handler
export function handleSummary(data) {
  return {
    'search_performance_summary.json': JSON.stringify(data),
    stdout: generateTextSummary(data)
  };
}

function generateTextSummary(data) {
  return `
Search Performance Test Results
===============================
Total Search Requests: ${data.metrics.http_reqs.values.count}
Search Success Rate: ${(data.metrics.search_success_rate.values.rate * 100).toFixed(2)}%
Cache Hit Rate: ${(data.metrics.cache_hit_rate.values.rate * 100).toFixed(2)}%

Search Duration:
- Average: ${data.metrics.search_duration.values.avg.toFixed(2)}ms
- P95: ${data.metrics.search_duration.values['p(95)'].toFixed(2)}ms
- P99: ${data.metrics.search_duration.values['p(99)'].toFixed(2)}ms

Elasticsearch Performance:
- Average: ${data.metrics.elasticsearch_duration.values.avg.toFixed(2)}ms
- P95: ${data.metrics.elasticsearch_duration.values['p(95)'].toFixed(2)}ms

Total Results Returned: ${data.metrics.search_results_returned.values.count}
`;
}