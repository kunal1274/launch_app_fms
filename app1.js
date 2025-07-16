import express from "express";
import session from "express-session";
import passport from "passport";
import helmet from "helmet";
import xss from "xss-clean";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import mongoSanitize from "express-mongo-sanitize";
import cors from "cors";
import morgan from "morgan";

import { recordApiFlow } from "./middleware/recordApiFlow.js";
import ledgerAccountRouter from "./routes/account.routes.js";

const createApp = () => {
  console.log("start");
  const app = express();

  // 1) Flight-recorder middleware (skipped in test env)
  if (process.env.NODE_ENV !== "test") app.use(recordApiFlow);

  // 2) Core middleware
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(
    session({
      secret: process.env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
    })
  );
  app.use(passport.initialize());
  app.use(passport.session());
  app.use(helmet());
  app.use(xss());
  app.use(mongoSanitize());
  app.use(hpp());
  app.use(rateLimit({ windowMs: 30 * 60 * 1000, max: 100 }));
  app.use(cors());
  app.use(morgan("combined"));

  // 3) Your API routes
  app.use("/fms/api/v0/accounts", ledgerAccountRouter);
  // … mount the rest exactly as you had in index.js …

  // 4) 404 / global error handlers
  app.use((req, res) =>
    res.status(404).json({ status: "failure", message: "Not found" })
  );
  app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ status: "failure", message: err.message });
  });

  return app;
};

export default createApp;
