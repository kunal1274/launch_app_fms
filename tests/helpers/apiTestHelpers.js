/**
 * API Test Helpers
 * Utility functions for API testing
 */

import request from 'supertest';
import { TestDataFactory } from './testDataFactory.js';

export class ApiTestHelpers {
  constructor(app) {
    this.app = app;
  }

  /**
   * Test API endpoint with various scenarios
   */
  async testEndpoint(endpoint, method = 'GET', testData = {}) {
    const scenarios = [
      { name: 'Valid Request', data: testData.valid, expectedStatus: 200 },
      { name: 'Invalid Data', data: testData.invalid, expectedStatus: 400 },
      { name: 'Missing Required Fields', data: testData.missing, expectedStatus: 422 },
      { name: 'Unauthorized Access', data: testData.unauthorized, expectedStatus: 401 }
    ];

    const results = [];
    
    for (const scenario of scenarios) {
      if (scenario.data) {
        const response = await this.makeRequest(endpoint, method, scenario.data);
        results.push({
          scenario: scenario.name,
          expectedStatus: scenario.expectedStatus,
          actualStatus: response.status,
          passed: response.status === scenario.expectedStatus,
          response: response.body
        });
      }
    }

    return results;
  }

  /**
   * Make HTTP request
   */
  async makeRequest(endpoint, method, data = null) {
    const req = request(this.app)[method.toLowerCase()](endpoint);
    
    if (data) {
      if (method === 'GET') {
        return await req.query(data);
      } else {
        return await req.send(data);
      }
    }
    
    return await req;
  }

  /**
   * Test CRUD operations
   */
  async testCRUDOperations(baseEndpoint, createData, updateData) {
    const results = {
      create: null,
      read: null,
      update: null,
      delete: null
    };

    // Test Create
    const createResponse = await this.makeRequest(baseEndpoint, 'POST', createData);
    results.create = {
      status: createResponse.status,
      data: createResponse.body.data,
      passed: createResponse.status === 201
    };

    if (results.create.passed) {
      const createdId = createResponse.body.data._id;

      // Test Read
      const readResponse = await this.makeRequest(`${baseEndpoint}/${createdId}`, 'GET');
      results.read = {
        status: readResponse.status,
        data: readResponse.body.data,
        passed: readResponse.status === 200
      };

      // Test Update
      const updateResponse = await this.makeRequest(`${baseEndpoint}/${createdId}`, 'PUT', updateData);
      results.update = {
        status: updateResponse.status,
        data: updateResponse.body.data,
        passed: updateResponse.status === 200
      };

      // Test Delete
      const deleteResponse = await this.makeRequest(`${baseEndpoint}/${createdId}`, 'DELETE');
      results.delete = {
        status: deleteResponse.status,
        passed: deleteResponse.status === 200
      };
    }

    return results;
  }

  /**
   * Test pagination
   */
  async testPagination(endpoint, page = 1, limit = 10) {
    const response = await this.makeRequest(endpoint, 'GET', { page, limit });
    
    return {
      status: response.status,
      data: response.body.data,
      pagination: response.body.pagination,
      passed: response.status === 200 && Array.isArray(response.body.data)
    };
  }

  /**
   * Test filtering
   */
  async testFiltering(endpoint, filters) {
    const response = await this.makeRequest(endpoint, 'GET', filters);
    
    return {
      status: response.status,
      data: response.body.data,
      filters: filters,
      passed: response.status === 200
    };
  }

  /**
   * Test sorting
   */
  async testSorting(endpoint, sortBy, sortOrder = 'asc') {
    const response = await this.makeRequest(endpoint, 'GET', { sortBy, sortOrder });
    
    return {
      status: response.status,
      data: response.body.data,
      sortBy,
      sortOrder,
      passed: response.status === 200
    };
  }

  /**
   * Test bulk operations
   */
  async testBulkOperations(endpoint, operation, data) {
    const response = await this.makeRequest(`${endpoint}/bulk`, 'POST', { data });
    
    return {
      status: response.status,
      data: response.body.data,
      count: response.body.data?.length || 0,
      passed: response.status === 201
    };
  }

  /**
   * Test status transitions
   */
  async testStatusTransitions(endpoint, validTransitions, invalidTransitions) {
    const results = {
      valid: [],
      invalid: []
    };

    // Test valid transitions
    for (const transition of validTransitions) {
      const response = await this.makeRequest(`${endpoint}/${transition.id}/status`, 'PATCH', {
        newStatus: transition.status
      });
      
      results.valid.push({
        from: transition.from,
        to: transition.status,
        status: response.status,
        passed: response.status === 200
      });
    }

    // Test invalid transitions
    for (const transition of invalidTransitions) {
      const response = await this.makeRequest(`${endpoint}/${transition.id}/status`, 'PATCH', {
        newStatus: transition.status
      });
      
      results.invalid.push({
        from: transition.from,
        to: transition.status,
        status: response.status,
        passed: response.status === 400
      });
    }

    return results;
  }

  /**
   * Test payment processing
   */
  async testPaymentProcessing(endpoint, paymentData) {
    const response = await this.makeRequest(`${endpoint}/payment`, 'POST', paymentData);
    
    return {
      status: response.status,
      data: response.body,
      passed: response.status === 200
    };
  }

  /**
   * Test file upload
   */
  async testFileUpload(endpoint, fileData) {
    const response = await request(this.app)
      .post(`${endpoint}/upload`)
      .attach('files', fileData.buffer, fileData.filename);
    
    return {
      status: response.status,
      data: response.body,
      passed: response.status === 200
    };
  }

  /**
   * Test error handling
   */
  async testErrorHandling(endpoint, errorScenarios) {
    const results = [];

    for (const scenario of errorScenarios) {
      const response = await this.makeRequest(endpoint, scenario.method, scenario.data);
      
      results.push({
        scenario: scenario.name,
        expectedStatus: scenario.expectedStatus,
        actualStatus: response.status,
        passed: response.status === scenario.expectedStatus,
        error: response.body.error || response.body.message
      });
    }

    return results;
  }

  /**
   * Test performance
   */
  async testPerformance(endpoint, method = 'GET', data = null, iterations = 10) {
    const startTime = Date.now();
    const responses = [];

    for (let i = 0; i < iterations; i++) {
      const response = await this.makeRequest(endpoint, method, data);
      responses.push(response);
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const averageTime = totalTime / iterations;

    return {
      totalTime,
      averageTime,
      iterations,
      responses: responses.map(r => r.status),
      passed: averageTime < 1000 // Less than 1 second average
    };
  }

  /**
   * Test concurrent requests
   */
  async testConcurrency(endpoint, method = 'GET', data = null, concurrency = 5) {
    const promises = [];

    for (let i = 0; i < concurrency; i++) {
      promises.push(this.makeRequest(endpoint, method, data));
    }

    const responses = await Promise.all(promises);
    
    return {
      concurrency,
      responses: responses.map(r => r.status),
      passed: responses.every(r => r.status === 200),
      errors: responses.filter(r => r.status !== 200)
    };
  }

  /**
   * Generate test report
   */
  generateTestReport(testResults) {
    const totalTests = testResults.length;
    const passedTests = testResults.filter(r => r.passed).length;
    const failedTests = totalTests - passedTests;
    const passRate = (passedTests / totalTests) * 100;

    return {
      summary: {
        total: totalTests,
        passed: passedTests,
        failed: failedTests,
        passRate: passRate.toFixed(2) + '%'
      },
      details: testResults,
      timestamp: new Date().toISOString()
    };
  }
}