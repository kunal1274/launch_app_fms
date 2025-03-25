import mongoose from "mongoose";
import { CustomerModel } from "../models/customer.model.js";
import { CustomerCounterModel } from "../models/counter.model.js";
import ce from "../utility/ce.utils.js";
import cl from "../utility/cl.utils.js";

// Helper function for error logging
const logError = (context, error) => {
  console.error(`[${new Date().toISOString()}] ${context} - Error:`, {
    message: error.message || error,
    stack: error.stack,
  });
};

export const createCustomer = async (req, res) => {
  const customerBody = req.body;
  try {
    // Validate input data
    if (!customerBody.name || !customerBody.contactNum) {
      // Adjust for required fields
      return res.status(422).send({
        status: "failure",
        message: "Customer name and contact num are required.",
      });
    }

    const dbResponse = await CustomerModel.create(customerBody);

    cl(
      `Customer created successfully with ID: ${
        dbResponse._id
      } at ${new Date().toISOString()} equivalent to IST ${new Date().toLocaleString(
        "en-US",
        { timeZone: "Asia/Kolkata" }
      )}`
    );

    return res.status(201).send({
      status: "Success",
      message: `The customer has been created successfully with customer code : ${
        dbResponse._id
      } at ${new Date().toISOString()} equivalent to IST ${new Date().toLocaleString(
        "en-US",
        { timeZone: "Asia/Kolkata" }
      )}`,
      data: dbResponse,
    });
  } catch (error) {
    //ce(`The error during customer creation : ${error}`);

    // Database Validation Error
    if (error instanceof mongoose.Error.ValidationError) {
      logError("Customer Creation - Validation Error", error);
      return res.status(422).send({
        status: "failure",
        message: "Validation error during customer creation.",
        error: error.message || error,
      });
    }

    // MongoDB Duplicate Key Error (e.g., email uniqueness constraint)
    if (error.code === 11000) {
      logError("Customer Creation - Duplicate Error", error);
      return res.status(409).send({
        status: "failure",
        message: "A customer with this contact Num already exists.",
      });
    }

    // Handle MongoDB connection or network issues
    if (error.message.includes("network error")) {
      logError("Customer Creation - Network Error", error);
      return res.status(503).send({
        status: "failure",
        message: "Service temporarily unavailable. Please try again later.",
      });
    }

    // General Server Error
    logError("Customer Creation - Unknown Error", error);
    return res.status(500).send({
      status: "failure",
      message: "An unexpected error occurred. Please try again.",
      error: error.message || error,
    });
  }
};

export const getCustomers = async (req, res) => {
  try {
    const dbResponse = await CustomerModel.find({});
    return res.status(200).send({
      status: "success",
      message: " All the customers has been fetched successfully",
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

export const getCustomer = async (req, res) => {
  const { customerId } = req.params;
  try {
    const dbResponse = await CustomerModel.findById(customerId);
    if (!dbResponse) {
      return res.status(404).send({
        status: "failure",
        message: `The customer ${customerId} has been deleted or does not exist `,
      });
    }
    return res.status(200).send({
      status: "success",
      message: `The customer record ${customerId} has been fetched successfully.`,
      data: dbResponse,
    });
  } catch (error) {
    ce(`Error fetching customer with ID ${customerId}:`, error);
    return res.status(500).send({
      status: "failure",
      message: `The error has been caught while fetching the customer record `,
      error: error.message || error,
    });
  }
};

export const updateCustomer = async (request, response) => {
  const { customerId } = request.params;
  const customerBodyToUpdate = request.body;
  try {
    const customerExists = await CustomerModel.findById(customerId);
    if (!customerExists) {
      return res.status(404).send({
        status: "failure",
        message: `The customer ${customerId} has been deleted or does not exist `,
      });
    }

    const dbResponse = await CustomerModel.updateOne(
      { _id: customerId },
      { $set: customerBodyToUpdate }
    );
    return response.status(200).send({
      status: "success",
      message: `The customer ${customerId} has been updated successfully.`,
      data: dbResponse,
    });
  } catch (error) {
    return response.status(400).send({
      status: "failure",
      message: `There is an error while updating the customer record ${customerId}`,
      error: error,
    });
  }
};

export const deleteCustomer = async (req, res) => {
  const { customerId } = req.params;
  try {
    const dbResponse = await CustomerModel.findByIdAndDelete(customerId);
    if (!dbResponse) {
      return res.status(404).send({
        status: "failure",
        message: `No customer found with id ${customerId}`,
      });
    }

    return res.status(200).send({
      status: "success",
      message: `The customer ${customerId} has been deleted successfully`,
      data: dbResponse,
    });
  } catch (error) {
    return res.status(400).send({
      status: "failure",
      message: `There has been error while deleting the customer id ${customerId}`,
      error: error,
    });
  }
};

// Delete all customers and reset sequence
export const deleteAllCustomers = async (req, res) => {
  try {
    // Delete all customers
    const deleteResponse = await CustomerModel.deleteMany({});
    console.log(`Deleted ${deleteResponse.deletedCount} customers.`);

    // Reset the counter for customer code

    const resetCounter = await CustomerCounterModel.findOneAndUpdate(
      { _id: "customerCode" },
      { seq: 0 }, // Reset sequence to 0
      { new: true, upsert: true } // Create document if it doesn't exist
    );

    return res.status(200).send({
      status: "success",
      message:
        "All customers have been deleted, and the sequence has been reset to 1.",
      data: {
        deletedCount: deleteResponse.deletedCount,
        counter: resetCounter,
      },
    });
  } catch (error) {
    console.error(
      "Error while deleting all customers and resetting sequence:",
      error
    );
    return res.status(500).send({
      status: "failure",
      message: "Error while deleting all customers or resetting the sequence.",
      error: error.message,
    });
  }
};
