import dotenv from "dotenv";
dotenv.config(); // Loads .env into process.env

import path from "path";

import createDebug from "debug";
// pick any namespace convention you like:
export const dbgServer = createDebug("fms:server");
export const dbgDB = createDebug("fms:db");
export const dbgMW = createDebug("fms:mw");
export const dbgSecurity = createDebug("fms:security");
export const dbgRoutes = createDebug("fms:routes"); // initial
export const dbgRoutesBB1 = createDebug("fms:routes-bb1");
export const dbgRoutesBB2 = createDebug("fms:routes-bb2");
export const dbgRoutesBB3 = createDebug("fms:routes-bb3");
export const dbgEmail = createDebug("fms:email");
export const dbgRedis = createDebug("fms:redis");
export const dbgModels = createDebug("fms:models");
export const dbgControllers = createDebug("fms:controllers");
export const dbgException = createDebug("fms:exception");

// 3rd-Party Node JS Modules Import
import express from "express";
import cors from "cors";
import morgan from "morgan";
import helmet from "helmet";
import xss from "xss-clean";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import ExpressMongoSanitize from "express-mongo-sanitize";
import session from "express-session";
import passport from "passport";

// Local files
import { recordApiFlow } from "./middleware/recordApiFlow.js";
import bb0_ledgerAccountRouter from "./bb0/am_svc/routes/bb0.account.routes.js";
import { requestTimer } from "./middleware/requestTimer.js";
import logger from "./bb0/shm_svc/utility/bb0.logger.util.js";

// import { siteRouter } from "./routes/sites.routes.js";
// import { customerRouter } from "./routes/customer.routes.js";

const createTestOrientedApp = () => {
  const PORT = process.env.PORT || 3000;

  const app = express();

  if (process.env.NODE_ENV !== "test") app.use(recordApiFlow); // Skip during tests

  app.use("/uploads", express.static(path.join(process.cwd(), "uploads")));
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
  app.disable("x-powered-by"); // Hide the X-Powered-By header
  app.use(ExpressMongoSanitize());
  app.use(hpp());

  const limiter = rateLimit({
    windowMs: 30 * 60 * 1000,
    max: 100,
    message: "Too many requests from this IP. Please try again later.",
  });
  //AumMrigahApp.use("/fms/api", limiter); // specific to router
  app.use(limiter); // to everything

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(",").map((ele) => {
        return ele.trim();
      })
    : [];

  // console.log("Allowed Origins", process.env.ALLOWED_ORIGINS);
  // dbgServer("Allowed Origins: %O", allowedOrigins);

  const corsOptions = {
    origin: (origin, callback) => {
      // Allow requests with no origin (for Postman, mobile apps)
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
    credentials: true, // Allow cookies
  };

  app.use(cors(corsOptions));

  app.use(requestTimer); // 💥 log for all routes

  // we are using after the request processed through json and cors
  // Define a stream for morgan to use Winston
  const stream = {
    write: (message) => logger.http(message.trim()),
  };

  app.use(morgan("combined", { stream }));

  app.get("/", (req, res) => {
    res.send(`Hello from Express on Render at Port number ${PORT}!`);
  });

  app.use("/bb0/api/v0/accounts", bb0_ledgerAccountRouter);

  // dbgRoutes("Mounting sites router on /fms/api/v0/sites");
  // app.use("/fms/api/v0/customers", customerRouter);

  return app;
};

export default createTestOrientedApp;
