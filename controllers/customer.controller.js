import mongoose from "mongoose";
import { CustomerModel } from "../models/customer.model.js";
import { CustomerCounterModel } from "../models/counter.model.js";
import ce from "../utility/ce.utils.js";
import cl from "../utility/cl.utils.js";
import { GlobalPartyModel } from "../shared_service/models/globalParty.model.js";

// Helper function for error logging
const logError = (context, error) => {
  console.error(`[${new Date().toISOString()}] ${context} - Error:`, {
    message: error.message || error,
    stack: error.stack,
  });
};

// Outdated Version used till 15th Apr 2025 Bangalore Kengeri by kunal
export const createCustomer_V1 = async (req, res) => {
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

// New version in effect with global party id from 15th Apr 2025 655pm ist bangalore by kunal
export const createCustomer = async (req, res) => {
  try {
    // 1) Basic input check
    const { name, contactNum, globalPartyId, ...rest } = req.body;
    if (!name || !contactNum) {
      return res.status(422).send({
        status: "failure",
        message: "Customer name and contactNum are required.",
      });
    }

    // 2) Prepare a variable to hold the final partyId
    let partyId = null;

    // 3) If no globalPartyId was passed, we create a new GlobalParty doc with partyType=["Customer"].
    if (!globalPartyId) {
      const newParty = await GlobalPartyModel.create({
        name, // or pass something else for .name
        partyType: ["Customer"], // force the array to have "Customer"
      });
      partyId = newParty._id;
    } else {
      // 4) If globalPartyId is provided, we find that doc
      const existingParty = await GlobalPartyModel.findById(globalPartyId);
      if (!existingParty) {
        // Option A: Throw an error
        // return res.status(404).send({
        //   status: "failure",
        //   message: `GlobalParty with ID ${globalPartyId} does not exist.`,
        // });

        // Option B: Or create a new GlobalParty doc with that _id (rarely recommended)
        // But usually you'd want to fail if the globalPartyId doesn't exist
        return res.status(404).json({
          status: "failure",
          message: `GlobalParty ${globalPartyId} not found. (Cannot create Customer referencing missing party.)`,
        });
      }

      // 5) If found, ensure "Customer" is in the partyType array
      if (!existingParty.partyType.includes("Customer")) {
        existingParty.partyType.push("Customer");
        await existingParty.save();
      }

      // We'll use the existingParty's _id
      partyId = existingParty._id;
    }

    // 6) Now create the new Customer doc
    const newCustomer = await CustomerModel.create({
      name,
      contactNum,
      globalPartyId: partyId,
      ...rest,
    });

    // 7) Return success
    return res.status(201).send({
      status: "Success",
      message: `Customer created successfully with ID: ${newCustomer._id}.`,
      data: newCustomer,
    });
  } catch (error) {
    // 8) Error Handling
    if (error instanceof mongoose.Error.ValidationError) {
      logError("Customer Creation - Validation Error", error);
      return res.status(422).send({
        status: "failure",
        message: "Validation error during customer creation.",
        error: error.message || error,
      });
    }
    // Duplicate key (contactNum or email or globalPartyId)
    if (error.code === 11000) {
      logError("Customer Creation - Duplicate Error", error);
      return res.status(409).send({
        status: "failure",
        message:
          "A customer with that contactNum or email or globalParty already exists.",
      });
    }
    // Network or unknown
    if (error.message && error.message.includes("network error")) {
      logError("Customer Creation - Network Error", error);
      return res.status(503).send({
        status: "failure",
        message: "Service temporarily unavailable. Please try again later.",
      });
    }
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
