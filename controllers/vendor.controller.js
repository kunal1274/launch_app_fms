import mongoose from "mongoose";
import { VendorModel } from "../models/vendor.model.js";
import { VendorCounterModel } from "../models/counter.model.js";
import ce from "../utility/ce.utils.js";
import cl from "../utility/cl.utils.js";

// Helper function for error logging
const logError = (context, error) => {
  console.error(`[${new Date().toISOString()}] ${context} - Error:`, {
    message: error.message || error,
    stack: error.stack,
  });
};

export const createVendor = async (req, res) => {
  const vendorBody = req.body;
  try {
    // Validate input data
    if (!vendorBody.name || !vendorBody.contactNum) {
      // Adjust for required fields
      return res.status(422).send({
        status: "failure",
        message: "Vendor name and contact num are required.",
      });
    }

    const dbResponse = await VendorModel.create(vendorBody);

    cl(
      `Vendor created successfully with ID: ${
        dbResponse._id
      } at ${new Date().toISOString()} equivalent to IST ${new Date().toLocaleString(
        "en-US",
        { timeZone: "Asia/Kolkata" }
      )}`
    );

    return res.status(201).send({
      status: "Success",
      message: `The vendor has been created successfully with vendor code : ${
        dbResponse._id
      } at ${new Date().toISOString()} equivalent to IST ${new Date().toLocaleString(
        "en-US",
        { timeZone: "Asia/Kolkata" }
      )}`,
      data: dbResponse,
    });
  } catch (error) {
    //ce(`The error during vendor creation : ${error}`);

    // Database Validation Error
    if (error instanceof mongoose.Error.ValidationError) {
      logError("Vendor Creation - Validation Error", error);
      return res.status(422).send({
        status: "failure",
        message: "Validation error during vendor creation.",
        error: error.message || error,
      });
    }

    // MongoDB Duplicate Key Error (e.g., email uniqueness constraint)
    if (error.code === 11000) {
      logError("Vendor Creation - Duplicate Error", error);
      return res.status(409).send({
        status: "failure",
        message: "A vendor with this contact Num already exists.",
      });
    }

    // Handle MongoDB connection or network issues
    if (error.message.includes("network error")) {
      logError("Vendor Creation - Network Error", error);
      return res.status(503).send({
        status: "failure",
        message: "Service temporarily unavailable. Please try again later.",
      });
    }

    // General Server Error
    logError("Vendor Creation - Unknown Error", error);
    return res.status(500).send({
      status: "failure",
      message: "An unexpected error occurred. Please try again.",
      error: error.message || error,
    });
  }
};

export const getVendors = async (req, res) => {
  try {
    const dbResponse = await VendorModel.find({});
    return res.status(200).send({
      status: "success",
      message: " All the vendors has been fetched successfully",
      count: dbResponse.length,
      data: dbResponse,
    });
  } catch (error) {
    return res.status(400).send({
      status: "failure",
      message: " There is an error while trying to fetch all the custoemrs",
      error: error,
    });
  }
};

export const getVendor = async (req, res) => {
  const { vendorId } = req.params;
  try {
    const dbResponse = await VendorModel.findById(vendorId);
    if (!dbResponse) {
      return res.status(404).send({
        status: "failure",
        message: `The vendor ${vendorId} has been deleted or does not exist `,
      });
    }
    return res.status(200).send({
      status: "success",
      message: `The vendor record ${vendorId} has been fetched successfully.`,
      data: dbResponse,
    });
  } catch (error) {
    ce(`Error fetching vendor with ID ${vendorId}:`, error);
    return res.status(500).send({
      status: "failure",
      message: `The error has been caught while fetching the vendor record `,
      error: error.message || error,
    });
  }
};

export const updateVendor = async (request, response) => {
  const { vendorId } = request.params;
  const vendorBodyToUpdate = request.body;
  try {
    const vendorExists = await VendorModel.findById(vendorId);
    if (!vendorExists) {
      return res.status(404).send({
        status: "failure",
        message: `The vendor ${vendorId} has been deleted or does not exist `,
      });
    }

    const dbResponse = await VendorModel.updateOne(
      { _id: vendorId },
      { $set: vendorBodyToUpdate }
    );
    return response.status(200).send({
      status: "success",
      message: `The vendor ${vendorId} has been updated successfully.`,
      data: dbResponse,
    });
  } catch (error) {
    return response.status(400).send({
      status: "failure",
      message: `There is an error while updating the vendor record ${vendorId}`,
      error: error,
    });
  }
};

export const deleteVendor = async (req, res) => {
  const { vendorId } = req.params;
  try {
    const dbResponse = await VendorModel.findByIdAndDelete(vendorId);
    if (!dbResponse) {
      return res.status(404).send({
        status: "failure",
        message: `No vendor found with id ${vendorId}`,
      });
    }

    return res.status(200).send({
      status: "success",
      message: `The vendor ${vendorId} has been deleted successfully`,
      data: dbResponse,
    });
  } catch (error) {
    return res.status(400).send({
      status: "failure",
      message: `There has been error while deleting the vendor id ${vendorId}`,
      error: error,
    });
  }
};

// Delete all vendors and reset sequence
export const deleteAllVendors = async (req, res) => {
  try {
    // Delete all vendors
    const deleteResponse = await VendorModel.deleteMany({});
    console.log(`Deleted ${deleteResponse.deletedCount} vendors.`);

    // Reset the counter for vendor code

    const resetCounter = await VendorCounterModel.findOneAndUpdate(
      { _id: "vendorCode" },
      { seq: 0 }, // Reset sequence to 0
      { new: true, upsert: true } // Create document if it doesn't exist
    );

    return res.status(200).send({
      status: "success",
      message:
        "All vendors have been deleted, and the sequence has been reset to 1.",
      data: {
        deletedCount: deleteResponse.deletedCount,
        counter: resetCounter,
      },
    });
  } catch (error) {
    console.error(
      "Error while deleting all vendors and resetting sequence:",
      error
    );
    return res.status(500).send({
      status: "failure",
      message: "Error while deleting all vendors or resetting the sequence.",
      error: error.message,
    });
  }
};
