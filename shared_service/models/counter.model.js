import mongoose, { model, Schema } from "mongoose";
import { dbgModels } from "../../index.js";

// Define Schema
const globalPartyCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

// Check if the model already exists before defining it
export const GlobalPartyCounterModel =
  mongoose.models.GlobalPartyCounters ||
  model("GlobalPartyCounters", globalPartyCounterSchema);

// dbgModels("global party counters mounted ", GlobalPartyCounterModel);
