import dotenv from 'dotenv';
dotenv.config(); // Loads .env into process.env

// Project FMS server related imports
import connectToDb from './database/mongoDb.js';
import createTestOrientedApp from './app.js';

// // Environment variables
const PORT = process.env.PORT || 3000;

const startServer = async () => {
  try {
    await connectToDb();

    const appNodeServer = createTestOrientedApp();
    appNodeServer.listen(PORT, () => {
      console.log(
        `The Node Launch FMS backend server bb0 v1.0.0 has been now running at ${PORT} with the cloud Mongo db`
      );
    });
  } catch (error) {
    console.error(`Server is unable to start due to some error : ${error}`);

    process.exit(1);
  }
};
console.log('before start');
startServer();
