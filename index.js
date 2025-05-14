import dotenv from "dotenv";
dotenv.config(); // Loads .env into process.env
import fs from "fs";
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
import connectToDb from "./database/mongoDb.js";
import userGroupRouter from "./routes/userGroupRoutes.js";
import userRouter from "./routes/userRoutes.js";
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
import salesOrderRoutes from "./bb3_sales_management_service/routes/bb3SalesOrder.routes.js";
import aiRoutes from "./chatgpt_ai_service/routes/ai.routes.js";
import siteRoutes from "./bb1_inventory_management_service/routes/bb1.site.routes.js";
import multer from "multer";
import { genericUploadRouter } from "./shared_service/routes/genericUpload.routes.js";
import { uploadMulter } from "./middleware/uploadMulterConfig.js";
import { SalesOrderModel } from "./bb3_sales_management_service/models/bb3SalesOrder.model.js";
import { fileRouter } from "./shared_service/routes/fileUploadViaMulter.routes.js";
import { siteRouter } from "./routes/sites.routes.js";
import printRoutes from "./routes/print.routes.js";
import whRouter from "./routes/warehouse.routes.js";
import zoneRouter from "./routes/zone.routes.js";
import locationRouter from "./routes/location.routes.js";
import rackRouter from "./routes/rack.routes.js";
import shelfRouter from "./routes/shelf.routes.js";
import binRouter from "./routes/bin.routes.js";
import configRouter from "./routes/productDimConfig.routes.js";
import colorRouter from "./routes/productDimColor.routes.js";
import sizeRouter from "./routes/productDimSize.routes.js";
import styleRouter from "./routes/productDimStyle.routes.js";
import versionRouter from "./routes/productDimVersion.routes.js";

// import { queueRedis } from "./batch_jobs/queue/queueRedisClient.js";
// import { shutdownQueues } from "./batch_jobs/queue/gracefulShutdown.js";
// import { sendOtp } from "./controllers/userOtp.controller.js";
// import { verifyOtp } from "./controllers/userOtp.controller.js";
// import { authenticateJWT } from "./middleware/authJwtHandler.js";
// import { UserGlobalModel } from "./models/userGlobal.model.js";
// import {
//   getFormattedLocalDateTime,
//   getLocalTimeString,
// } from "./utility/getLocalTime.js";

// 1a) Create base "uploads" folder if missing
// const UPLOAD_BASE = path.join(process.cwd(), "uploads");
// if (!fs.existsSync(UPLOAD_BASE)) {
//   fs.mkdirSync(UPLOAD_BASE);
// }

// // 1b) Create the "sales-orders" subfolder
// const SO_UPLOAD_DIR = path.join(UPLOAD_BASE, "sales-orders");
// if (!fs.existsSync(SO_UPLOAD_DIR)) {
//   fs.mkdirSync(SO_UPLOAD_DIR);
// }
// const UPLOAD_BASE = path.join(process.cwd(), "uploads");
// if (!fs.existsSync(UPLOAD_BASE)) fs.mkdirSync(UPLOAD_BASE, { recursive: true });

// // Environment variables
const PORT = process.env.PORT || 3000;

// console.log("This index.js file is working as expected");
dbgServer("Index.js loaded, ENV port=%s", process.env.PORT);

// // Middleware
const AumMrigahApp = expressAumMrigah();

// AFTER your API prefix: serve the static files under the same /bb/api/v3/uploads path
dbgRoutesBB3("Mounting static routs-BB3 router on /uploads");
AumMrigahApp.use(
  "/uploads",
  expressAumMrigah.static(path.join(process.cwd(), "uploads"))
);

AumMrigahApp.use(expressAumMrigah.json());
dbgServer("json() enabled for secure headers");

AumMrigahApp.use(expressAumMrigah.urlencoded({ extended: true }));
dbgServer("urlencoding enabled for secure headers");

// // Express session middleware
AumMrigahApp.use(
  session({
    secret: process.env.SESSION_SECRET || "your_secret_key",
    resave: false,
    saveUninitialized: false,
  })
);
dbgServer("session enabled for secure headers");

// Initialize Passport and restore authentication state from session
AumMrigahApp.use(passport.initialize());
dbgServer("passport initialized ");
AumMrigahApp.use(passport.session());
dbgServer("passport session initialized ");

//// Security middleware
AumMrigahApp.use(helmet()); // Secure HTTP headers
dbgSecurity("Helmet enabled for secure headers");
AumMrigahApp.use(xss()); // Prevent XSS
dbgSecurity("xss enabled for secure headers");
AumMrigahApp.disable("x-powered-by"); // Hide the X-Powered-By header
dbgSecurity("x-powered-by enabled for secure headers");
AumMrigahApp.use(ExpressMongoSanitize());
dbgSecurity("Mongo Sanitize enabled for secure headers");
AumMrigahApp.use(hpp());
dbgSecurity("hpp enabled for secure headers");

// Rate Limiter
const limiter = rateLimit({
  windowMs: 30 * 60 * 1000,
  max: 100,
  message: "Too many requests from this IP. Please try again later.",
});
//AumMrigahApp.use("/fms/api", limiter); // specific to router
AumMrigahApp.use(limiter); // to everything
dbgServer("limiter initialized ");

const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(",").map((ele) => {
      return ele.trim();
    })
  : [];

// console.log("Allowed Origins", process.env.ALLOWED_ORIGINS);
dbgServer("Allowed Origins: %O", allowedOrigins);

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
dbgServer("cors control initialized ");

AumMrigahApp.use(requestTimer); // 💥 log for all routes
dbgMW("middleware requqest timer initialized ");

// we are using after the request processed through json and cors
// Define a stream for morgan to use Winston
const stream = {
  write: (message) => logger.http(message.trim()),
};

AumMrigahApp.use(morgan("combined", { stream }));
dbgServer("morgan logging initialized ");

// Serve everything under /uploads from the local uploads/ folder:
// AumMrigahApp.use("/uploads", express.static(path.join(__dirname, "uploads")));

// Routes
dbgRoutes("Mounting default router on /");
AumMrigahApp.get("/", (req, res) => {
  res.send(`Hello from Express on Render at Port number ${PORT}!`);
});

// AumMrigahApp.post("/fms/api/v0/otp-auth/send-otp", sendOtp);
// AumMrigahApp.post("/fms/api/v0/otp-auth/verify-otp", verifyOtp);
// // Validate token route
// AumMrigahApp.post(
//   "/fms/api/v0/otp-auth/me",
//   authenticateJWT,
//   async (req, res) => {
//     // If token is valid, req.user is set by the authenticateJWT middleware
//     // Return user info or a success message
//     const existingUserGlobal = await UserGlobalModel.findOne({
//       email: req?.user?.email,
//     });
//     res.status(200).json({
//       msg: `✅ Token is valid recorded at 🕒 local time ${getLocalTimeString()} and in detailed 📅 ${getFormattedLocalDateTime()}`,
//       user: req.user,
//       userGlobal: existingUserGlobal,
//     });
//   }
// );

// // Main Functional Modules
dbgRoutes("Mounting userRouter router on /fms/api/v0/users");
AumMrigahApp.use("/fms/api/v0/users", userRouter);
dbgRoutes("Mounting userGroupRouter router on /fms/api/v0/userGroups");
AumMrigahApp.use("/fms/api/v0/userGroups", userGroupRouter);
dbgRoutes("Mounting customerRouter router on /fms/api/v0/customers");
AumMrigahApp.use("/fms/api/v0/customers", customerRouter);
dbgRoutes("Mounting vendorRouter router on /fms/api/v0/vendors");
AumMrigahApp.use("/fms/api/v0/vendors", vendorRouter);
dbgRoutes("Mounting itemRouter router on /fms/api/v0/items");
AumMrigahApp.use("/fms/api/v0/items", itemRouter);
dbgRoutes("Mounting companyRouter router on /fms/api/v0/companies");
AumMrigahApp.use("/fms/api/v0/companies", companyRouter);

// Sales and AR Module
dbgRoutes("Mounting salesOrderRouter router on /fms/api/v0/salesorders");
AumMrigahApp.use("/fms/api/v0/salesorders", salesOrderRouter);

// Procurement Module and AP module
dbgRoutes("Mounting purchaseOrderRouter router on /fms/api/v0/purchaseorders");
AumMrigahApp.use("/fms/api/v0/purchaseorders", purchaseOrderRouter);

// Inventory Management Module
// --- Storage Dimensions -----//
dbgRoutes("Mounting sites router on /fms/api/v0/sites");
AumMrigahApp.use("/fms/api/v0/sites", siteRouter);
dbgRoutes("Mounting warehouse router on /fms/api/v0/warehouses");
AumMrigahApp.use("/fms/api/v0/warehouses", whRouter);
dbgRoutes("Mounting zone router on /fms/api/v0/zones");
AumMrigahApp.use("/fms/api/v0/zones", zoneRouter);
dbgRoutes("Mounting location router on /fms/api/v0/locations");
AumMrigahApp.use("/fms/api/v0/locations", locationRouter);
dbgRoutes("Mounting rack router on /fms/api/v0/racks");
AumMrigahApp.use("/fms/api/v0/racks", rackRouter);
dbgRoutes("Mounting shelf router on /fms/api/v0/shelves");
AumMrigahApp.use("/fms/api/v0/shelves", shelfRouter);
dbgRoutes("Mounting bin router on /fms/api/v0/bins");
AumMrigahApp.use("/fms/api/v0/bins", binRouter);

// --- Product Dimensions -----//
dbgRoutes("Mounting sites router on /fms/api/v0/configurations");
AumMrigahApp.use("/fms/api/v0/configurations", configRouter);
dbgRoutes("Mounting color router on /fms/api/v0/colors");
AumMrigahApp.use("/fms/api/v0/colors", colorRouter);
dbgRoutes("Mounting size router on /fms/api/v0/sizes");
AumMrigahApp.use("/fms/api/v0/sizes", sizeRouter);
dbgRoutes("Mounting style router on /fms/api/v0/styles");
AumMrigahApp.use("/fms/api/v0/styles", styleRouter);
dbgRoutes("Mounting version router on /fms/api/v0/versions");
AumMrigahApp.use("/fms/api/v0/versions", versionRouter);

// Sales Management Service -bb3
dbgRoutesBB3(
  "Mounting sale order Routes-BB3 router on /bb/api/v3/sales-orders"
);
AumMrigahApp.use("/fms/api/v0/sales-orders", salesOrderRoutes);
// AumMrigahApp.use("/fms/api/v0/sales-orders", printRoutes);

// dbgRoutesBB3("Mounting upload-BB3 router on /bb/api/v3/upload");
// AumMrigahApp.use("/bb/api/v3/upload", genericUploadRouter);

AumMrigahApp.use("/fms/api/v0/sales-orders", fileRouter);
// 7a) Upload endpoint
// AumMrigahApp.post(
//   "/api/v0/sales-orders/:id/files-upload",
//   uploadMulter.array("files"),
//   async (req, res) => {
//     const soId = req.params.id;
//     // Build an array of metadata objects
//     const metas = req.files.map((f) => ({
//       fileName: f.filename,
//       originalName: f.originalname,
//       fileType: f.mimetype,
//       fileUrl: `/uploads/${f.filename}`,
//       uploadedAt: new Date(),
//     }));
//     console.log("metas", metas);
//     // Push all at once using $each
//     const updated = await SalesOrderModel.findByIdAndUpdate(
//       soId,
//       { $push: { files: { $each: metas } } },
//       { new: true }
//     ).select("files");
//     console.log("updated", updated);
//     return res.json(updated.files);
//   }
// );

// // 7b) List files
// AumMrigahApp.get("/api/v0/sales-orders/:id/files-upload", async (req, res) => {
//   const so = await SalesOrderModel.findById(req.params.id).select("files");
//   if (!so) return res.status(404).send("Sales order not found");
//   res.json(so.files);
// });

// // 7c) Delete file

// AumMrigahApp.delete(
//   "/api/v0/sales-orders/:id/files-upload/:fileId",
//   async (req, res) => {
//     const { id: soId, fileId } = req.params;

//     // Load the sales order document
//     const so = await SalesOrderModel.findById(soId);
//     if (!so) return res.status(404).send("Sales order not found");

//     // Find the subdoc
//     const fileDoc = so.files.id(fileId);
//     if (!fileDoc) return res.status(404).send("File not found");

//     // Remove the physical file
//     fs.unlinkSync(path.join(process.cwd(), "uploads", fileDoc.fileName));

//     // Remove subdoc from the array
//     fileDoc.remove(); // MongooseDocumentArray#id().remove()
//     await so.save(); // Persist the change

//     return res.json(so.files);
//   }
// );

// AumMrigahApp.delete(
//   "/api/v1/sales-orders/:id/files-upload/:fileId",
//   async (req, res) => {
//     const { id: soId, fileId } = req.params;

//     // 1) Fetch the sales order (so we know the filename to delete)
//     const order = await SalesOrderModel.findById(soId).select("files");
//     if (!order)
//       return res.status(404).json({ message: "Sales order not found" });

//     // 2) Find the file sub-doc in the array
//     const fileEntry = order.files.find((f) => f._id.toString() === fileId);
//     if (!fileEntry) return res.status(404).json({ message: "File not found" });

//     // 3) Delete the physical file
//     fs.unlinkSync(path.join(process.cwd(), "uploads", fileEntry.filename));

//     // 4) Pull the sub-doc out of the array
//     const updated = await SalesOrderModel.findByIdAndUpdate(
//       soId,
//       { $pull: { files: { _id: fileId } } },
//       { new: true, select: "files" }
//     );

//     // 5) Return the new files array
//     return res.json(updated.files);
//   }
// );

// // Inventory Management Service -bb1
dbgRoutesBB1("Mounting siteRoutes-BB1 router on /bb/api/v1/sites");
AumMrigahApp.use("/bb/api/v1/sites", siteRoutes);

// // Chatgpt ai service - bb3
dbgRoutesBB3("Mounting aiRoutes-BB3 router on /bb/api/v3/ai");
AumMrigahApp.use("/bb/api/v3/ai", aiRoutes);

//Authentication
dbgRoutes(
  "Mounting Google Authentication routers router on /auth and /api/auth and /fms/api/v0/otp-auth"
);
AumMrigahApp.use("/auth", googleAuthRouter);
AumMrigahApp.use("/api/auth", googleAlternativeApiAuthRouter);
AumMrigahApp.use("/fms/api/v0/otp-auth", otpAuthRouter);

// Authorization
dbgRoutes(
  "Mounting Authorization router on /fms/api/v0/user-globals or permissions or user-roles"
);
AumMrigahApp.use("/fms/api/v0/user-globals", userGlobalRouter);
AumMrigahApp.use("/fms/api/v0/permissions", permissionRouter);
AumMrigahApp.use("/fms/api/v0/user-roles", userRoleRouter);

// bull batch jobs helper ..
/* ─────────────────────────────────────────────────────────
 *  Health endpoints – quick check that Redis & queue work
 * ───────────────────────────────────────────────────────── */
// AumMrigahApp.get("/health/queue", async (req, res) => {
//   const redisStatus = await queueRedis.ping(); // "PONG"
//   const waiting = await logQueue.queue.getWaitingCount();
//   res.json({ redis: redisStatus, logJobsWaiting: waiting });
// });

// AumMrigahApp.post("/health/queue", async (req, res) => {
//   const job = await logQueue.add({ when: new Date().toISOString() });
//   res.json({ queued: job.id });
// });

/// environment check
dbgRoutes("Mounting env router on /env");
AumMrigahApp.get("/env", (req, res) => {
  res.json({ allowedOrigins });
});

// Error handler for Multer
AumMrigahApp.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    let message = err.message;
    if (err.code === "LIMIT_FILE_SIZE") {
      message = "File too large (max 30 MB).";
    } else if (err.code === "LIMIT_UNEXPECTED_FILE") {
      message = "Unexpected field: " + err.field;
    }
    return res
      .status(400)
      .json({ status: "failure in multer uploading index.js", message });
  }
  // non‐Multer errors:
  next(err);
});

//Global error handler (optional but recommended)
dbgRoutes("Mounting global error handler on ");
AumMrigahApp.use((err, req, res, next) => {
  logger.error("Global Error Handler", { error: err });
  res.status(500).send({
    status: "failure",
    message: "An unexpected error occurred from the Backend for launch-app-fms",
  });
});

// final route
dbgRoutes("Mounting final route  on /* not found rout");
AumMrigahApp.use((req, res) => {
  res
    .status(400)
    .send(
      `This is final and invalid path coming from node js backend launch-app-fms`
    );
});

const startServer = async () => {
  try {
    dbgDB("🔹Connecting to MongoDB at", process.env.ATLAS_URI);
    await connectToDb();
    dbgDB("✅ MongoDB connection established");
    AumMrigahApp.listen(PORT, () => {
      console.log(
        `The Node Launch FMS backend server 1.0.0 has been now running at ${PORT} with the cloud Mongo db`
      );
      dbgServer("🚀 Server listening on port ", PORT);
    });
  } catch (error) {
    console.error(`Server is unable to start due to some error : ${error}`);
    dbgDB("❌ DB connection failed: ", error);
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

// graceful shutdown (SIGINT / SIGTERM)
// process.on("SIGINT", async () => {
//   await shutdownQueues();
//   process.exit(0);
// });
// process.on("SIGTERM", async () => {
//   await shutdownQueues();
//   process.exit(0);
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

/* ───────────────────────────────────────────────────────── */
