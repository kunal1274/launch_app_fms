#!/usr/bin/env node

/**
 * Password Login Test Script
 * Tests password login functionality
 */

// Using built-in fetch (Node.js 18+)

const BASE_URL = 'http://localhost:3000/fms/api/v0/otp-auth';

async function testPasswordLogin() {
  console.log('🧪 Testing Password Login...\n');

  const testCases = [
    {
      email: 'kunal1274@gmail.com',
      password: 'test123',
      description: 'User with known password'
    },
    {
      email: 'kunal1274@gmail.com',
      password: 'wrongpassword',
      description: 'User with wrong password'
    },
    {
      email: 'nonexistent@gmail.com',
      password: 'anypassword',
      description: 'Non-existent user'
    }
  ];

  for (const testCase of testCases) {
    console.log(`📝 Testing: ${testCase.description}`);
    console.log(`📧 Email: ${testCase.email}`);
    console.log(`🔐 Password: ${testCase.password}`);
    
    try {
      const response = await fetch(`${BASE_URL}/login-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: testCase.email,
          password: testCase.password
        })
      });
      
      const result = await response.json();
      
      console.log(`📊 Status: ${response.status}`);
      console.log(`📊 Success: ${result.success}`);
      console.log(`📊 Message: ${result.message}`);
      
      if (result.data?.token) {
        console.log(`🎟️ Token: ${result.data.token.substring(0, 20)}...`);
      }
      
    } catch (error) {
      console.log(`❌ Error: ${error.message}`);
    }
    
    console.log('\n' + '='.repeat(50) + '\n');
  }
}

// Run the test
testPasswordLogin().catch(console.error);
