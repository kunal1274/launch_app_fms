import mongoose from "mongoose";
import cl from "../utility/cl.utils.js";
import ce from "../utility/ce.utils.js";
import { ItemModel } from "../models/item.model.js";
import { ItemCounterModel } from "../models/counter.model.js";
import { logError, winstonLogger } from "../utility/logError.utils.js";

// controllers/metadata.controller.js

import { SiteModel } from "../models/site.model.js";
import { WarehouseModel } from "../models/warehouse.model.js";
import { ZoneModel } from "../models/zone.model.js";
import { RackModel } from "../models/rack.model.js";
import { ShelfModel } from "../models/shelf.model.js";
import { AisleModel } from "../models/aisle.model.js";
import { BinModel } from "../models/bin.model.js";
import { ProductDimConfigModel } from "../models/productDimConfig.model.js";
import { ProductDimColorModel } from "../models/productDimColor.model.js";
import { ProductDimSizeModel } from "../models/productDimSize.model.js";
import { ProductDimStyleModel } from "../models/productDimStyle.model.js";
import { ProductDimVersionModel } from "../models/productDimVersion.model.js";
import { BatchModel } from "../models/trackingDimBatch.model.js";
import { SerialModel } from "../models/trackingDimSerial.model.js";

/**
 * GET /fms/api/v0/metadata/items
 * Returns all dropdown lists needed by the ItemForm in one payload.
 */
export const getMetadataItems = async (req, res) => {
  try {
    // Query all reference collections in parallel
    const [
      sites,
      warehouses,
      zones,
      racks,
      shelves,
      aisles,
      bins,
      configurations,
      colors,
      sizes,
      styles,
      versions,
      batches,
      serials,
    ] = await Promise.all([
      SiteModel.find({}),
      WarehouseModel.find({}),
      ZoneModel.find({}),
      RackModel.find({}),
      ShelfModel.find({}),
      AisleModel.find({}),
      BinModel.find({}),
      ProductDimConfigModel.find({}),
      ProductDimColorModel.find({}),
      ProductDimSizeModel.find({}),
      ProductDimStyleModel.find({}),
      ProductDimVersionModel.find({}),
      BatchModel.find({}),
      SerialModel.find({}),
    ]);

    // Send everything in one atomic response
    res.status(200).json({
      status: "success",
      data: {
        sites,
        warehouses,
        zones,
        racks,
        shelves,
        aisles,
        bins,
        configurations,
        colors,
        sizes,
        styles,
        versions,
        batches,
        serials,
      },
    });
  } catch (error) {
    console.error("Error fetching metadata:", error);
    res.status(500).json({
      status: "failure",
      message: "Couldn’t load form metadata",
      error: error.message,
    });
  }
};

export const getMetadataAndItem = async (req, res) => {
  const { itemId } = req.params;
  try {
    const [
      sites,
      warehouses,
      zones,
      racks,
      shelves,
      aisles,
      bins,
      configurations,
      colors,
      sizes,
      styles,
      versions,
      batches,
      serials,
      item,
    ] = await Promise.all([
      SiteModel.find({}),
      WarehouseModel.find({}),
      ZoneModel.find({}),
      RackModel.find({}),
      ShelfModel.find({}),
      AisleModel.find({}),
      BinModel.find({}),
      ProductDimConfigModel.find({}),
      ProductDimColorModel.find({}),
      ProductDimSizeModel.find({}),
      ProductDimStyleModel.find({}),
      ProductDimVersionModel.find({}),
      BatchModel.find({}),
      SerialModel.find({}),
      ItemModel.findById(itemId).populate([
        "site",
        "warehouse",
        "zone",
        "location",
        "aisle",
        "rack",
        "shelf",
        "bin",
        "config",
        "color",
        "size",
        "style",
        "version",
        "batch",
        "serial",
      ]),
    ]);

    if (!item) {
      return res.status(404).json({
        status: "failure",
        message: `Item ${itemId} not found.`,
      });
    }

    return res.status(200).json({
      status: "success",
      data: {
        metadata: {
          sites,
          warehouses,
          zones,
          racks,
          shelves,
          aisles,
          bins,
          configurations,
          colors,
          sizes,
          styles,
          versions,
          batches,
          serials,
        },
        item,
      },
    });
  } catch (error) {
    console.error("Error fetching combined metadata + item:", error);
    return res.status(500).json({
      status: "failure",
      message: "Couldn’t load item details and metadata",
      error: error.message,
    });
  }
};

export const createItem = async (req, res) => {
  const itemBody = req.body;
  try {
    if (!itemBody.itemNum || !itemBody.name) {
      return res.status(422).send({
        status: "failure",
        message: "⚠️ Item code and Item Name are the required fields.",
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
      message: `✅ Item master has been created successfully with code : ${
        dbResponseNewItem.code
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
        message: "❌ Validation error during item creation.",
        error: error.message || error,
      });
    }

    // MongoDB Duplicate Key Error (e.g., email uniqueness constraint)
    if (error.code === 11000) {
      logError("Item Creation - Duplicate Error", error);
      return res.status(409).send({
        status: "failure",
        message: "❌ An item with the same code already exists.",
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
      return res.status(400).json({ 
        status: "failure",
        message: "⚠️ No files uploaded" 
      });
    }

    // Prepare file metadata
    const uploadedFiles = files.map((file) => ({
      fileName: file.originalname,
      fileOriginalName: file.originalname,
      fileType: file.mimetype,
      fileUrl: `/uploads/items/${file.filename}`, // Path to access the file
      fileUploadedAt: new Date()
    }));

    // Update the item with the file metadata
    const item = await ItemModel.findByIdAndUpdate(
      itemId,
      { $push: { files: { $each: uploadedFiles } } }, // Add files to the `files` array
      { new: true }
    );

    if (!item) {
      return res.status(404).json({ 
        status: "failure",
        message: "⚠️ Item not found" 
      });
    }

    res.status(200).json({ 
      status: "success",
      message: "✅ Files uploaded successfully", 
      data: item 
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ 
      status: "failure",
      message: "❌ Internal server error" 
    });
  }
};

/**
 * Search items with filters and pagination
 */
export const searchItems = async (req, res) => {
  try {
    const {
      search,
      type,
      category,
      minPrice,
      maxPrice,
      unit,
      active,
      page = 1,
      limit = 10,
      sortBy = 'name',
      sortOrder = 'asc'
    } = req.query;

    // Build filter object
    const filter = {};
    
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } },
        { itemNum: { $regex: search, $options: 'i' } }
      ];
    }
    
    if (type) filter.type = type;
    if (category) filter.category = category;
    if (unit) filter.unit = unit;
    if (active !== undefined) filter.active = active === 'true';
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Execute query
    const [items, totalCount] = await Promise.all([
      ItemModel.find(filter)
        .sort(sort)
        .skip(skip)
        .limit(parseInt(limit))
        .populate(['site', 'warehouse', 'zone', 'location', 'aisle', 'rack', 'shelf', 'bin']),
      ItemModel.countDocuments(filter)
    ]);

    const totalPages = Math.ceil(totalCount / parseInt(limit));

    res.status(200).json({
      status: "success",
      message: "✅ Items searched successfully",
      data: items,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalCount,
        limit: parseInt(limit),
        hasNext: parseInt(page) < totalPages,
        hasPrev: parseInt(page) > 1
      }
    });
  } catch (error) {
    console.error("Error searching items:", error);
    res.status(500).json({
      status: "failure",
      message: "❌ Error searching items",
      error: error.message
    });
  }
};

/**
 * Bulk create items
 */
export const bulkCreateItems = async (req, res) => {
  try {
    const { items } = req.body;
    
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: "⚠️ Items array is required and must not be empty"
      });
    }

    // Validate each item
    const validationErrors = [];
    for (let i = 0; i < items.length; i++) {
      if (!items[i].itemNum || !items[i].name) {
        validationErrors.push(`Item ${i + 1}: itemNum and name are required`);
      }
    }

    if (validationErrors.length > 0) {
      return res.status(422).json({
        status: "failure",
        message: "❌ Validation errors found",
        errors: validationErrors
      });
    }

    const createdItems = await ItemModel.insertMany(items);

    res.status(201).json({
      status: "success",
      message: `✅ ${createdItems.length} items created successfully`,
      data: createdItems
    });
  } catch (error) {
    console.error("Error in bulk create items:", error);
    res.status(500).json({
      status: "failure",
      message: "❌ Error creating items in bulk",
      error: error.message
    });
  }
};

/**
 * Bulk update items
 */
export const bulkUpdateItems = async (req, res) => {
  try {
    const { updates } = req.body;
    
    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: "⚠️ Updates array is required and must not be empty"
      });
    }

    const results = [];
    for (const update of updates) {
      const { itemId, ...updateData } = update;
      
      if (!itemId) {
        results.push({ itemId: 'unknown', status: 'failed', error: 'Item ID is required' });
        continue;
      }

      try {
        const updatedItem = await ItemModel.findByIdAndUpdate(
          itemId,
          { $set: updateData },
          { new: true, runValidators: true }
        );
        
        if (updatedItem) {
          results.push({ itemId, status: 'success', data: updatedItem });
        } else {
          results.push({ itemId, status: 'failed', error: 'Item not found' });
        }
      } catch (error) {
        results.push({ itemId, status: 'failed', error: error.message });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const failureCount = results.filter(r => r.status === 'failed').length;

    res.status(200).json({
      status: "success",
      message: `✅ Bulk update completed: ${successCount} successful, ${failureCount} failed`,
      data: results
    });
  } catch (error) {
    console.error("Error in bulk update items:", error);
    res.status(500).json({
      status: "failure",
      message: "❌ Error updating items in bulk",
      error: error.message
    });
  }
};

/**
 * Bulk delete items
 */
export const bulkDeleteItems = async (req, res) => {
  try {
    const { itemIds } = req.body;
    
    if (!itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: "⚠️ Item IDs array is required and must not be empty"
      });
    }

    const deleteResult = await ItemModel.deleteMany({
      _id: { $in: itemIds }
    });

    res.status(200).json({
      status: "success",
      message: `✅ ${deleteResult.deletedCount} items deleted successfully`,
      data: {
        deletedCount: deleteResult.deletedCount,
        requestedCount: itemIds.length
      }
    });
  } catch (error) {
    console.error("Error in bulk delete items:", error);
    res.status(500).json({
      status: "failure",
      message: "❌ Error deleting items in bulk",
      error: error.message
    });
  }
};
