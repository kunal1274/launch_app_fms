#!/usr/bin/env node

/**
 * Authentication Test Script
 * Tests all authentication scenarios
 */

const BASE_URL = 'http://localhost:3000/fms/api/v0/otp-auth';

async function testAuth() {
  console.log('🧪 Starting Authentication Tests...\n');

  // Test 1: Password login for existing user with password
  console.log('📝 Test 1: Password login for kunal1274@gmail.com');
  try {
    const response = await fetch(`${BASE_URL}/login-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'kunal1274@gmail.com',
        password: 'your_password_here' // Replace with actual password
      })
    });
    const result = await response.json();
    console.log('✅ Password login result:', result.success ? 'SUCCESS' : 'FAILED');
    console.log('📊 Response:', result.message);
  } catch (error) {
    console.log('❌ Password login error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 2: OTP login for existing user
  console.log('📝 Test 2: OTP login for kunal1274@gmail.com');
  try {
    // Send OTP
    console.log('📤 Sending OTP...');
    const otpResponse = await fetch(`${BASE_URL}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'kunal1274@gmail.com',
        method: 'email'
      })
    });
    const otpResult = await otpResponse.json();
    console.log('📧 OTP send result:', otpResult.msg);
    
    if (otpResult.otp) {
      console.log('🔢 OTP from response:', otpResult.otp);
      console.log('💡 Use this OTP to verify in the next step');
    }
  } catch (error) {
    console.log('❌ OTP send error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 3: OTP login for existing OTP user
  console.log('📝 Test 3: OTP login for ctrmratxen@gmail.com');
  try {
    // Send OTP
    console.log('📤 Sending OTP...');
    const otpResponse = await fetch(`${BASE_URL}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ctrmratxen@gmail.com',
        method: 'email'
      })
    });
    const otpResult = await otpResponse.json();
    console.log('📧 OTP send result:', otpResult.msg);
    
    if (otpResult.otp) {
      console.log('🔢 OTP from response:', otpResult.otp);
      console.log('💡 Use this OTP to verify in the next step');
    }
  } catch (error) {
    console.log('❌ OTP send error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 4: Password login for OTP user (should fail)
  console.log('📝 Test 4: Password login for ctrmratxen@gmail.com (should fail)');
  try {
    const response = await fetch(`${BASE_URL}/login-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'ctrmratxen@gmail.com',
        password: 'any_password'
      })
    });
    const result = await response.json();
    console.log('📊 Password login result:', result.success ? 'SUCCESS' : 'FAILED (Expected)');
    console.log('📊 Response:', result.message);
  } catch (error) {
    console.log('❌ Password login error:', error.message);
  }

  console.log('\n' + '='.repeat(50) + '\n');

  // Test 5: OTP login for new user (should create user)
  console.log('📝 Test 5: OTP login for new user (should create user)');
  const newEmail = `testuser${Date.now()}@gmail.com`;
  try {
    // Send OTP
    console.log('📤 Sending OTP to new user:', newEmail);
    const otpResponse = await fetch(`${BASE_URL}/send-otp`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: newEmail,
        method: 'email'
      })
    });
    const otpResult = await otpResponse.json();
    console.log('📧 OTP send result:', otpResult.msg);
    
    if (otpResult.otp) {
      console.log('🔢 OTP from response:', otpResult.otp);
      console.log('💡 Use this OTP to verify in the next step');
    }
  } catch (error) {
    console.log('❌ OTP send error:', error.message);
  }

  console.log('\n🎉 Authentication tests completed!');
  console.log('💡 Check server logs for detailed debugging information');
  console.log('💡 Check your email for OTP messages');
  console.log('💡 Use the OTPs from responses to complete verification');
}

// Run the tests
testAuth().catch(console.error);
