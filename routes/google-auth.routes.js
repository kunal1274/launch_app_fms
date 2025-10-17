// routes/google-auth.routes.js
import express from "express";
import passport from "../config/passport.js";
import {
  googleAuthCallback,
  googleAuthFailure,
  // basic crud
  createGoogleUser,
  getAllGoogleUsers,
  getGoogleUserById,
  updateGoogleUser,
  deleteGoogleUser,
} from "../controllers/userGoogle.controller.js";

const googleAuthRouter = express.Router();

// Route to start Google authentication. Request profile and email scopes.
googleAuthRouter.get(
  "/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

// Callback route that Google will redirect to after authentication.
googleAuthRouter.get(
  "/google/callback",
  passport.authenticate("google", {
    failureRedirect: "/auth/google/failure",
  }),
  googleAuthCallback
);

// Failure route
googleAuthRouter.get("/google/failure", googleAuthFailure);

// Basic CRUD
// Create Google user & auto-create a record in UserGlobal
googleAuthRouter.post("/", createGoogleUser);
googleAuthRouter.get("/", getAllGoogleUsers);
googleAuthRouter.get("/:id", getGoogleUserById);
googleAuthRouter.patch("/:id", updateGoogleUser);
googleAuthRouter.delete("/:id", deleteGoogleUser);

export default googleAuthRouter;
