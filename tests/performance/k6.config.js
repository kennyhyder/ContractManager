export const config = {
  stages: [
    { duration: '30s', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.1'],
  },
  ext: {
    loadimpact: {
      projectID: 123456,
      name: 'Contract Management Load Test'
    }
  }
};