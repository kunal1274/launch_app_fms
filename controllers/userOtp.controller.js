// controllers/authController.js
//import twilio from "twilio";
import dotenv from 'dotenv';
dotenv.config();

console.log('EMAIL_USER:', !!process.env.EMAIL_USER);
console.log('EMAIL_PASS:', !!process.env.EMAIL_PASS);

import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { winstonLogger } from '../utility/logError.utils.js';
import { UserGlobalModel } from '../models/userGlobal.model.js';
import { UserOtpModel } from '../models/userOtp.model.js';
import generateOtp from '../utility/generateOtp.utils.js';
import {
  getFormattedLocalDateTime,
  getLocalTimeString,
} from '../utility/getLocalTime.js';
import createGlobalPartyId from '../shared_service/utility/createGlobalParty.utility.js';
import { dbgEmail } from '../index.js';

// // Twilio configuration
// const accountSid = process.env.TWILIO_ACCOUNT_SID;
// const authToken = process.env.TWILIO_AUTH_TOKEN;
// const whatsappFrom = `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`;
// const smsFrom = process.env.TWILIO_SMS_NUMBER;
// const client = twilio(accountSid, authToken);

// (async () => {
//   //   const t = nodemailer.createTransport({
//   //     host: "smtp.gmail.com",
//   //     port: 465,
//   //     secure: true,
//   //     auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS },
//   //   });
//   const t = nodemailer.createTransport({
//     service: "gmail",
//     auth: {
//       user: process.env.EMAIL_USER,
//       pass: process.env.EMAIL_PASS,
//     },
//     debug: true,
//     logger: true,
//   });

//   // const t1 = nodemailer.createTransport({
//   //   host: "smtp.gmail.com",
//   //   port: 465,
//   //   secure: true, // SSL
//   //   auth: {
//   //     user: "adhikariratxen@gmail.com", //process.env.EMAIL_USER,
//   //     pass: "fkclmsoibzfhnzsw", //process.env.EMAIL_PASS,
//   //   },
//   //   logger: true,
//   //   debug: true,
//   // });

//   try {
//     await t.verify();
//     console.log("SMTP OK");
//     const r = await t.sendMail({
//       from: "adhikariratxen@gmail.com",
//       to: "kunalratxen@gmail.com",
//       subject: "SMTP Test",
//       text: "It works!",
//     });
//     console.log("Mail sent:", r.messageId);
//   } catch (err) {
//     console.error("Test failed:", err);
//   }
// })();

// Nodemailer configuration for sending emails
const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3'
  },
  connectionTimeout: 60000, // 60 seconds
  greetingTimeout: 30000,   // 30 seconds
  socketTimeout: 60000,     // 60 seconds
  debug: true,
  logger: true,
});

// const transporter = nodemailer.createTransport({
//   host: "smtp.gmail.com",
//   port: 465,
//   secure: true, // SSL
//   auth: {
//     user: "adhikariratxen@gmail.com", //process.env.EMAIL_USER,
//     pass: "fkclmsoibzfhnzsw", //process.env.EMAIL_PASS,
//   },
//   logger: true,
//   debug: true,
// });

// // right after `createTransport(...)`
transporter
  .verify()
  .then(() => {
    dbgEmail('✅ SMTP connection OK');
    console.log('✅ Email transporter verified successfully');
  })
  .catch((err) => {
    dbgEmail('❌ SMTP connection failed:', {
      message: err.message,
      stack: err.stack,
    });
    console.error('❌ Email transporter verification failed:', {
      message: err.message,
      code: err.code,
      command: err.command,
      response: err.response
    });
    // Optionally throw or process.exit here
  });

/**
 * sendOtp - Controller to generate and send an OTP via WhatsApp, SMS, or email.
 * Expects in the request body:
 *  - phoneNumber and/or email,
 *  - method: one of "whatsapp", "sms", or "email",
 *  - otpType (optional, defaults to "numeric"),
 *  - otpLength (optional, defaults to 6).
 */

// dbgEmail("Nodemailer transport created with", transporter);

export const sendOtp = async (req, res) => {
  const { phoneNumber, email, method, otpType, otpLength } = req.body;

  // Validate required inputs
  if (!method || (!phoneNumber && !email)) {
    winstonLogger.error('Missing identifier or method', {
      phoneNumber,
      email,
      method,
    });
    return res.status(400).json({
      msg: '⚠️ Phone number or email is required, and method must be specified',
    });
  }

  // For email method, allow OTP for both existing and new users
  if (method === 'email' && email) {
    try {
      const existingUser = await UserGlobalModel.findOne({ 
        email: email.toLowerCase(),
        isActive: true 
      });
      
      if (existingUser) {
        winstonLogger.info('OTP requested for existing user', { 
          email, 
          userId: existingUser._id,
          signInMethod: existingUser.signInMethod 
        });
      } else {
        winstonLogger.info('OTP requested for new user - will be created after verification', { email });
      }
    } catch (error) {
      winstonLogger.error('Error checking user existence', { 
        error: error.message,
        email 
      });
      return res.status(500).json({
        msg: '❌ Error validating user. Please try again.',
      });
    }
  }

  if (!['whatsapp', 'sms', 'email'].includes(method)) {
    return res
      .status(400)
      .json({ msg: '⚠️ Invalid method. Choose from whatsapp, sms, or email.' });
  }
  if (
    otpType &&
    !['numeric', 'alphanumeric', 'alphanumeric_special'].includes(otpType)
  ) {
    return res.status(400).json({
      msg: '⚠️ Invalid OTP type. Choose from numeric, alphanumeric, or alphanumeric_special.',
    });
  }

  // For email method, ensure the email is not already registered in the User model.
  if (method === 'email' && email) {
    const existingGlobalUser = await UserGlobalModel.findOne({
      email: email.toLowerCase().trim(),
    });

    // const existingUser = await UserGoogleModel.findOne({
    //   email: email.toLowerCase().trim(),
    // });
    const existingUserEmailInOtpModel = await UserOtpModel.findOne({
      email: email.toLowerCase().trim(),
    });
    if (existingUserEmailInOtpModel) {
      await UserOtpModel.deleteOne({
        email: email.toLowerCase().trim(),
      });
    }

    if (existingGlobalUser) {
      console.log(`Found the Global user ${existingGlobalUser}`);
    } else {
      console.log(`Not Found the user with email ${existingGlobalUser}`);
    }

    // if (existingUser) {
    //   return res.status(400).json({
    //     msg: "This email is already registered. Please use your registered login method.Try with Google Sign in.",
    //   });
    // }
  }

  const finalOtpType = otpType || 'numeric';
  const finalOtpLength = otpLength || 6;
  const otp = generateOtp(finalOtpType, finalOtpLength);

  winstonLogger.info('Generated OTP', { otp });

  try {
    // Build query for existing OTP (if any) based on the method
    // let query = { otp };
    // if ((method === "whatsapp" || method === "sms") && phoneNumber) {
    //   query.phoneNumber = phoneNumber;
    // }
    // if (method === "email" && email) {
    //   query.email = email;
    // }

    // // Remove any previous OTP matching the query
    // await UserOtpModel.findOneAndDelete(query);

    // Save the new OTP record
    const newOtpRecord = await UserOtpModel.create({
      phoneNumber: phoneNumber || null,
      email: email || null,
      otp,
      method,
      otpType: finalOtpType,
    });
    winstonLogger.info('OTP saved to database', { newOtpRecord });

    // Send the OTP based on method
    if (method === 'whatsapp' && phoneNumber) {
      await client.messages.create({
        body: `Your OTP is: ${otp}`,
        from: whatsappFrom,
        to: `whatsapp:${phoneNumber}`,
      });
      winstonLogger.info('OTP sent via WhatsApp', { phoneNumber });
      return res
        .status(200)
        .json({ msg: 'OTP sent via WhatsApp successfully' });
    } else if (method === 'sms' && phoneNumber) {
      await client.messages.create({
        body: `Your OTP is: ${otp}`,
        from: smsFrom,
        to: phoneNumber,
      });
      winstonLogger.info('OTP sent via SMS', { phoneNumber });
      return res.status(200).json({ msg: 'OTP sent via SMS successfully' });
    } else if (method === 'email' && email) {
      const mailOptions = {
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Your New OTP Code',
        text: `Your new verification code is: ${otp}\n\nThis code will expire in 15 minutes.\n\nIf you didn't request this code, please ignore this email.`,
        html: `
        <!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Your New OTP Code</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f8f9fa;
            }
            .email-container {
              background-color: #ffffff;
              border-radius: 12px;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
              overflow: hidden;
            }
            .header {
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              color: white;
              padding: 30px 20px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 600;
            }
            .content {
              padding: 40px 30px;
              text-align: center;
            }
            .intro-text {
              font-size: 18px;
              color: #555;
              margin-bottom: 30px;
            }
            .otp-container {
              background-color: #f8f9fa;
              border: 2px solid #e9ecef;
              border-radius: 12px;
              padding: 25px;
              margin: 30px 0;
              display: inline-block;
            }
            .otp-code {
              font-size: 36px;
              font-weight: 700;
              color: #2563eb;
              letter-spacing: 8px;
              margin: 0;
              font-family: 'Courier New', monospace;
            }
            .expiry-notice {
              color: #6b7280;
              font-size: 16px;
              margin: 20px 0;
            }
            .disclaimer {
              color: #9ca3af;
              font-size: 14px;
              margin-top: 30px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
            }
            .footer {
              background-color: #f8f9fa;
              padding: 20px;
              text-align: center;
              color: #6b7280;
              font-size: 14px;
            }
            .security-note {
              background-color: #fef3c7;
              border: 1px solid #f59e0b;
              border-radius: 8px;
              padding: 15px;
              margin: 20px 0;
              color: #92400e;
            }
            .security-note strong {
              color: #b45309;
            }
          </style>
        </head>
        <body>
          <div class="email-container">
            <div class="header">
              <h1>Your New OTP Code</h1>
            </div>
            
            <div class="content">
              <p class="intro-text">Your new verification code is:</p>
              
              <div class="otp-container">
                <p class="otp-code">${otp}</p>
              </div>
              
              <p class="expiry-notice">This code will expire in 15 minutes.</p>
              
              <div class="security-note">
                <strong>Security Notice:</strong> Never share this code with anyone. Our team will never ask for your OTP code.
              </div>
              
              <p class="disclaimer">If you didn't request this code, please ignore this email.</p>
            </div>
            
            <div class="footer">
              <p>This is an automated message from FMS Ratxen. Please do not reply to this email.</p>
            </div>
          </div>
        </body>
        </html>
        `,
      };
      try {
        // Check if email sending is explicitly disabled
        const skipEmail = process.env.SKIP_EMAIL === 'true';
        
        if (skipEmail) {
          console.log('🚧 Email sending disabled via SKIP_EMAIL=true');
          winstonLogger.info('OTP generated with email sending disabled', { email, otp });
          return res.status(200).json({
            msg: `✅ OTP generated (email disabled): ${otp}`,
            otp: otp,
            emailDisabled: true
          });
        }
        
        // Try to send email with retry logic
        let emailSent = false;
        let lastError = null;
        
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`📧 Attempting to send email (attempt ${attempt}/3)...`);
            await transporter.sendMail(mailOptions);
            emailSent = true;
            winstonLogger.info('OTP sent via Email', { email, attempt });
            break;
          } catch (retryError) {
            lastError = retryError;
            console.error(`❌ Email attempt ${attempt} failed:`, retryError.message);
            
            if (attempt < 3) {
              // Wait before retry (exponential backoff)
              const delay = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
              console.log(`⏳ Waiting ${delay}ms before retry...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
        
        if (emailSent) {
          return res.status(200).json({
            msg: `✅ OTP sent via email successfully recorded at 🕒 local time ${getLocalTimeString()} and in detailed 📅 ${getFormattedLocalDateTime()}`,
          });
        } else {
          // Email failed but OTP is saved - return success with warning
          winstonLogger.warn('Email sending failed but OTP saved', { 
            email: email,
            error: lastError?.message,
            otp: otp // Include OTP in response for manual verification
          });
          
          return res.status(200).json({
            msg: `⚠️ OTP generated and saved, but email delivery failed. Please check your email or try again. OTP: ${otp}`,
            otp: otp, // Include OTP in response for development/testing
            emailDeliveryFailed: true
          });
        }
      } catch (emailError) {
        winstonLogger.error('Failed to send email', { 
          error: emailError.message,
          email: email,
          stack: emailError.stack 
        });
        return res.status(500).json({ 
          msg: '❌ Failed to send email. Please try again later.',
          error: emailError.message 
        });
      }
    } else {
      return res
        .status(400)
        .json({ msg: '❌ Invalid method or missing phone number/email' });
    }
  } catch (err) {
    winstonLogger.error('Error in sendOtp', { error: err });
    return res.status(500).json({ msg: '❌ Server Error', error: err });
  }
};

/**
 * verifyOtp - Controller to verify a provided OTP.
 * Expects in the request body:
 *  - phoneNumber and/or email,
 *  - otp.
 */

export const verifyOtp = async (req, res) => {
  const { phoneNumber, email, otp } = req.body;
  console.log('line 185 verifyOtpController.js ', req.body);

  if ((!phoneNumber && !email) || !otp) {
    return res
      .status(400)
      .json({ msg: '⚠️ Phone number or email and OTP are required' });
  }
  try {
    let query = { otp };
    if (phoneNumber) query.phoneNumber = phoneNumber || null;
    if (email) query.email = email.toLowerCase().trim() || null;

    // 1) Try to find existing user by email or phone
    let existingGlobalUser;
    if (email) {
      existingGlobalUser = await UserGlobalModel.findOne({
        email: email.toLowerCase().trim(),
      });
    } else if (phoneNumber) {
      existingGlobalUser = await UserGlobalModel.findOne({ phoneNumber });
    }

    console.log('line 201', query);

    const otpRecord = await UserOtpModel.findOne(query);
    // const otpRecord1 = UserOtpModel.findOne(query);
    // logger.info("line 428 otp record ", {
    //   otpRecordVerification: otpRecord._id,
    // });
    console.log(
      'line 209',
      otpRecord,
      otpRecord?.phoneNumber,
      otpRecord?.email
    );
    if (!otpRecord) {
      return res.status(400).json({ msg: '🤕 Invalid or expired OTP' });
    }
    console.log('line 217 record expire', otpRecord.expiresAt < Date.now());
    // Check expiration
    if (otpRecord.expiresAt < Date.now()) {
      await UserOtpModel.deleteOne({ _id: otpRecord._id });
      return res.status(400).json({ msg: '🤯 OTP has expired' });
    }

    // Generate JWT token (payload can be customized)
    //const payload = { email, phoneNumber };
    const payload = {
      //userId: user._id,
      email: email,
      phoneNumber: phoneNumber,
    };
    const token1 = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '1h',
    });
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '15m',
    });
    console.log('line 237 in user otp controller and token is ', token);

    // console.log(
    //   "line 239",
    //   existingGlobalUser,
    //   existingGlobalUser?.globalPartyId
    // );

    if (existingGlobalUser && !existingGlobalUser.globalPartyId) {
      const partyIdForExistingRecord = await createGlobalPartyId(
        'User',
        null,
        email ? email : phoneNumber
      );
      existingGlobalUser.globalPartyId = partyIdForExistingRecord;
      await existingGlobalUser.save();
    }

    if (!existingGlobalUser) {
      const partyIdNew = await createGlobalPartyId(
        'User',
        null,
        email ? email : phoneNumber
      );

      const newUser = await UserGlobalModel.create({
        email: email ? email.toLowerCase().trim() : null,
        phoneNumber: phoneNumber || null,
        method: email ? 'email' : 'phone',
        signInMethod: 'otp',
        globalPartyId: partyIdNew,
        name: email ? email.split('@')[0] : phoneNumber,
        isActive: true,
      });
      
      winstonLogger.info('New user created via OTP', { 
        userId: newUser._id,
        email: newUser.email,
        phoneNumber: newUser.phoneNumber,
        signInMethod: newUser.signInMethod 
      });
    } else {
      winstonLogger.info('Existing user verified via OTP', { 
        userId: existingGlobalUser._id,
        email: existingGlobalUser.email,
        signInMethod: existingGlobalUser.signInMethod 
      });
    }

    console.log('line 269 record before deletion', otpRecord?._id);

    // OTP is valid; delete it and respond
    await UserOtpModel.deleteOne({ _id: otpRecord._id });

    return res.status(200).json({
      msg: `✅ OTP verified successfully recorded at 🕒 local time ${getLocalTimeString()} and in detailed 📅 ${getFormattedLocalDateTime()}`,
      token: token,
    });
  } catch (err) {
    winstonLogger.error('Error in verifyOtp', { error: err });

    return res.status(500).json({
      msg: `❌ Server Error recorded at 🕒 local time ${getLocalTimeString()} and in detailed 📅 ${getFormattedLocalDateTime()}`,
      error: err,
    });
  }
};

/**
 * registerUser - Controller to register a new user with name and password after OTP verification
 * Expects in the request body:
 *  - email (required)
 *  - name (required)
 *  - password (required)
 *  - confirmPassword (required)
 */
export const registerUser = async (req, res) => {
  const { email, name, password, confirmPassword } = req.body;
  
  // Validate required fields
  if (!email || !name || !password || !confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'All fields are required: email, name, password, confirmPassword'
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Invalid email format'
    });
  }

  // Validate password match
  if (password !== confirmPassword) {
    return res.status(400).json({
      success: false,
      message: 'Passwords do not match'
    });
  }

  // Validate password strength
  if (password.length < 8) {
    return res.status(400).json({
      success: false,
      message: 'Password must be at least 8 characters long'
    });
  }

  try {
    // Check if user already exists
    const existingUser = await UserGlobalModel.findOne({
      email: email.toLowerCase().trim()
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists'
      });
    }

    // Create global party ID
    const partyId = await createGlobalPartyId(
      'User',
      null,
      email
    );

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 12);

    // Create new user
    const newUser = await UserGlobalModel.create({
      email: email.toLowerCase().trim(),
      name,
      password: hashedPassword,
      method: 'email',
      signInMethod: 'password',
      globalPartyId: partyId,
      isActive: true
    });

    // Generate JWT token
    const payload = {
      userId: newUser._id,
      email: newUser.email,
      name: newUser.name
    };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    return res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: newUser._id,
          name: newUser.name,
          email: newUser.email
        },
        token
      }
    });

  } catch (error) {
    winstonLogger.error('Error in registerUser', { error });
    return res.status(500).json({
      success: false,
      message: 'Registration failed',
      error: error.message
    });
  }
};

/**
 * loginWithPassword - Controller to authenticate user with email and password
 * Expects in the request body:
 *  - email: User's email address
 *  - password: User's password
 */
export const loginWithPassword = async (req, res) => {
  const { email, password } = req.body;

  // Validate required fields
  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: 'Email and password are required'
    });
  }

  // Validate email format
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Please provide a valid email address'
    });
  }

  try {
    // Find user by email
    const user = await UserGlobalModel.findOne({ 
      email: email.toLowerCase()
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if user is active (not explicitly inactive)
    if (user.isActive === false) {
      return res.status(401).json({
        success: false,
        message: 'Account is inactive. Please contact support.'
      });
    }

    // Check if user has a password set
    if (!user.password) {
      return res.status(401).json({
        success: false,
        message: 'Password not set for this account. Please use OTP login or register first.'
      });
    }

    // Verify password
    console.log('🔐 Password verification debug:', {
      email: user.email,
      hasPassword: !!user.password,
      passwordLength: user.password?.length,
      signInMethod: user.signInMethod,
      userId: user._id
    });
    
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log('🔐 Password comparison result:', isPasswordValid);
    
    if (!isPasswordValid) {
      winstonLogger.warn('Password verification failed', { 
        email: user.email,
        userId: user._id,
        signInMethod: user.signInMethod
      });
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }
    
    winstonLogger.info('Password verification successful', { 
      email: user.email,
      userId: user._id,
      signInMethod: user.signInMethod
    });

    // Generate JWT token
    const token = jwt.sign(
      { 
        userId: user._id, 
        email: user.email,
        role: user.role 
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    winstonLogger.info('User logged in with password', { 
      email: user.email,
      userId: user._id 
    });

    return res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        token: token,
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          isActive: user.isActive
        }
      }
    });

  } catch (error) {
    winstonLogger.error('Password login error', { 
      error: error.message,
      email: email 
    });
    
    return res.status(500).json({
      success: false,
      message: 'Internal server error during login'
    });
  }
};

// BASIC CRUD for emergency or optional purpose
/**
 * Create a new OTP record
 *
 * Typically you'd check if an existing record with the same email/phone exists
 * and update it rather than creating multiples. But here's the simplest approach.
 */
export const createOtp = async (req, res) => {
  try {
    const { phoneNumber, email, otp, method, otpType } = req.body;

    if (!otp || !method || !otpType) {
      return res.status(400).json({
        message: 'otp, method, and otpType are required fields',
      });
    }

    // Create a new OTP record
    const newOtp = new UserOtpModel({
      phoneNumber,
      email,
      otp,
      method,
      otpType,
      // expiresAt is automatically set by default
    });

    const savedOtp = await newOtp.save();
    return res.status(201).json(savedOtp);
  } catch (error) {
    console.error('Error creating OTP:', error);
    return res.status(500).json({ message: 'Failed to create OTP record' });
  }
};

/**
 * Get all OTP records
 */
export const getAllOtps = async (req, res) => {
  try {
    const otps = await UserOtpModel.find();
    return res.json(otps);
  } catch (error) {
    console.error('Error fetching OTPs:', error);
    return res.status(500).json({ message: 'Failed to fetch OTP records' });
  }
};

/**
 * Get a single OTP record by ID
 */
export const getOtpById = async (req, res) => {
  try {
    const { id } = req.params;
    const otpRecord = await UserOtpModel.findById(id);
    if (!otpRecord) {
      return res.status(404).json({ message: 'OTP record not found' });
    }
    return res.json(otpRecord);
  } catch (error) {
    console.error('Error fetching OTP by ID:', error);
    return res.status(500).json({ message: 'Failed to fetch OTP record' });
  }
};

/**
 * Update an OTP record by ID
 */
export const updateOtp = async (req, res) => {
  try {
    const { id } = req.params;
    const { phoneNumber, email, otp, method, otpType, expiresAt } = req.body;

    const updatedOtp = await UserOtpModel.findByIdAndUpdate(
      id,
      { phoneNumber, email, otp, method, otpType, expiresAt },
      { new: true }
    );

    if (!updatedOtp) {
      return res.status(404).json({ message: 'OTP record not found' });
    }

    return res.json(updatedOtp);
  } catch (error) {
    console.error('Error updating OTP:', error);
    return res.status(500).json({ message: 'Failed to update OTP record' });
  }
};

/**
 * Delete an OTP record by ID
 */
export const deleteOtp = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedOtp = await UserOtpModel.findByIdAndDelete(id);
    if (!deletedOtp) {
      return res.status(404).json({ message: 'OTP record not found' });
    }

    return res.json({ message: 'OTP record deleted successfully' });
  } catch (error) {
    console.error('Error deleting OTP:', error);
    return res.status(500).json({ message: 'Failed to delete OTP record' });
  }
};
