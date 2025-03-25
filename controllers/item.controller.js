import mongoose from "mongoose";
import cl from "../utility/cl.utils.js";
import ce from "../utility/ce.utils.js";
import { ItemModel } from "../models/item.model.js";
import { ItemCounterModel } from "../models/counter.model.js";
import { logError, winstonLogger } from "../utility/logError.utils.js";

export const createItem = async (req, res) => {
  const itemBody = req.body;
  try {
    if (!itemBody.itemNum || !itemBody.name) {
      return res.status(422).send({
        status: "failure",
        message: " Item code and Item Name are the required fields.",
      });
    }

    const dbResponseNewItem = await ItemModel.create(itemBody);
    // if (!dbResponseNewItem) {
    //   throw new Error({
    //     status: "failure",
    //     message: `There has been an error while creating the item master`,
    //   });
    // }
    cl(
      `Item master has been created successfully with id : ${
        dbResponseNewItem._id
      } at ${new Date().toISOString()} equivalent to IST ${new Date().toLocaleString(
        "en-US",
        { timeZone: "Asia/Kolkata" }
      )}`
    );

    return res.status(201).send({
      status: "success",
      message: `Item master has been created successfully with id : ${
        dbResponseNewItem._id
      } at ${new Date().toISOString()} equivalent to IST ${new Date().toLocaleString(
        "en-US",
        { timeZone: "Asia/Kolkata" }
      )}`,
      data: dbResponseNewItem,
    });
  } catch (error) {
    // Database Validation Error
    if (error instanceof mongoose.Error.ValidationError) {
      logError("Item Creation - Validation Error", error);
      return res.status(422).send({
        status: "failure",
        message: "Validation error during item creation.",
        error: error.message || error,
      });
    }

    // MongoDB Duplicate Key Error (e.g., email uniqueness constraint)
    if (error.code === 11000) {
      logError("item Creation - Duplicate Error", error);
      return res.status(409).send({
        status: "failure",
        message: "An item with the same code already exists.",
      });
    }

    // Handle MongoDB connection or network issues
    if (error.message.includes("network error")) {
      logError("Item Creation - Network Error", error);
      return res.status(503).send({
        status: "failure",
        message: "Service temporarily unavailable. Please try again later.",
      });
    }

    // General Server Error
    logError("Item Creation - Unknown Error", error);
    return res.status(500).send({
      status: "failure",
      message: "An unexpected error occurred. Please try again.",
      error: error.message || error,
    });
  }
};

export const getItems = async (req, res) => {
  try {
    const dbResponse = await ItemModel.find({});
    return res.status(200).send({
      status: "success",
      message: " All the items has been fetched successfully",
      count: dbResponse.length,
      data: dbResponse,
    });
  } catch (error) {
    return res.status(400).send({
      status: "failure",
      message: " There is an error while trying to fetch all the items",
      error: error,
    });
  }
};

export const getItem = async (req, res) => {
  const { itemId } = req.params;
  try {
    const dbResponse = await ItemModel.findById(itemId);
    if (!dbResponse) {
      return res.status(404).send({
        status: "failure",
        message: `The item ${itemId} has been deleted or does not exist `,
      });
    }
    return res.status(200).send({
      status: "success",
      message: `The item record ${itemId} has been fetched successfully.`,
      data: dbResponse,
    });
  } catch (error) {
    ce(`Error fetching item with ID ${itemId}:`, error);
    return res.status(500).send({
      status: "failure",
      message: `The error has been caught while fetching the item record `,
      error: error.message || error,
    });
  }
};

export const updateItem = async (request, response) => {
  const { itemId } = request.params;
  const itemBodyToUpdate = request.body;
  try {
    const itemExists = await ItemModel.findById(itemId);
    if (!itemExists) {
      return res.status(404).send({
        status: "failure",
        message: `The item ${itemId} has been deleted or does not exist `,
      });
    }
    const dbResponse = await ItemModel.updateOne(
      { _id: itemId },
      { $set: itemBodyToUpdate }
    );
    return response.status(200).send({
      status: "success",
      message: `The item ${itemId} has been updated successfully.`,
      data: dbResponse,
    });
  } catch (error) {
    return response.status(400).send({
      status: "failure",
      message: `There is an error while updating the item record ${itemId}`,
      error: error,
    });
  }
};

export const deleteItem = async (req, res) => {
  const { itemId } = req.params;
  try {
    const dbResponse = await ItemModel.findByIdAndDelete(itemId);
    if (!dbResponse) {
      return res.status(404).send({
        status: "failure",
        message: `No item found with id ${itemId}`,
      });
    }
    return res.status(200).send({
      status: "success",
      message: `The item ${itemId} has been deleted successfully.`,
      data: dbResponse,
    });
  } catch (error) {
    console.error("Error deleting item:", error);
    return res.status(500).send({
      status: "failure",
      message: `There was an error while deleting the item with id ${itemId}.`,
      error: error.message,
    });
  }
};

// Delete all items and reset sequence
export const deleteAllItems = async (req, res) => {
  try {
    // Delete all items
    const deleteResponse = await ItemModel.deleteMany({});
    console.log(`Deleted ${deleteResponse.deletedCount} items.`);

    // Reset the counter for item code
    const resetCounter = await ItemCounterModel.findOneAndUpdate(
      { _id: "itemCode" },
      { seq: 0 }, // Reset sequence to 0
      { new: true, upsert: true } // Create document if it doesn't exist
    );

    return res.status(200).send({
      status: "success",
      message:
        "All items have been deleted, and the sequence has been reset to 1.",
      data: {
        deletedCount: deleteResponse.deletedCount,
        counter: resetCounter,
      },
    });
  } catch (error) {
    console.error(
      "Error while deleting all items and resetting sequence:",
      error
    );
    return res.status(500).send({
      status: "failure",
      message: "Error while deleting all items or resetting the sequence.",
      error: error.message,
    });
  }
};

export const uploadFilesAgainstItem = async (req, res) => {
  try {
    const itemId = req.params.itemId;
    const files = req.files;
    winstonLogger.info(req.params.id);
    winstonLogger.info(req.files);
    winstonLogger.info(req.body);

    if (!files || files.length === 0) {
      return res.status(400).json({ message: "No files uploaded" });
    }

    // Prepare file metadata
    const uploadedFiles = files.map((file) => ({
      fileName: file.originalname,
      fileType: file.mimetype,
      fileUrl: `/uploads/items/${file.filename}`, // Path to access the file
    }));

    // Update the item with the file metadata
    const item = await ItemModel.findByIdAndUpdate(
      itemId,
      { $push: { files: { $each: uploadedFiles } } }, // Add files to the `files` array
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ message: "Item not found" });
    }

    res.status(200).json({ message: "Files uploaded successfully", item });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Internal server error" });
  }
};
