#!/usr/bin/env node

/**
 * Frontend-Backend Integration Test Script
 * Tests the API endpoints that the frontend uses
 */

import fetch from 'node-fetch';
import chalk from 'chalk';

const API_BASE = 'http://localhost:3000/fms/api/v0';
const FRONTEND_URL = 'http://localhost:5173';

// Test configuration
const tests = [
  {
    name: 'Backend Health Check',
    url: `${API_BASE}/health`,
    method: 'GET',
    expectedStatus: 200,
  },
  {
    name: 'Accounts API',
    url: `${API_BASE}/accounts?includeArchived=false`,
    method: 'GET',
    expectedStatus: 200,
    validateResponse: (data) => {
      return Array.isArray(data.data) && data.success === true;
    },
  },
  {
    name: 'Create Test Journal',
    url: `${API_BASE}/gl-journals`,
    method: 'POST',
    expectedStatus: 201,
    body: {
      journalDate: new Date().toISOString(),
      reference: 'Test Journal from Integration Test',
      lines: [
        {
          lineNum: 1,
          account: '507f1f77bcf86cd799439011', // Mock account ID
          debit: 100,
          credit: 0,
          currency: 'INR',
          exchangeRate: 1,
        },
        {
          lineNum: 2,
          account: '507f1f77bcf86cd799439012', // Mock account ID
          debit: 0,
          credit: 100,
          currency: 'INR',
          exchangeRate: 1,
        },
      ],
    },
    validateResponse: (data) => {
      return data.success === true && data.data && data.data._id;
    },
  },
];

// Test results tracking
let testResults = {
  passed: 0,
  failed: 0,
  total: 0,
  details: [],
};

/**
 * Run a single test
 */
async function runTest(test) {
  console.log(chalk.blue(`\n🧪 Testing: ${test.name}`));
  console.log(chalk.gray(`   ${test.method} ${test.url}`));

  try {
    const options = {
      method: test.method,
      headers: {
        'Content-Type': 'application/json',
      },
    };

    if (test.body) {
      options.body = JSON.stringify(test.body);
    }

    const response = await fetch(test.url, options);
    const data = await response.json();

    // Check status code
    if (response.status !== test.expectedStatus) {
      throw new Error(
        `Expected status ${test.expectedStatus}, got ${response.status}`
      );
    }

    // Validate response if validator provided
    if (test.validateResponse && !test.validateResponse(data)) {
      throw new Error('Response validation failed');
    }

    console.log(chalk.green(`   ✅ PASSED`));
    testResults.passed++;
    testResults.details.push({
      name: test.name,
      status: 'PASSED',
      response: data,
    });

    return data;
  } catch (error) {
    console.log(chalk.red(`   ❌ FAILED: ${error.message}`));
    testResults.failed++;
    testResults.details.push({
      name: test.name,
      status: 'FAILED',
      error: error.message,
    });
    return null;
  }
}

/**
 * Test frontend accessibility
 */
async function testFrontend() {
  console.log(chalk.blue(`\n🌐 Testing Frontend Accessibility`));
  console.log(chalk.gray(`   GET ${FRONTEND_URL}`));

  try {
    const response = await fetch(FRONTEND_URL);
    
    if (response.status === 200) {
      console.log(chalk.green(`   ✅ Frontend is accessible`));
      return true;
    } else {
      throw new Error(`Frontend returned status ${response.status}`);
    }
  } catch (error) {
    console.log(chalk.red(`   ❌ Frontend not accessible: ${error.message}`));
    console.log(chalk.yellow(`   💡 Make sure to run: cd workspace/frontend && npm run dev`));
    return false;
  }
}

/**
 * Check if servers are running
 */
async function checkServers() {
  console.log(chalk.blue(`\n🔍 Checking Server Status`));
  
  const backendRunning = await testBackend();
  const frontendRunning = await testFrontend();
  
  return { backendRunning, frontendRunning };
}

/**
 * Test backend health
 */
async function testBackend() {
  try {
    const response = await fetch(`${API_BASE}/health`);
    if (response.status === 200) {
      console.log(chalk.green(`   ✅ Backend is running`));
      return true;
    }
  } catch (error) {
    console.log(chalk.red(`   ❌ Backend not accessible: ${error.message}`));
    console.log(chalk.yellow(`   💡 Make sure to run: npm start`));
    return false;
  }
}

/**
 * Generate test report
 */
function generateReport() {
  console.log(chalk.blue(`\n📊 Test Report`));
  console.log(chalk.gray(`   Total Tests: ${testResults.total}`));
  console.log(chalk.green(`   Passed: ${testResults.passed}`));
  console.log(chalk.red(`   Failed: ${testResults.failed}`));
  
  const successRate = ((testResults.passed / testResults.total) * 100).toFixed(1);
  console.log(chalk.blue(`   Success Rate: ${successRate}%`));

  if (testResults.failed > 0) {
    console.log(chalk.yellow(`\n❌ Failed Tests:`));
    testResults.details
      .filter(test => test.status === 'FAILED')
      .forEach(test => {
        console.log(chalk.red(`   • ${test.name}: ${test.error}`));
      });
  }

  console.log(chalk.blue(`\n📋 Next Steps:`));
  if (testResults.failed === 0) {
    console.log(chalk.green(`   🎉 All tests passed! Your frontend-backend integration is working.`));
    console.log(chalk.blue(`   🌐 Open ${FRONTEND_URL} to test the UI`));
  } else {
    console.log(chalk.yellow(`   🔧 Fix the failed tests before proceeding`));
    console.log(chalk.blue(`   📖 Check the integration guide: docs/FRONTEND_BACKEND_INTEGRATION.md`));
  }
}

/**
 * Main test runner
 */
async function runIntegrationTests() {
  console.log(chalk.blue.bold(`\n🚀 FMS Frontend-Backend Integration Tests`));
  console.log(chalk.gray(`   Testing API endpoints used by the frontend`));

  // Check server status
  const { backendRunning, frontendRunning } = await checkServers();
  
  if (!backendRunning) {
    console.log(chalk.red(`\n❌ Backend is not running. Please start the backend first.`));
    process.exit(1);
  }

  // Run API tests
  testResults.total = tests.length;
  
  for (const test of tests) {
    await runTest(test);
  }

  // Generate report
  generateReport();

  // Exit with appropriate code
  process.exit(testResults.failed > 0 ? 1 : 0);
}

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error(chalk.red(`\n💥 Unhandled error: ${error.message}`));
  process.exit(1);
});

// Run tests
runIntegrationTests().catch((error) => {
  console.error(chalk.red(`\n💥 Test runner failed: ${error.message}`));
  process.exit(1);
});
