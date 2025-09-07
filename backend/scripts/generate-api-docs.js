#!/usr/bin/env node

const swaggerJsdoc = require('swagger-jsdoc');
const fs = require('fs').promises;
const path = require('path');
const logger = require('../utils/logger');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Contract Management System API',
      version: '1.0.0',
      description: 'RESTful API for Contract Management System',
      contact: {
        name: 'API Support',
        email: 'support@contractmanagement.com'
      },
      license: {
        name: 'MIT',
        url: 'https://opensource.org/licenses/MIT'
      }
    },
    servers: [
      {
        url: 'http://localhost:5000/api',
        description: 'Development server'
      },
      {
        url: 'https://api.contractmanagement.com',
        description: 'Production server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [{
      bearerAuth: []
    }]
  },
  apis: [
    './routes/*.js',
    './models/*.js'
  ]
};

async function generateDocs() {
  try {
    console.log('📚 Generating API documentation...\n');

    // Generate OpenAPI specification
    const spec = swaggerJsdoc(options);

    // Write to file
    const outputPath = path.join(__dirname, '../docs/api/openapi.json');
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, JSON.stringify(spec, null, 2));

    console.log(`✅ API documentation generated: ${outputPath}`);

    // Generate Postman collection
    console.log('\n📮 Generating Postman collection...');
    const postmanCollection = convertToPostman(spec);
    const postmanPath = path.join(__dirname, '../docs/api/postman_collection.json');
    await fs.writeFile(postmanPath, JSON.stringify(postmanCollection, null, 2));
    
    console.log(`✅ Postman collection generated: ${postmanPath}`);

    process.exit(0);
  } catch (error) {
    console.error('❌ Documentation generation failed:', error);
    logger.error('Documentation generation error:', error);
    process.exit(1);
  }
}

function convertToPostman(openApiSpec) {
  const collection = {
    info: {
      name: openApiSpec.info.title,
      description: openApiSpec.info.description,
      schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json'
    },
    auth: {
      type: 'bearer',
      bearer: [{
        key: 'token',
        value: '{{auth_token}}',
        type: 'string'
      }]
    },
    variable: [
      {
        key: 'base_url',
        value: openApiSpec.servers[0].url,
        type: 'string'
      },
      {
        key: 'auth_token',
        value: '',
        type: 'string'
      }
    ],
    item: []
  };

  // Convert paths to Postman requests
  for (const [path, pathItem] of Object.entries(openApiSpec.paths || {})) {
    const folder = {
      name: path.split('/')[2] || 'General', // Extract resource name
      item: []
    };

    for (const [method, operation] of Object.entries(pathItem)) {
      if (['get', 'post', 'put', 'patch', 'delete'].includes(method)) {
        const request = {
          name: operation.summary || `${method.toUpperCase()} ${path}`,
          request: {
            method: method.toUpperCase(),
            url: {
              raw: `{{base_url}}${path}`,
              host: ['{{base_url}}'],
              path: path.split('/').filter(p => p)
            },
            description: operation.description
          }
        };

        // Add headers
        request.request.header = [
          {
            key: 'Content-Type',
            value: 'application/json',
            type: 'text'
          }
        ];

        // Add body for POST/PUT/PATCH
        if (['post', 'put', 'patch'].includes(method) && operation.requestBody) {
          const content = operation.requestBody.content['application/json'];
          if (content && content.example) {
            request.request.body = {
              mode: 'raw',
              raw: JSON.stringify(content.example, null, 2),
              options: {
                raw: {
                  language: 'json'
                }
              }
            };
          }
        }

        folder.item.push(request);
      }
    }

    if (folder.item.length > 0) {
      collection.item.push(folder);
    }
  }

  return collection;
}

generateDocs();