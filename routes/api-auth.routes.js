// src/routes/apiAuthRoutes.js
import express from 'express';

const googleAlternativeApiAuthRouter = express.Router();

// This endpoint returns the authenticated user details.
// It relies on Passport to populate req.user if the user is logged in.
googleAlternativeApiAuthRouter.get('/me', (req, res) => {
  if (req.isAuthenticated && req.isAuthenticated()) {
    // Return the user data (you might want to sanitize it before sending)
    res.status(200).json({ user: req.user });
  } else {
    res.status(401).json({ message: 'Unauthorized' });
  }
});

export default googleAlternativeApiAuthRouter;
