// config/passport.js
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import dotenv from 'dotenv';
import { UserGoogleModel } from '../models/userGoogle.model.js';
import { UserGlobalModel } from '../models/userGlobal.model.js';
import createGlobalPartyId from '../shared_service/utility/createGlobalParty.utility.js';

dotenv.config();

// Configure the Google OAuth strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Try to find an existing user by Google ID
        let user = await UserGoogleModel.findOne({ googleId: profile.id });
        let userGlobal = null;
        // let userGlobal = await UserGlobalModel.findOne({
        //   email: profile.emails[0].value,
        // });

        if (!user) {
          // If no user exists, create a new one using data from Google profile
          user = await UserGoogleModel.create({
            googleId: profile.id,
            displayName: profile.displayName,
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            email: profile.emails[0].value,
            image: profile.photos[0].value,
          });
        }

        userGlobal = await UserGlobalModel.findOne({
          email: user.email,
        });

        if (userGlobal && !userGlobal.globalPartyId) {
          const partyIdForExistingRecord = await createGlobalPartyId(
            'User',
            null,
            user.email
          );
          userGlobal.globalPartyId = partyIdForExistingRecord;
          await userGlobal.save();
        }

        if (!userGlobal) {
          const partyIdNew = await createGlobalPartyId(
            'User',
            null,
            user.email
          );
          await UserGlobalModel.create({
            email: profile.emails[0].value,
            method: 'email',
            signInMethod: 'gmail',
            globalPartyId: partyIdNew,
          });
        }
        return done(null, user);
      } catch (error) {
        return done(error, null);
      }
    }
  )
);

// Serialize user ID to store in the session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize the user from the session by ID
passport.deserializeUser(async (id, done) => {
  try {
    const user = await UserGoogleModel.findById(id);
    done(null, user);
  } catch (error) {
    done(error, null);
  }
});

export default passport;
