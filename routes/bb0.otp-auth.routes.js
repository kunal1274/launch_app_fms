// routes/authRoutes.js
import express from 'express';

import { authenticateJWT } from '../middleware/authJwtHandler.js';
import { UserGlobalModel } from '../models/userGlobal.model.js';
import {
  getLocalTimeString,
  getFormattedLocalDateTime,
} from '../utility/getLocalTime.js';
// BB functionality - commented out
// import {
//   createOtp,
//   deleteOtp,
//   getAllOtps,
//   getOtpById,
//   sendOtp,
//   updateOtp,
//   verifyOtp,
// } from '../controllers/bb0.userOtp.controller.js';

const otpAuthRouter = express.Router();

// BB functionality - commented out
// Route to send OTP
// otpAuthRouter.post('/send-otp', sendOtp);

// Route to verify OTP
// otpAuthRouter.post('/verify-otp', verifyOtp);

// Validate token route
otpAuthRouter.post('/me', authenticateJWT, async (req, res) => {
  // If token is valid, req.user is set by the authenticateJWT middleware
  // Return user info or a success message
  const existingUserGlobal = await UserGlobalModel.findOne({
    email: req?.user?.email,
  });
  res.status(200).json({
    msg: `✅ Token is valid recorded at 🕒 local time ${getLocalTimeString()} and in detailed 📅 ${getFormattedLocalDateTime()}`,
    user: req.user,
    userGlobal: existingUserGlobal,
  });
});

// BB functionality - commented out
// BASIC CRUD
// otpAuthRouter.post('/', createOtp);
// otpAuthRouter.get('/', getAllOtps);
// otpAuthRouter.get('/:id', getOtpById);
// otpAuthRouter.patch('/:id', updateOtp);
// otpAuthRouter.delete('/:id', deleteOtp);

export default otpAuthRouter;
