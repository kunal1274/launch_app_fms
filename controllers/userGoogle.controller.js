// controllers/authController.js

// controllers/authController.js (or user.1_0_0.controller.js)
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { UserGoogleModel } from '../models/userGoogle.model.js';
import { UserGlobalModel } from '../models/userGlobal.model.js';
import createGlobalPartyId from '../shared_service/utility/createGlobalParty.utility.js';

dotenv.config();

export const googleAuthCallback = (req, res) => {
  // `req.user` is the user object from passport deserialize
  if (!req.user) {
    return res.redirect(
      `${process.env.FRONTEND_URL}/auth/google/callback?error=NoUser`
    );
  }
  // Generate JWT
  const payload = {
    googleId: req.user.googleId,
    email: req.user.email,
  };
  //const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "1h" });
  const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '5m' });

  // Redirect to frontend with token as a query param
  const redirectUrl = `${
    process.env.FRONTEND_URL
  }/auth/google/callback?token=${token}&email=${encodeURIComponent(
    req.user.email
  )}`;
  res.redirect(redirectUrl);
};

// outdated version recorded on 15th Apr 2025 by kunal bangalore kengeri
export const googleAuthCallback_V1 = (req, res) => {
  // Successful authentication – you can redirect to your dashboard or send a JSON response.
  console.log('Successful google login is done for user', req.user);
  res.redirect(`${process.env.FRONTEND_URL}/auth/google/callback`); // Change this route as needed.
};

export const googleAuthFailure = (req, res) => {
  res.status(401).json({ message: 'Google authentication failed' });
};

// BASIC CRUD ( OPTIONAL )
/**
 * Create a new Google user record
 * and auto-create a record in UserGlobal with signInMethod = "gmail" & method = "email".
 */
export const createGoogleUser = async (req, res) => {
  try {
    const {
      googleId,
      displayName,
      firstName,
      lastName,
      email,
      image,
      globalPartyId,
    } = req.body;

    if (!googleId || !email || !displayName) {
      return res
        .status(400)
        .json({ message: 'googleId, email, and displayName are required' });
    }

    // 1) Create the Google user record
    const newGoogleUser = new UserGoogleModel({
      googleId,
      displayName,
      firstName,
      lastName,
      email,
      image,
    });
    const savedGoogleUser = await newGoogleUser.save();

    // Additional checks, e.g. password, etc.
    const partyId = await createGlobalPartyId(
      'User',
      globalPartyId,
      displayName
    );

    // 2) Also create a record in UserGlobal
    //    We can do a minimal record: we only know their email, so we set method & signInMethod as requested
    const newGlobalUser = new UserGlobalModel({
      email,
      password: '', // might be empty since they're using google
      name: displayName, // or combine firstName + lastName
      method: 'email', // from your requirement
      signInMethod: 'gmail', // from your requirement
      globalPartyId: partyId,
    });
    const savedGlobalUser = await newGlobalUser.save();

    // Return both records or just the Google user
    return res.status(201).json({
      message: 'Google user created and synced with UserGlobal',
      googleUser: savedGoogleUser,
      globalUser: savedGlobalUser,
    });
  } catch (error) {
    console.error('Error creating Google user:', error);
    return res.status(500).json({ message: 'Failed to create Google user' });
  }
};

/**
 * Get all Google users
 */
export const getAllGoogleUsers = async (req, res) => {
  try {
    const googleUsers = await UserGoogleModel.find();
    return res.json(googleUsers);
  } catch (error) {
    console.error('Error fetching Google users:', error);
    return res.status(500).json({ message: 'Failed to fetch Google users' });
  }
};

/**
 * Get a single Google user by ID
 */
export const getGoogleUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const googleUser = await UserGoogleModel.findById(id);
    if (!googleUser) {
      return res.status(404).json({ message: 'Google user not found' });
    }
    return res.json(googleUser);
  } catch (error) {
    console.error('Error fetching Google user by ID:', error);
    return res.status(500).json({ message: 'Failed to fetch Google user' });
  }
};

/**
 * Update a Google user by ID
 */
export const updateGoogleUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { googleId, displayName, firstName, lastName, email, image } =
      req.body;

    const updatedUser = await UserGoogleModel.findByIdAndUpdate(
      id,
      { googleId, displayName, firstName, lastName, email, image },
      { new: true }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'Google user not found' });
    }

    return res.json(updatedUser);
  } catch (error) {
    console.error('Error updating Google user:', error);
    return res.status(500).json({ message: 'Failed to update Google user' });
  }
};

/**
 * Delete a Google user by ID
 *
 * Optionally, you might also want to remove or mark the corresponding user in UserGlobal.
 */
export const deleteGoogleUser = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedUser = await UserGoogleModel.findByIdAndDelete(id);
    if (!deletedUser) {
      return res.status(404).json({ message: 'Google user not found' });
    }

    // Optionally, also remove or update the matching record in UserGlobal
    // e.g.:
    // await UserGlobalModel.findOneAndDelete({ email: deletedUser.email });

    return res.json({ message: 'Google user deleted successfully' });
  } catch (error) {
    console.error('Error deleting Google user:', error);
    return res.status(500).json({ message: 'Failed to delete Google user' });
  }
};
