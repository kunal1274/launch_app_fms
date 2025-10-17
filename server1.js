// index.js
import dotenv from "dotenv";
dotenv.config();

import createApp from "./app1.js";
import connectToDb from "./database/mongoDb.js";

const PORT = process.env.PORT || 3000;

async function startServer() {
  try {
    await connectToDb(); // real Mongo Atlas
    console.log("✅ Connected to MongoDB");
    const app = createApp();
    app.listen(PORT, () => console.log(`🚀 Listening on ${PORT}`));
  } catch (err) {
    console.error("❌ Server startup failed:", err);
    process.exit(1);
  }
}

startServer();
