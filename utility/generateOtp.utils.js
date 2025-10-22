// utils/generateOtp.js
// const crypto = require("crypto");
import crypto from 'crypto';

/**
 * Generates an OTP based on the specified type and length.
 * @param {String} type - Type of OTP: 'numeric', 'alphanumeric', 'alphanumeric_special'
 * @param {Number} length - Length of the OTP
 * @returns {String} - Generated OTP
 */
function generateOtp(type = 'numeric', length = 6) {
  let characters = '';

  switch (type) {
  case 'numeric':
    characters = '0123456789';
    break;
  case 'alphanumeric':
    characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    break;
  case 'alphanumeric_special':
    characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!@#$%^&*()_+[]{}|;:,.<>?';
    break;
  default:
    throw new Error('Invalid OTP type specified.');
  }

  let otp = '';
  const charactersLength = characters.length;
  for (let i = 0; i < length; i++) {
    const randomByte = crypto.randomBytes(1)[0];
    otp += characters.charAt(randomByte % charactersLength);
  }

  return otp;
}

export default generateOtp;
