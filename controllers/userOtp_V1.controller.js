// controllers/authController.js
//import twilio from "twilio";
import dotenv from 'dotenv';
dotenv.config();

console.log('EMAIL_USER:', !!process.env.EMAIL_USER);
console.log('EMAIL_PASS:', !!process.env.EMAIL_PASS);

import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import { winstonLogger } from '../utility/logError.utils.js';
import { UserGlobalModel } from '../models/userGlobal.model.js';
import { UserOtpModel } from '../models/userOtp.model.js';
import generateOtp from '../utility/generateOtp.utils.js';
import {
  getFormattedLocalDateTime,
  getLocalTimeString,
} from '../utility/getLocalTime.js';
import createGlobalPartyId from '../shared_service/utility/createGlobalParty.utility.js';

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
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
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
  })
  .catch((err) => {
    dbgEmail('❌ SMTP connection failed:', {
      message: err.message,
      stack: err.stack,
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

dbgEmail('Nodemailer transport created with', transporter);

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
        subject: 'Your OTP Code',
        text: `Your OTP is: ${otp}`,
        html: `<b>Your OTP is: ${otp}</b>`,
      };
      await transporter.sendMail(mailOptions);
      winstonLogger.info('OTP sent via Email', { email });
      return res.status(200).json({
        msg: `✅ OTP sent via email successfully recorded at 🕒 local time ${getLocalTimeString()} and in detailed 📅 ${getFormattedLocalDateTime()}`,
      });
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

      await UserGlobalModel.create({
        email,
        phoneNumber,
        method: email ? 'email' : 'phone',
        signInMethod: 'otp',
        globalPartyId: partyIdNew,
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
