import dotenv from "dotenv";
dotenv.config(); // Loads .env into process.env

// import createDebug from "debug";
// // pick any namespace convention you like:
// const dbgServer = createDebug("fms:server");
// const dbgDB = createDebug("fms:db");
// const dbgSecurity = createDebug("fms:security");
// const dbgRoutes = createDebug("fms:routes");
// const dbgEmail = createDebug("fms:email");
// const dbgException = createDebug("fms:exception");

// In-built Node JS Modules Import
import expressAumMrigah from "express";

// 3rd-Party Node JS Modules Import
import cors from "cors"; // new2
import morgan from "morgan";
import helmet from "helmet";
import xss from "xss-clean";
import rateLimit from "express-rate-limit";
import hpp from "hpp";
import ExpressMongoSanitize from "express-mongo-sanitize";
import session from "express-session";
import passport from "passport";

// Project FMS server related imports
import userGroupRouter from "./routes/userGroupRoutes.js";
import userRouter from "./routes/userRoutes.js";
import connectToDb from "./database/mongoDb.js";
import { companyRouter } from "./routes/company.routes.js";
import { customerRouter } from "./routes/customer.routes.js";
import { itemRouter } from "./routes/item.routes.js";
import { salesOrderRouter } from "./routes/salesorder.routes.js";
import { vendorRouter } from "./routes/vendor.routes.js";
import { purchaseOrderRouter } from "./routes/purchaseorder.routes.js";
import logger from "./utility/logger.util.js";
import { requestTimer } from "./middleware/requestTimer.js";
import googleAuthRouter from "./routes/google-auth.routes.js";
import otpAuthRouter from "./routes/otp-auth.routes.js";
import googleAlternativeApiAuthRouter from "./routes/api-auth.routes.js";
import userGlobalRouter from "./routes/userGlobal.routes.js";
import permissionRouter from "./role_based_access_control_service/routes/permission.routes.js";
import userRoleRouter from "./role_based_access_control_service/routes/userRole.routes.js";
// import salesOrderRoutes from "./bb3_sales_management_service/routes/bb3SalesOrder.routes.js";
import aiRoutes from "./chatgpt_ai_service/routes/ai.routes.js";
import siteRoutes from "./bb1_inventory_management_service/routes/bb1.site.routes.js";

// Environment variables
const PORT = process.env.PORT || 3000;

console.log("This index.js file is working as expected");
// dbgServer("Index.js loaded, ENV port=%s", process.env.PORT);

// Middleware
const AumMrigahApp = expressAumMrigah();

AumMrigahApp.use(expressAumMrigah.json());

AumMrigahApp.use(expressAumMrigah.urlencoded({ extended: true }));

// Express session middleware
AumMrigahApp.use(
  session({
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);

// Initialize Passport and restore authentication state from session
AumMrigahApp.use(passport.initialize());
AumMrigahApp.use(passport.session());

//// Security middleware
AumMrigahApp.use(helmet()); // Secure HTTP headers
AumMrigahApp.use(xss()); // Prevent XSS
AumMrigahApp.disable("x-powered-by"); // Hide the X-Powered-By header
AumMrigahApp.use(ExpressMongoSanitize());
AumMrigahApp.use(hpp());

// Rate Limiter
const limiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP. Please try again later.",
});
//AumMrigahApp.use("/fms/api", limiter); // specific to router
AumMrigahApp.use(limiter); // to everything

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((ele) => {
      return ele.trim();
    })
  : [];

console.log("Allowed Origins", process.env.ALLOWED_ORIGINS);
//dbgServer("Allowed Origins: %O", allowedOrigins);

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

AumMrigahApp.use(cors(corsOptions));

AumMrigahApp.use(requestTimer); // 💥 log for all routes

// we are using after the request processed through json and cors
// Define a stream for morgan to use Winston
const stream = {
  write: (message) => logger.http(message.trim()),
};

AumMrigahApp.use(morgan("combined", { stream }));

// Routes
AumMrigahApp.get("/", (req, res) => {
  res.send(`Hello from Express on Render at Port number ${PORT}!`);
});

// Main Functional Modules
AumMrigahApp.use("/fms/api/v0/users", userRouter);
AumMrigahApp.use("/fms/api/v0/userGroups", userGroupRouter);
AumMrigahApp.use("/fms/api/v0/customers", customerRouter);
AumMrigahApp.use("/fms/api/v0/vendors", vendorRouter);
AumMrigahApp.use("/fms/api/v0/items", itemRouter);
AumMrigahApp.use("/fms/api/v0/companies", companyRouter);
AumMrigahApp.use("/fms/api/v0/salesorders", salesOrderRouter);
AumMrigahApp.use("/fms/api/v0/purchaseorders", purchaseOrderRouter);

// Sales Management Service
// AumMrigahApp.use("/fms/api/v0/sales-orders", salesOrderRoutes);

// Inventory Management Service
// AumMrigahApp.use("/fms/api/v0/sites", siteRoutes);

// Chatgpt ai service
AumMrigahApp.use("/fms/api/v0/ai", aiRoutes);

//Authentication
AumMrigahApp.use("/auth", googleAuthRouter);
AumMrigahApp.use("/api/auth", googleAlternativeApiAuthRouter);
AumMrigahApp.use("/fms/api/v0/otp-auth", otpAuthRouter);

// Authorization
AumMrigahApp.use("/fms/api/v0/user-globals", userGlobalRouter);
AumMrigahApp.use("/fms/api/v0/permissions", permissionRouter);
AumMrigahApp.use("/fms/api/v0/user-roles", userRoleRouter);

AumMrigahApp.get("/env", (req, res) => {
  res.json({ allowedOrigins });
});

//Global error handler (optional but recommended)
AumMrigahApp.use((err, req, res, next) => {
  logger.error("Global Error Handler", { error: err });
  res.status(500).send({
    status: "failure",
    message: "An unexpected error occurred from the Backend for launch-app-fms",
  });
});

// final route
AumMrigahApp.use((req, res) => {
  res
    .status(400)
    .send(
      `This is final and invalid path coming from node js backend launch-app-fms`
    );
});

const startServer = async () => {
  try {
    //dbgDB("Connecting to MongoDB at", process.env.ATLAS_URI);
    await connectToDb();
    //dbgDB("✅ MongoDB connection established");
    AumMrigahApp.listen(PORT, () => {
      console.log(
        `The Node Launch FMS backend server 1.0.0 has been now running at ${PORT} with the cloud Mongo db`
      );
      // dbgServer("🚀 Server listening on port ", PORT);
    });
  } catch (error) {
    console.error(`Server is unable to start due to some error : ${error}`);
    //dbgDB("❌ DB connection failed: ", error);
    process.exit(1);
  }
};

startServer();

// process.on("uncaughtException", (err) => {
//   console.error("🛑 Uncaught Exception:", err.message);
//   console.error(err.stack);
//   ///dbgException("❌ DB connection failed: %O", err);
// });

// process.on("unhandledRejection", (reason, promise) => {
//   console.error("🛑 Unhandled Rejection at:", promise);
//   console.error("Reason:", reason);
//   //dbgException("❌ DB connection failed: %O", promise);
// });

process.on("uncaughtException", (err) => {
  logger.error("🛑 Uncaught Exception", {
    message: err.message,
    stack: err.stack,
  });
  process.exit(1);
});

process.on("unhandledRejection", (reason) => {
  logger.error("🛑 Unhandled Rejection", {
    message: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack : undefined,
  });
  process.exit(1);
});
