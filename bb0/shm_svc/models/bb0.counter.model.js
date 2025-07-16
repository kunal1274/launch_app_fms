import mongoose, { model, Schema } from "mongoose";

const bb0_ledgerAccountCounterSchema = new Schema({
  _id: {
    type: String,
    required: true,
  },
  seq: {
    type: Number,
    default: 0,
  },
});

export const BB0_LedgerAccountCounterModel =
  mongoose.models.BB0_LedgerAccountCounters ||
  model("BB0_LedgerAccountCounters", bb0_ledgerAccountCounterSchema);

// Define Schema
const bb0_globalPartyCounterSchema = new Schema({
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
export const BB0_GlobalPartyCounterModel =
  mongoose.models.BB0_GlobalPartyCounters ||
  model("BB0_GlobalPartyCounters", bb0_globalPartyCounterSchema);

// Define Schema
const bb0_customerCounterSchema = new Schema({
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
export const BB0_CustomerCounterModel =
  mongoose.models.BB0_CustomerCounters ||
  model("BB0_CustomerCounters", bb0_customerCounterSchema);

// dbgModels("global party counters mounted ", GlobalPartyCounterModel);
