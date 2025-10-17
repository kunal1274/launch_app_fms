#!/usr/bin/env node

/**
 * Test Runner Script
 * Runs all tests with proper configuration and reporting
 */

import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const testTypes = {
  unit: 'jest --testPathPattern=unit --detectOpenHandles --forceExit',
  integration: 'jest --testPathPattern=integration --detectOpenHandles --forceExit',
  e2e: 'jest --testPathPattern=e2e --detectOpenHandles --forceExit',
  all: 'jest --detectOpenHandles --forceExit',
  coverage: 'jest --coverage --detectOpenHandles --forceExit'
};

const testType = process.argv[2] || 'all';

if (!testTypes[testType]) {
  console.error(`❌ Invalid test type: ${testType}`);
  console.error(`Available types: ${Object.keys(testTypes).join(', ')}`);
  process.exit(1);
}

console.log(`🚀 Running ${testType} tests...`);
console.log(`Command: ${testTypes[testType]}`);

const child = spawn('npx', testTypes[testType].split(' '), {
  stdio: 'inherit',
  shell: true,
  cwd: path.join(__dirname, '..')
});

child.on('close', (code) => {
  if (code === 0) {
    console.log(`✅ ${testType} tests completed successfully`);
  } else {
    console.error(`❌ ${testType} tests failed with exit code ${code}`);
    process.exit(code);
  }
});

child.on('error', (error) => {
  console.error(`❌ Error running tests: ${error.message}`);
  process.exit(1);
});