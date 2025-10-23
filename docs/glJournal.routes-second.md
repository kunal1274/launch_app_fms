Below is a comprehensive, step-by-step guide (with full code) to implement a “General Ledger Journal” feature in an Express/Mongoose application, complete with detailed explanations of how exchange rates and `localAmount` work (including two scenarios: when your functional currency is INR (weaker than USD) and when it is GBP (stronger than USD)). We’ll also show example payloads and resulting documents.

---

## Overview

We want to allow users to post arbitrary General Ledger (GL) journals, where:

1. **Each journal** has:

   - A `journalDate` (when the journal is posted).
   - A `reference` (e.g., “Sales Invoice INV_000123 posting”).
   - A `createdBy` (who created the journal, e.g., a username).
   - An array of `lines`, where each line:

     - Debits or credits a particular `accountCode`.
     - Specifies an `amount` in a given `currency`.
     - Provides an `exchangeRate` to convert that currency into the company’s **functional currency**.
     - Stores a computed `localAmount` = (debit − credit) × exchangeRate.
     - Optionally includes any “dimensions” (like warehouse, batch, serial) if this is linking to inventory.

2. **Balancing rule**: The sum of all debits in a journal must equal the sum of all credits. We enforce this at the Mongoose‐schema level (pre‐save hook).

3. **FX conversion**:

   - We store each line’s `currency` and `exchangeRate` (e.g. 1 USD = 75 INR).
   - We compute `localAmount` = (debit − credit) × exchangeRate.
   - Example when functional currency = INR (weaker than USD) or GBP (stronger than USD) will be shown.

4. **Transaction safety**: We wrap the creation in a MongoDB transaction, so that if you later expand to post sub-ledger (inventory, AR, tax, etc.) in the same operation, everything will commit or rollback together.

---

## 1. Mongoose Model

Create a file at `models/glJournal.model.js`:

```js
// models/glJournal.model.js

import mongoose, { Schema, model } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Define the sub‐schema for each GL line
// ─────────────────────────────────────────────────────────────────────────────
const glLineSchema = new Schema(
  {
    accountCode: {
      type: String,
      required: [true, "Each line must specify an accountCode."],
      trim: true,
    },
    debit: {
      type: Number,
      default: 0,
      min: [0, "Debit cannot be negative."],
    },
    credit: {
      type: Number,
      default: 0,
      min: [0, "Credit cannot be negative."],
    },
    currency: {
      type: String,
      required: [true, "Currency is required on each line."],
      trim: true,
    },
    exchangeRate: {
      // Rate to convert from line’s currency into functional currency.
      // e.g., if functional currency is INR and line currency is USD, exchangeRate = 75 means 1 USD = 75 INR.
      type: Number,
      required: [true, "Exchange rate is required."],
      min: [0, "Exchange rate must be non-negative."],
    },
    localAmount: {
      // This must equal (debit − credit) × exchangeRate, rounded to two decimals.
      type: Number,
      required: [
        true,
        "Local amount is required (debit − credit) × exchangeRate.",
      ],
    },

    // OPTIONAL: If you want to link an inventory dimension to this GL line,
    // copy/paste the dims object from your voucher model:
    dims: {
      site: { type: Schema.Types.ObjectId, ref: "Sites" },
      warehouse: { type: Schema.Types.ObjectId, ref: "Warehouses" },
      zone: { type: Schema.Types.ObjectId, ref: "Zones" },
      location: { type: Schema.Types.ObjectId, ref: "Locations" },
      aisle: { type: Schema.Types.ObjectId, ref: "Aisles" },
      rack: { type: Schema.Types.ObjectId, ref: "Racks" },
      shelf: { type: Schema.Types.ObjectId, ref: "Shelves" },
      bin: { type: Schema.Types.ObjectId, ref: "Bins" },
      config: { type: Schema.Types.ObjectId, ref: "Configurations" },
      color: { type: Schema.Types.ObjectId, ref: "Colors" },
      size: { type: Schema.Types.ObjectId, ref: "Sizes" },
      style: { type: Schema.Types.ObjectId, ref: "Styles" },
      version: { type: Schema.Types.ObjectId, ref: "Versions" },
      batch: { type: Schema.Types.ObjectId, ref: "Batches" },
      serial: { type: Schema.Types.ObjectId, ref: "Serials" },
    },

    // Extra metadata—could store sub-ledger IDs or notes
    extras: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: true }
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Define the top‐level GL Journal schema
// ─────────────────────────────────────────────────────────────────────────────
const glJournalSchema = new Schema(
  {
    journalDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    reference: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: String,
      required: true,
      default: "system", // you can override with req.user
    },
    lines: {
      // Must have at least one line
      type: [glLineSchema],
      required: [true, "A GL Journal must have at least one line."],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "A GL Journal must have at least one line.",
      },
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 3. Pre-save hook: ensure total debits = total credits
// ─────────────────────────────────────────────────────────────────────────────
glJournalSchema.pre("save", function (next) {
  const journal = this;
  let totalDebits = 0;
  let totalCredits = 0;

  journal.lines.forEach((ln) => {
    totalDebits += ln.debit;
    totalCredits += ln.credit;
  });

  // Round to 2 decimals before comparison
  totalDebits = Math.round(totalDebits * 100) / 100;
  totalCredits = Math.round(totalCredits * 100) / 100;

  if (totalDebits !== totalCredits) {
    // Construct a validation error:
    const err = new mongoose.Error.ValidationError(
      new Error(
        `Unbalanced GL Journal: totalDebits (${totalDebits.toFixed(
          2
        )}) ≠ totalCredits (${totalCredits.toFixed(2)})`
      )
    );
    return next(err);
  }

  next();
});

// Optional: index to speed queries by date or creator
glJournalSchema.index({ journalDate: 1, createdBy: 1 });

export const GLJournalModel =
  mongoose.models.GLJournals || model("GLJournals", glJournalSchema);
```

### Explanation of Model

1. **`glLineSchema`**

   - `accountCode` (e.g., `"CASH"`, `"SALES_REVENUE"`, `"ACCOUNTS_RECEIVABLE"`, `"COGS"`, etc.).
     Required and trimmed.
   - `debit` / `credit`: each nonnegative. We enforce exactly one of them > 0 in the controller (i.e. you cannot have both debit & credit positive, and you cannot have both zero).
   - `currency`: the currency code for this line, e.g. `"USD"`, `"INR"`, `"GBP"`.
   - `exchangeRate`: number ≥ 0. Interpreted as:

     > “1 unit of this `currency` equals `exchangeRate` units of our functional currency.”
     > For example, if our functional currency is INR and we set `currency = "USD", exchangeRate = 75`, that means **1 USD = 75 INR**.
     > If functional currency is GBP and we set `currency = "USD", exchangeRate = 0.73`, that means **1 USD = 0.73 GBP**.

   - `localAmount`: number, required. Should equal `(debit − credit) × exchangeRate`, rounded to two decimals. The pre-save hook does not recalc it; it simply trusts that you passed the correct value (which the controller will ensure).
   - `dims`: optional block of storage/product dimensions (identical to what you had in your voucher model). If your GL lines do not need inventory dims, you can remove this entire block.
   - `extras`: an optional map for any extra metadata (e.g. subledger IDs, references to a sales order line, etc.).

2. **`glJournalSchema`**

   - `journalDate`: when this GL journal is posted (defaults to now).
   - `reference`: free-text reference (e.g. “Posted Sales Invoice INV_000123”).
   - `createdBy`: user or system who created this GL journal (defaults to `"system"`).
   - `lines`: the array of `glLineSchema`. We enforce that it must be a non-empty array.

3. **Pre-save hook**

   - Before saving, we iterate over `journal.lines`, sum up `debit` and `credit`, round to two decimals, and verify they match. If not, we create a Mongoose validation error, which causes the save to fail with a 422 (in our controller).

---

## 2. Controller Logic

Create a file at `controllers/glJournal.controller.js`. It will expose two methods:

1. **`createGLJournal`**:

   - Validates incoming JSON body (ensuring each line has exactly one of `debit` or `credit` > 0).
   - Computes `localAmount` if not provided (safe fallback).
   - Wraps in a MongoDB transaction so that future expansions (e.g. updating sub-ledgers) can be atomic.
   - Saves the `GLJournalModel` (pre-save hook enforces balancing).

2. **`getGLJournals`**:

   - Accepts query parameters (`startDate`, `endDate`, `accountCode`, `createdBy`, `page`, `limit`) to filter/paginate.
   - Returns a paginated list of matching journals.

```js
// controllers/glJournal.controller.js

import mongoose from "mongoose";
import { GLJournalModel } from "../models/glJournal.model.js";

/**
 * Helper: rounds a number to two decimals
 */
function roundToTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Create a new GL Journal (balanced debit vs. credit).
 *
 * Expects request body:
 * {
 *   "journalDate"?: "2025-06-10T00:00:00.000Z",
 *   "reference"?: "string",
 *   "createdBy"?: "string",
 *   "lines": [
 *     {
 *       "accountCode": "CASH",
 *       "debit": 500,
 *       "credit": 0,
 *       "currency": "USD",
 *       "exchangeRate": 75.0,
 *       // optionally: "localAmount"
 *       // optionally: "dims": { site, warehouse, … }
 *       // optionally: "extras": {...}
 *     },
 *     {
 *       "accountCode": "SALES_REVENUE",
 *       "debit": 0,
 *       "credit": 500,
 *       "currency": "USD",
 *       "exchangeRate": 75.0
 *     }
 *   ]
 * }
 */
export const createGLJournal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      journalDate = new Date(),
      reference = "",
      createdBy = req.user?.username || "system",
      lines: rawLines,
    } = req.body;

    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      throw new Error("A GL Journal must have at least one line.");
    }

    // 1) Validate and process each line
    const processedLines = rawLines.map((ln, idx) => {
      const {
        accountCode,
        debit = 0,
        credit = 0,
        currency,
        exchangeRate,
        localAmount,
        dims,
        extras,
      } = ln;

      // a) accountCode must be a non-empty string
      if (
        !accountCode ||
        typeof accountCode !== "string" ||
        accountCode.trim() === ""
      ) {
        throw new Error(
          `Line ${
            idx + 1
          }: accountCode is required and must be a non-empty string.`
        );
      }

      // b) currency must be a non-empty string
      if (!currency || typeof currency !== "string" || currency.trim() === "") {
        throw new Error(
          `Line ${
            idx + 1
          }: currency is required and must be a non-empty string.`
        );
      }

      // c) exchangeRate must be a number ≥ 0
      if (typeof exchangeRate !== "number" || exchangeRate < 0) {
        throw new Error(
          `Line ${idx + 1}: exchangeRate must be a non-negative number.`
        );
      }

      // d) Exactly one of debit or credit must be > 0 (the other must be 0).
      const d = roundToTwo(Number(debit) || 0);
      const c = roundToTwo(Number(credit) || 0);
      if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
        throw new Error(
          `Line ${
            idx + 1
          }: exactly one of debit or credit must be > 0 (got debit=${d}, credit=${c}).`
        );
      }

      // e) Compute localAmount if not supplied: (debit − credit) × exchangeRate
      let computedLocal =
        typeof localAmount === "number" ? roundToTwo(localAmount) : null;
      if (computedLocal === null) {
        computedLocal = roundToTwo((d - c) * exchangeRate);
      }

      return {
        accountCode: accountCode.trim(),
        debit: d,
        credit: c,
        currency: currency.trim(),
        exchangeRate: roundToTwo(exchangeRate),
        localAmount: computedLocal,
        dims: dims || {},
        extras: extras || {},
      };
    });

    // 2) Build and save the GL Journal document
    const glJournal = new GLJournalModel({
      journalDate,
      reference: reference.trim(),
      createdBy: createdBy.trim(),
      lines: processedLines,
    });

    await glJournal.save({ session });

    // 3) Commit transaction
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: "success",
      data: glJournal,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ createGLJournal Error:", err);
    // If it's a Mongoose validation error, respond with 422
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(422).json({ status: "failure", message: err.message });
    }
    return res.status(400).json({ status: "failure", message: err.message });
  }
};

/**
 * List / search GL Journals. Supports pagination + filters.
 *
 * Query parameters:
 *   - startDate (ISO string)
 *   - endDate   (ISO string)
 *   - accountCode  (string)
 *   - createdBy    (string)
 *   - page (number, default 1)
 *   - limit (number, default 20)
 */
export const getGLJournals = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      accountCode,
      createdBy,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};

    // a) date range filter
    if (startDate || endDate) {
      filter.journalDate = {};
      if (startDate) filter.journalDate.$gte = new Date(startDate);
      if (endDate) filter.journalDate.$lte = new Date(endDate);
    }

    // b) createdBy filter
    if (createdBy) filter.createdBy = createdBy;

    // c) accountCode filter: journals that have at least one line with this accountCode
    if (accountCode) {
      filter["lines.accountCode"] = accountCode;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await GLJournalModel.countDocuments(filter);

    const journals = await GLJournalModel.find(filter)
      .sort({ journalDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      status: "success",
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
      data: journals,
    });
  } catch (err) {
    console.error("❌ getGLJournals Error:", err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};
```

### Explanation of Controller

1. **`createGLJournal`**

   - Starts a Mongoose session + transaction.
   - Destructures request body (`journalDate`, `reference`, `createdBy`, `lines: rawLines`).
   - Ensures `rawLines` is a non-empty array.
   - **Line validation** (in `.map()`):

     - `accountCode` must be a non-empty string.
     - `currency` must be a non-empty string.
     - `exchangeRate` must be a number ≥ 0.
     - Exactly one of `debit`/`credit` > 0, the other must be zero.

   - Computes `localAmount` if not explicitly provided:

     ```js
     localAmount = roundToTwo((debit − credit) × exchangeRate);
     ```

   - Builds a new `GLJournalModel` with:

     ```js
     {
       journalDate,
       reference,
       createdBy,
       lines: processedLines
     }
     ```

   - Calls `.save({ session })`.

     - Pre-save hook ensures the journal is balanced. If not, it throws a validation error.

   - On success, commits the transaction and returns `201 Created` with the saved journal.
   - On any error, aborts the transaction and returns an appropriate HTTP error.

2. **`getGLJournals`**

   - Reads query params: `startDate`, `endDate`, `accountCode`, `createdBy`, `page`, `limit`.
   - Constructs a filter object:

     - If `startDate`/`endDate` provided, sets `filter.journalDate.$gte` and/or `$lte`.
     - If `createdBy` provided, adds `filter.createdBy = createdBy`.
     - If `accountCode` provided, adds `filter["lines.accountCode"] = accountCode` to match any journal containing a line with that code.

   - Paginates: `skip = (page−1)*limit`, `limit`.
   - Returns `{ status, meta: { total, page, limit, pages }, data: [ ...journals ] }`.

---

## 3. Express Routes

Create `routes/glJournal.routes.js`:

```js
// routes/glJournal.routes.js

import express from "express";
import {
  createGLJournal,
  getGLJournals,
} from "../controllers/glJournal.controller.js";

const router = express.Router();

/**
 * @route   POST /api/v1/gl-journals
 * @desc    Create a new General Ledger Journal (balanced)
 * @access  Private (attach auth middleware if available)
 */
router.post("/", createGLJournal);

/**
 * @route   GET /api/v1/gl-journals
 * @desc    List / filter GL Journals (paginated)
 * @access  Private
 *
 * Query parameters:
 *   - startDate=YYYY-MM-DD
 *   - endDate=YYYY-MM-DD
 *   - accountCode=SALES_REVENUE
 *   - createdBy=alice
 *   - page=1
 *   - limit=20
 */
router.get("/", getGLJournals);

export default router;
```

Then, in your main server file (e.g. `server.js` or `app.js`), mount these routes:

```js
// server.js (or app.js)

import express from "express";
import mongoose from "mongoose";
import glJournalRoutes from "./routes/glJournal.routes.js";

const app = express();

app.use(express.json());

// … any authentication middleware …

// Mount the GL Journal router:
app.use("/api/v1/gl-journals", glJournalRoutes);

// … error‐handling middleware …

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
```

---

## 4. Detailed FX / Exchange Rate Examples

In practice, you’ll receive data in a “foreign currency” (e.g. USD), but your company’s **functional currency** might be one of:

- **INR** (Indian Rupee), which is _weaker_ than USD (i.e. 1 USD ≈ 75 INR).
- **GBP** (British Pound), which is _stronger_ than USD (i.e. 1 USD ≈ 0.73 GBP).

We store each line’s `currency` and `exchangeRate` (the rate converting that currency into functional currency). We then compute:

> `localAmount = (debit − credit) × exchangeRate`
> and round to two decimals.

Below are two concrete scenarios. We assume:

- A sales invoice for **10 units** of item A at **\$120** (USD) per unit.
- Cost of goods sold is \$50 USD per unit.
- We charge 12% GST on the taxable base (i.e. \[sales − discount − other charges]).

### 4.1 Scenario A: Functional Currency = INR (weaker than USD)

- **Exchange Rate**: 1 USD = 75 INR → so we store `exchangeRate = 75.00`.
- Our user posts the following JSON to create a GL journal (in one lump sum, combining inventory, COGS, sales, GST, AR):

```jsonc
POST /api/v1/gl-journals
Content-Type: application/json

{
  "reference": "Sales Invoice INV_000123 (10 units × $120, 12% GST)",
  "createdBy": "alice",
  "lines": [
    // 1) ACCOUNTS_RECEIVABLE – DR  (net AR in USD = (10 × 120) + GST(12%) = 1200 + 144 = 1344 USD)
    {
      "accountCode": "ACCOUNTS_RECEIVABLE",
      "debit": 1344.00,
      "credit": 0,
      "currency": "USD",
      "exchangeRate": 75.00
      // localAmount will be computed as (1344.00 - 0) * 75.00 = 100800.00 INR
    },

    // 2) SALES_REVENUE – CR  (sales net of tax: 10×120 = 1200 USD)
    {
      "accountCode": "SALES_REVENUE",
      "debit": 0,
      "credit": 1200.00,
      "currency": "USD",
      "exchangeRate": 75.00
      // localAmount = (0 - 1200.00) * 75.00 = -90000.00 INR
    },

    // 3) GST_PAYABLE – CR  (12% of 1200 = 144 USD)
    {
      "accountCode": "GST_PAYABLE",
      "debit": 0,
      "credit": 144.00,
      "currency": "USD",
      "exchangeRate": 75.00
      // localAmount = (0 - 144.00) * 75.00 = -10800.00 INR
    },

    // 4) COGS – DR  (10 × $50 = $500 USD)
    {
      "accountCode": "COGS",
      "debit": 500.00,
      "credit": 0,
      "currency": "USD",
      "exchangeRate": 75.00
      // localAmount = (500.00 - 0) * 75.00 = 37500.00 INR
    },

    // 5) INVENTORY – CR  (reverse cost: 500 USD)
    {
      "accountCode": "INVENTORY",
      "debit": 0,
      "credit": 500.00,
      "currency": "USD",
      "exchangeRate": 75.00
      // localAmount = (0 - 500.00) * 75.00 = -37500.00 INR
    }
  ]
}
```

#### Step-by-step FX / localAmount calculations

1. **Line 1 (AR)**

   - `debit = 1344.00 USD`, `credit = 0`, `exchangeRate = 75.00`.
   - `localAmount = (1344.00 – 0) × 75.00 = 100800.00 INR`.

2. **Line 2 (Sales Revenue)**

   - `debit = 0`, `credit = 1200.00 USD`, `exchangeRate = 75.00`.
   - `localAmount = (0 – 1200.00) × 75.00 = -90000.00 INR`.

3. **Line 3 (GST Payable)**

   - `debit = 0`, `credit = 144.00 USD`, `exchangeRate = 75.00`.
   - `localAmount = (0 – 144.00) × 75.00 = -10800.00 INR`.

4. **Line 4 (COGS)**

   - `debit = 500.00 USD`, `credit = 0`, `exchangeRate = 75.00`.
   - `localAmount = (500.00 – 0) × 75.00 = 37500.00 INR`.

5. **Line 5 (Inventory)**

   - `debit = 0`, `credit = 500.00 USD`, `exchangeRate = 75.00`.
   - `localAmount = (0 – 500.00) × 75.00 = -37500.00 INR`.

Sum of all debits = 1344 + 500 = 1844 USD
Sum of all credits = 1200 + 144 + 500 = 1844 USD → Balanced in USD.

Sum of all localAmounts (INR) = 100800 + (–90000) + (–10800) + 37500 + (–37500)
        = 100800 − 90000 − 10800 + 37500 − 37500
        = 0 INR → Balanced in local currency as well (the local ledger must net zero at time of posting).

When your controller receives this payload, it will:

- Validate each line (exactly one side is > 0).
- Compute missing `localAmount` if needed (we omitted it in JSON, letting the controller compute).
- Create and save the GL journal document.

The saved document will look something like (with `_id`, `createdAt`, `updatedAt`):

```json
{
  "_id": "650fff2a2fde4b1a3ddf791e",
  "journalDate": "2025-06-10T00:00:00.000Z",
  "reference": "Sales Invoice INV_000123 (10 units × $120, 12% GST)",
  "createdBy": "alice",
  "lines": [
    {
      "_id": "650fff2a2fde4b1a3ddf791f",
      "accountCode": "ACCOUNTS_RECEIVABLE",
      "debit": 1344.0,
      "credit": 0,
      "currency": "USD",
      "exchangeRate": 75.0,
      "localAmount": 100800.0,
      "dims": {},
      "extras": {}
    },
    {
      "_id": "650fff2a2fde4b1a3ddf7920",
      "accountCode": "SALES_REVENUE",
      "debit": 0,
      "credit": 1200.0,
      "currency": "USD",
      "exchangeRate": 75.0,
      "localAmount": -90000.0,
      "dims": {},
      "extras": {}
    },
    {
      "_id": "650fff2a2fde4b1a3ddf7921",
      "accountCode": "GST_PAYABLE",
      "debit": 0,
      "credit": 144.0,
      "currency": "USD",
      "exchangeRate": 75.0,
      "localAmount": -10800.0,
      "dims": {},
      "extras": {}
    },
    {
      "_id": "650fff2a2fde4b1a3ddf7922",
      "accountCode": "COGS",
      "debit": 500.0,
      "credit": 0,
      "currency": "USD",
      "exchangeRate": 75.0,
      "localAmount": 37500.0,
      "dims": {},
      "extras": {}
    },
    {
      "_id": "650fff2a2fde4b1a3ddf7923",
      "accountCode": "INVENTORY",
      "debit": 0,
      "credit": 500.0,
      "currency": "USD",
      "exchangeRate": 75.0,
      "localAmount": -37500.0,
      "dims": {},
      "extras": {}
    }
  ],
  "createdAt": "2025-06-10T15:24:10.456Z",
  "updatedAt": "2025-06-10T15:24:10.456Z",
  "__v": 0
}
```

---

### 4.2 Scenario B: Functional Currency = GBP (stronger than USD)

Now assume your company’s functional currency is **GBP**, and the current market rate is:

> **1 USD = 0.73 GBP**
> (That means USD is “weaker” relative to GBP: you get fewer GBP for 1 USD.)

You post that same sale (10 units × \$120 each) and 12% GST. The JSON becomes:

```jsonc
POST /api/v1/gl-journals
Content-Type: application/json

{
  "reference": "Sales Invoice INV_000456 (10 units × $120, 12% GST)",
  "createdBy": "bob",
  "lines": [
    // 1) AR – DR $1,344 USD, @ 0.73 GBP/USD
    {
      "accountCode": "ACCOUNTS_RECEIVABLE",
      "debit": 1344.00,
      "credit": 0,
      "currency": "USD",
      "exchangeRate": 0.73
      // localAmount = (1344) × 0.73 = 981.12 GBP
    },

    // 2) SALES_REVENUE – CR $1,200 USD, @ 0.73
    {
      "accountCode": "SALES_REVENUE",
      "debit": 0,
      "credit": 1200.00,
      "currency": "USD",
      "exchangeRate": 0.73
      // localAmount = (0 – 1200) × 0.73 = –876.00 GBP
    },

    // 3) GST_PAYABLE – CR $144 USD, @ 0.73
    {
      "accountCode": "GST_PAYABLE",
      "debit": 0,
      "credit": 144.00,
      "currency": "USD",
      "exchangeRate": 0.73
      // localAmount = (0 – 144) × 0.73 = –105.12 GBP
    },

    // 4) COGS – DR $500 USD, @ 0.73
    {
      "accountCode": "COGS",
      "debit": 500.00,
      "credit": 0,
      "currency": "USD",
      "exchangeRate": 0.73
      // localAmount = (500 – 0) × 0.73 = 365.00 GBP
    },

    // 5) INVENTORY – CR $500 USD, @ 0.73
    {
      "accountCode": "INVENTORY",
      "debit": 0,
      "credit": 500.00,
      "currency": "USD",
      "exchangeRate": 0.73
      // localAmount = (0 – 500) × 0.73 = –365.00 GBP
    }
  ]
}
```

#### Step-by-step FX / localAmount calculations

1. **Line 1 (AR)**

   - `debit = 1344.00 USD`, `credit = 0`, `exchangeRate = 0.73`.
   - `localAmount = (1344.00 − 0) × 0.73 = 981.12 GBP`.

2. **Line 2 (Sales Revenue)**

   - `debit = 0`, `credit = 1200.00 USD`, `exchangeRate = 0.73`.
   - `localAmount = (0 − 1200.00) × 0.73 = −876.00 GBP`.

3. **Line 3 (GST Payable)**

   - `debit = 0`, `credit = 144.00 USD`, `exchangeRate = 0.73`.
   - `localAmount = (0 − 144.00) × 0.73 = −105.12 GBP`.

4. **Line 4 (COGS)**

   - `debit = 500.00 USD`, `credit = 0`, `exchangeRate = 0.73`.
   - `localAmount = (500.00 − 0) × 0.73 = 365.00 GBP`.

5. **Line 5 (Inventory)**

   - `debit = 0`, `credit = 500.00 USD`, `exchangeRate = 0.73`.
   - `localAmount = (0 − 500.00) × 0.73 = −365.00 GBP`.

Sum of all debits = 1344 + 500 = 1844 USD
Sum of all credits = 1200 + 144 + 500 = 1844 USD → Balanced in USD.

Sum of all localAmount (GBP) = 981.12 + (−876.00) + (−105.12) + 365.00 + (−365.00)
        = 981.12 − 876.00 − 105.12 + 365.00 − 365.00
        = 0.00 GBP → Balanced in local currency as well.

---

## 5. Putting It All Together

Below is a summary of all files and their contents. With these in place, your app can accept arbitrary balanced GL journal postings in any currency, convert them to your functional currency, and store them (with a strict “balanced” check).

### 5.1 `models/glJournal.model.js`

```js
import mongoose, { Schema, model } from "mongoose";

// Sub‐schema for each GL line
const glLineSchema = new Schema(
  {
    accountCode: {
      type: String,
      required: [true, "Each line must specify an accountCode."],
      trim: true,
    },
    debit: {
      type: Number,
      default: 0,
      min: [0, "Debit cannot be negative."],
    },
    credit: {
      type: Number,
      default: 0,
      min: [0, "Credit cannot be negative."],
    },
    currency: {
      type: String,
      required: [true, "Currency is required on each line."],
      trim: true,
    },
    exchangeRate: {
      type: Number,
      required: [true, "Exchange rate is required."],
      min: [0, "Exchange rate must be non-negative."],
    },
    localAmount: {
      type: Number,
      required: [
        true,
        "Local amount is required (debit – credit) × exchangeRate.",
      ],
    },

    // OPTIONAL: dims for inventory linkage
    dims: {
      site: { type: Schema.Types.ObjectId, ref: "Sites" },
      warehouse: { type: Schema.Types.ObjectId, ref: "Warehouses" },
      zone: { type: Schema.Types.ObjectId, ref: "Zones" },
      location: { type: Schema.Types.ObjectId, ref: "Locations" },
      aisle: { type: Schema.Types.ObjectId, ref: "Aisles" },
      rack: { type: Schema.Types.ObjectId, ref: "Racks" },
      shelf: { type: Schema.Types.ObjectId, ref: "Shelves" },
      bin: { type: Schema.Types.ObjectId, ref: "Bins" },
      config: { type: Schema.Types.ObjectId, ref: "Configurations" },
      color: { type: Schema.Types.ObjectId, ref: "Colors" },
      size: { type: Schema.Types.ObjectId, ref: "Sizes" },
      style: { type: Schema.Types.ObjectId, ref: "Styles" },
      version: { type: Schema.Types.ObjectId, ref: "Versions" },
      batch: { type: Schema.Types.ObjectId, ref: "Batches" },
      serial: { type: Schema.Types.ObjectId, ref: "Serials" },
    },

    // Extra metadata
    extras: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: true }
);

// Top‐level GL Journal schema
const glJournalSchema = new Schema(
  {
    journalDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    reference: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: String,
      required: true,
      default: "system",
    },
    lines: {
      type: [glLineSchema],
      required: [true, "A GL Journal must have at least one line."],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "A GL Journal must have at least one line.",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Pre-save: ensure total debits == total credits
glJournalSchema.pre("save", function (next) {
  const journal = this;
  let totalDebits = 0;
  let totalCredits = 0;

  journal.lines.forEach((ln) => {
    totalDebits += ln.debit;
    totalCredits += ln.credit;
  });

  totalDebits = Math.round(totalDebits * 100) / 100;
  totalCredits = Math.round(totalCredits * 100) / 100;

  if (totalDebits !== totalCredits) {
    const err = new mongoose.Error.ValidationError(
      new Error(
        `Unbalanced GL Journal: totalDebits (${totalDebits.toFixed(
          2
        )}) ≠ totalCredits (${totalCredits.toFixed(2)})`
      )
    );
    return next(err);
  }
  next();
});

// Optional index to speed queries
glJournalSchema.index({ journalDate: 1, createdBy: 1 });

export const GLJournalModel =
  mongoose.models.GLJournals || model("GLJournals", glJournalSchema);
```

### 5.2 `controllers/glJournal.controller.js`

```js
import mongoose from "mongoose";
import { GLJournalModel } from "../models/glJournal.model.js";

/**
 * Helper: Round a number to two decimals
 */
function roundToTwo(num) {
  return Math.round((num + Number.EPSILON) * 100) / 100;
}

/**
 * Create a new GL Journal (ensuring totalDebits == totalCredits).
 */
export const createGLJournal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      journalDate = new Date(),
      reference = "",
      createdBy = req.user?.username || "system",
      lines: rawLines,
    } = req.body;

    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      throw new Error("A GL Journal must have at least one line.");
    }

    // 1) Validate and process each line
    const processedLines = rawLines.map((ln, idx) => {
      const {
        accountCode,
        debit = 0,
        credit = 0,
        currency,
        exchangeRate,
        localAmount,
        dims,
        extras,
      } = ln;

      if (
        !accountCode ||
        typeof accountCode !== "string" ||
        accountCode.trim() === ""
      ) {
        throw new Error(
          `Line ${
            idx + 1
          }: accountCode is required and must be a non-empty string.`
        );
      }
      if (!currency || typeof currency !== "string" || currency.trim() === "") {
        throw new Error(
          `Line ${
            idx + 1
          }: currency is required and must be a non-empty string.`
        );
      }
      if (typeof exchangeRate !== "number" || exchangeRate < 0) {
        throw new Error(
          `Line ${idx + 1}: exchangeRate must be a non-negative number.`
        );
      }

      const d = roundToTwo(Number(debit) || 0);
      const c = roundToTwo(Number(credit) || 0);
      if ((d > 0 && c > 0) || (d === 0 && c === 0)) {
        throw new Error(
          `Line ${
            idx + 1
          }: exactly one of debit or credit must be > 0 (got debit=${d}, credit=${c}).`
        );
      }

      // If localAmount not provided, compute as (d - c) × exchangeRate
      let computedLocal =
        typeof localAmount === "number" ? roundToTwo(localAmount) : null;
      if (computedLocal === null) {
        computedLocal = roundToTwo((d - c) * exchangeRate);
      }

      return {
        accountCode: accountCode.trim(),
        debit: d,
        credit: c,
        currency: currency.trim(),
        exchangeRate: roundToTwo(exchangeRate),
        localAmount: computedLocal,
        dims: dims || {},
        extras: extras || {},
      };
    });

    // 2) Build and save the GL Journal
    const glJournal = new GLJournalModel({
      journalDate,
      reference: reference.trim(),
      createdBy: createdBy.trim(),
      lines: processedLines,
    });
    await glJournal.save({ session });

    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: "success",
      data: glJournal,
    });
  } catch (err) {
    await session.abortTransaction();
    session.endSession();

    console.error("❌ createGLJournal Error:", err);
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(422).json({ status: "failure", message: err.message });
    }
    return res.status(400).json({ status: "failure", message: err.message });
  }
};

/**
 * List / filter GL Journals. Supports pagination and optional filters.
 */
export const getGLJournals = async (req, res) => {
  try {
    const {
      startDate,
      endDate,
      accountCode,
      createdBy,
      page = 1,
      limit = 20,
    } = req.query;

    const filter = {};
    if (startDate || endDate) {
      filter.journalDate = {};
      if (startDate) filter.journalDate.$gte = new Date(startDate);
      if (endDate) filter.journalDate.$lte = new Date(endDate);
    }
    if (createdBy) filter.createdBy = createdBy;
    if (accountCode) {
      filter["lines.accountCode"] = accountCode;
    }

    const skip = (Number(page) - 1) * Number(limit);
    const total = await GLJournalModel.countDocuments(filter);

    const journals = await GLJournalModel.find(filter)
      .sort({ journalDate: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();

    return res.status(200).json({
      status: "success",
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        pages: Math.ceil(total / Number(limit)),
      },
      data: journals,
    });
  } catch (err) {
    console.error("❌ getGLJournals Error:", err);
    return res.status(500).json({ status: "failure", message: err.message });
  }
};
```

### Explanation of Controller

- **`roundToTwo(num)`**: Small helper to round a number to two decimal places (avoiding floating‐point imprecision).

- **`createGLJournal`**:

  1. Starts a Mongoose session and a transaction.
  2. Extracts `journalDate`, `reference`, `createdBy`, and `lines: rawLines` from the request body.
  3. Validates `rawLines` is a non‐empty array.
  4. Iterates `rawLines.map((ln, idx) => { … })` to:

     - Ensure `accountCode` is a non-empty string.
     - Ensure `currency` is a non-empty string.
     - Ensure `exchangeRate` is a nonnegative number.
     - Ensure exactly one of `debit` or `credit` is > 0.
     - Compute `localAmount` if not provided: `(debit − credit) × exchangeRate`, then round to two decimals.

  5. Constructs a new `GLJournalModel({ journalDate, reference, createdBy, lines: processedLines })` and `.save({ session })`.

     - Mongoose’s pre-save hook checks that the journal is balanced.

  6. On success, commits the transaction and returns `201 created` with the saved journal.
     On error, aborts the transaction and returns either a `422` (validation error) or `400` (other error).

- **`getGLJournals`**:

  - Reads optional query params to filter:

    - `startDate` and/or `endDate` on `journalDate`.
    - `accountCode` by checking `filter["lines.accountCode"]`.
    - `createdBy`.

  - Paginates with `page` and `limit`.
  - Returns `{ status, meta: { total, page, limit, pages }, data: [ …journals ] }`.

---

### 5.3 `routes/glJournal.routes.js`

```js
// routes/glJournal.routes.js

import express from "express";
import {
  createGLJournal,
  getGLJournals,
} from "../controllers/glJournal.controller.js";

const router = express.Router();

/**
 * @route   POST /api/v1/gl-journals
 * @desc    Create a new GL Journal (balanced entries required)
 * @access  Private (attach your auth middleware)
 */
router.post("/", createGLJournal);

/**
 * @route   GET /api/v1/gl-journals
 * @desc    List / filter GL Journals (paginated)
 * @access  Private
 *
 * Query parameters:
 *   - startDate=YYYY-MM-DD
 *   - endDate=YYYY-MM-DD
 *   - accountCode=SALES_REVENUE
 *   - createdBy=alice
 *   - page=1
 *   - limit=20
 */
router.get("/", getGLJournals);

export default router;
```

And, in your server entry point (`server.js` or `app.js`):

```js
// server.js (or app.js)

import express from "express";
import mongoose from "mongoose";
import glJournalRoutes from "./routes/glJournal.routes.js";

const app = express();
app.use(express.json());

// … any authentication middleware …

// Mount the GL Journal router
app.use("/api/v1/gl-journals", glJournalRoutes);

// … your error handling middleware …

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/your-db";
mongoose
  .connect(MONGODB_URI)
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB connection error:", err));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
```

---

## 6. How Exchange Rates Work (INR vs GBP Examples)

Below are two complete examples, illustrating how a single JSON payload becomes properly balanced in both the foreign currency (USD) and the functional currency (INR or GBP). Each line’s `localAmount` is computed as:

```
localAmount = (debit − credit) × exchangeRate
```

### Example 1: Functional Currency = INR (weaker than USD)

- **Assume**: 1 USD = 75.00 INR → `exchangeRate = 75.00`.
- A sale of **10 units @ \$120** plus 12% GST, cost = \$50/unit.

#### JSON Payload

```jsonc
POST /api/v1/gl-journals
Content-Type: application/json

{
  "reference": "Sales Invoice INV_000123 (10×$120 + 12% GST)",
  "createdBy": "alice",

  "lines": [
    // 1) Accounts Receivable (DR $1,344 USD)
    {
      "accountCode": "ACCOUNTS_RECEIVABLE",
      "debit": 1344.00,
      "credit": 0,
      "currency": "USD",
      "exchangeRate": 75.00
      // localAmount computed: 1344 × 75 = 100800.00 INR
    },

    // 2) Sales Revenue (CR $1,200 USD)
    {
      "accountCode": "SALES_REVENUE",
      "debit": 0,
      "credit": 1200.00,
      "currency": "USD",
      "exchangeRate": 75.00
      // localAmount computed: (0 − 1200) × 75 = −90000.00 INR
    },

    // 3) GST Payable (CR $144 USD)
    {
      "accountCode": "GST_PAYABLE",
      "debit": 0,
      "credit": 144.00,
      "currency": "USD",
      "exchangeRate": 75.00
      // localAmount computed: (0 − 144) × 75 = −10800.00 INR
    },

    // 4) COGS (DR $500 USD)
    {
      "accountCode": "COGS",
      "debit": 500.00,
      "credit": 0,
      "currency": "USD",
      "exchangeRate": 75.00
      // localAmount computed: 500 × 75 = 37500.00 INR
    },

    // 5) Inventory (CR $500 USD)
    {
      "accountCode": "INVENTORY",
      "debit": 0,
      "credit": 500.00,
      "currency": "USD",
      "exchangeRate": 75.00
      // localAmount computed: (0 − 500) × 75 = −37500.00 INR
    }
  ]
}
```

#### How It Balances

- **Total Debits in USD** = 1344 + 500 = 1844 USD

- **Total Credits in USD** = 1200 + 144 + 500 = 1844 USD → balanced in USD.

- **Local (INR) amounts**:

  1. AR line: 1344 × 75 = 100800 INR
  2. Sales line: (−1200) × 75 = −90000 INR
  3. GST line: (−144) × 75 = −10800 INR
  4. COGS line: 500 × 75 = 37500 INR
  5. Inventory line: (−500) × 75 = −37500 INR

  Sum of all localAmounts = 100800 − 90000 − 10800 + 37500 − 37500
           = 0 INR → Balanced in functional currency as well.

When your controller saves this journal, you will store:

```json
{
  "_id": "650fff2a2fde4b1a3ddf791e",
  "journalDate": "2025-06-10T00:00:00.000Z",
  "reference": "Sales Invoice INV_000123 (10×$120 + 12% GST)",
  "createdBy": "alice",
  "lines": [
    {
      "_id": "650fff2a2fde4b1a3ddf791f",
      "accountCode": "ACCOUNTS_RECEIVABLE",
      "debit": 1344.0,
      "credit": 0,
      "currency": "USD",
      "exchangeRate": 75.0,
      "localAmount": 100800.0,
      "dims": {},
      "extras": {}
    },
    {
      "_id": "650fff2a2fde4b1a3ddf7920",
      "accountCode": "SALES_REVENUE",
      "debit": 0,
      "credit": 1200.0,
      "currency": "USD",
      "exchangeRate": 75.0,
      "localAmount": -90000.0,
      "dims": {},
      "extras": {}
    },
    {
      "_id": "650fff2a2fde4b1a3ddf7921",
      "accountCode": "GST_PAYABLE",
      "debit": 0,
      "credit": 144.0,
      "currency": "USD",
      "exchangeRate": 75.0,
      "localAmount": -10800.0,
      "dims": {},
      "extras": {}
    },
    {
      "_id": "650fff2a2fde4b1a3ddf7922",
      "accountCode": "COGS",
      "debit": 500.0,
      "credit": 0,
      "currency": "USD",
      "exchangeRate": 75.0,
      "localAmount": 37500.0,
      "dims": {},
      "extras": {}
    },
    {
      "_id": "650fff2a2fde4b1a3ddf7923",
      "accountCode": "INVENTORY",
      "debit": 0,
      "credit": 500.0,
      "currency": "USD",
      "exchangeRate": 75.0,
      "localAmount": -37500.0,
      "dims": {},
      "extras": {}
    }
  ],
  "createdAt": "2025-06-10T15:24:10.456Z",
  "updatedAt": "2025-06-10T15:24:10.456Z",
  "__v": 0
}
```

### Example 2: Functional Currency = GBP (stronger than USD)

- **Assume**: 1 USD = 0.73 GBP → `exchangeRate = 0.73`.
- Posting the same sale (10 × \$120, 12% GST, cost \$50):

#### JSON Payload

```jsonc
POST /api/v1/gl-journals
Content-Type: application/json

{
  "reference": "Sales Invoice INV_000456 (10×$120 + 12% GST)",
  "createdBy": "bob",

  "lines": [
    // 1) Accounts Receivable (DR $1,344 USD)
    {
      "accountCode": "ACCOUNTS_RECEIVABLE",
      "debit": 1344.00,
      "credit": 0,
      "currency": "USD",
      "exchangeRate": 0.73
      // localAmount = 1344 × 0.73 = 981.12 GBP
    },

    // 2) Sales Revenue (CR $1,200 USD)
    {
      "accountCode": "SALES_REVENUE",
      "debit": 0,
      "credit": 1200.00,
      "currency": "USD",
      "exchangeRate": 0.73
      // localAmount = (0 − 1200) × 0.73 = −876.00 GBP
    },

    // 3) GST Payable (CR $144 USD)
    {
      "accountCode": "GST_PAYABLE",
      "debit": 0,
      "credit": 144.00,
      "currency": "USD",
      "exchangeRate": 0.73
      // localAmount = (0 − 144) × 0.73 = −105.12 GBP
    },

    // 4) COGS (DR $500 USD)
    {
      "accountCode": "COGS",
      "debit": 500.00,
      "credit": 0,
      "currency": "USD",
      "exchangeRate": 0.73
      // localAmount = 500 × 0.73 = 365.00 GBP
    },

    // 5) Inventory (CR $500 USD)
    {
      "accountCode": "INVENTORY",
      "debit": 0,
      "credit": 500.00,
      "currency": "USD",
      "exchangeRate": 0.73
      // localAmount = (0 − 500) × 0.73 = −365.00 GBP
    }
  ]
}
```

#### How It Balances

- **Total Debits in USD** = 1344 + 500 = 1844 USD

- **Total Credits in USD** = 1200 + 144 + 500 = 1844 USD → balanced.

- **Local (GBP) amounts**:

  1. AR: `1344 × 0.73 = 981.12 GBP`
  2. Sales: `(−1200) × 0.73 = −876.00 GBP`
  3. GST: `(−144) × 0.73 = −105.12 GBP`
  4. COGS: `500 × 0.73 = 365.00 GBP`
  5. Inventory: `(−500) × 0.73 = −365.00 GBP`

  Sum localAmounts = 981.12 − 876.00 − 105.12 + 365.00 − 365.00
           = 0.00 GBP → Balanced.

---

## 7. Testing and Validation

1. **Balanced Journal (INR)**

   ```bash
   curl -X POST http://localhost:3000/api/v1/gl-journals \
     -H "Content-Type: application/json" \
     -d '{
           "reference":"Sales Invoice INV_000123 (10×$120 + 12% GST)",
           "createdBy":"alice",
           "lines":[
             {"accountCode":"ACCOUNTS_RECEIVABLE","debit":1344,"credit":0,"currency":"USD","exchangeRate":75},
             {"accountCode":"SALES_REVENUE","debit":0,"credit":1200,"currency":"USD","exchangeRate":75},
             {"accountCode":"GST_PAYABLE","debit":0,"credit":144,"currency":"USD","exchangeRate":75},
             {"accountCode":"COGS","debit":500,"credit":0,"currency":"USD","exchangeRate":75},
             {"accountCode":"INVENTORY","debit":0,"credit":500,"currency":"USD","exchangeRate":75}
           ]
         }'
   ```

   Response:

   ```json
   {
     "status": "success",
     "data": {
       "_id": "650fff2a2fde4b1a3ddf791e",
       "journalDate": "2025-06-10T00:00:00.000Z",
       "reference": "Sales Invoice INV_000123 (10×$120 + 12% GST)",
       "createdBy": "alice",
       "lines": [
         {
           "_id": "650fff2a2fde4b1a3ddf791f",
           "accountCode": "ACCOUNTS_RECEIVABLE",
           "debit": 1344,
           "credit": 0,
           "currency": "USD",
           "exchangeRate": 75,
           "localAmount": 100800,
           "dims": {},
           "extras": {}
         },
         {
           "_id": "650fff2a2fde4b1a3ddf7920",
           "accountCode": "SALES_REVENUE",
           "debit": 0,
           "credit": 1200,
           "currency": "USD",
           "exchangeRate": 75,
           "localAmount": -90000,
           "dims": {},
           "extras": {}
         },
         {
           "_id": "650fff2a2fde4b1a3ddf7921",
           "accountCode": "GST_PAYABLE",
           "debit": 0,
           "credit": 144,
           "currency": "USD",
           "exchangeRate": 75,
           "localAmount": -10800,
           "dims": {},
           "extras": {}
         },
         {
           "_id": "650fff2a2fde4b1a3ddf7922",
           "accountCode": "COGS",
           "debit": 500,
           "credit": 0,
           "currency": "USD",
           "exchangeRate": 75,
           "localAmount": 37500,
           "dims": {},
           "extras": {}
         },
         {
           "_id": "650fff2a2fde4b1a3ddf7923",
           "accountCode": "INVENTORY",
           "debit": 0,
           "credit": 500,
           "currency": "USD",
           "exchangeRate": 75,
           "localAmount": -37500,
           "dims": {},
           "extras": {}
         }
       ],
       "createdAt": "2025-06-10T15:24:10.456Z",
       "updatedAt": "2025-06-10T15:24:10.456Z",
       "__v": 0
     }
   }
   ```

2. **Unbalanced Journal (error)**

   ```bash
   curl -X POST http://localhost:3000/api/v1/gl-journals \
     -H "Content-Type: application/json" \
     -d '{
           "reference":"Bad Journal",
           "createdBy":"bob",
           "lines":[
             {"accountCode":"CASH","debit":500,"credit":0,"currency":"USD","exchangeRate":75},
             {"accountCode":"SALES_REVENUE","debit":0,"credit":400,"currency":"USD","exchangeRate":75}
           ]
         }'
   ```

   Response:

   ```json
   {
     "status": "failure",
     "message": "Unbalanced GL Journal: totalDebits (500.00) ≠ totalCredits (400.00)"
   }
   ```

3. **Balanced Journal (GBP)**

   ```bash
   curl -X POST http://localhost:3000/api/v1/gl-journals \
     -H "Content-Type: application/json" \
     -d '{
           "reference":"Sales Invoice INV_000456 (10×$120 + 12% GST)",
           "createdBy":"bob",
           "lines":[
             {"accountCode":"ACCOUNTS_RECEIVABLE","debit":1344,"credit":0,"currency":"USD","exchangeRate":0.73},
             {"accountCode":"SALES_REVENUE","debit":0,"credit":1200,"currency":"USD","exchangeRate":0.73},
             {"accountCode":"GST_PAYABLE","debit":0,"credit":144,"currency":"USD","exchangeRate":0.73},
             {"accountCode":"COGS","debit":500,"credit":0,"currency":"USD","exchangeRate":0.73},
             {"accountCode":"INVENTORY","debit":0,"credit":500,"currency":"USD","exchangeRate":0.73}
           ]
         }'
   ```

   Response:

   ```json
   {
     "status": "success",
     "data": {
       "_id": "650fff3a5fcc4b1a4defb123",
       "journalDate": "2025-06-10T00:00:00.000Z",
       "reference": "Sales Invoice INV_000456 (10×$120 + 12% GST)",
       "createdBy": "bob",
       "lines": [
         {
           "_id": "650fff3a5fcc4b1a4defb124",
           "accountCode": "ACCOUNTS_RECEIVABLE",
           "debit": 1344,
           "credit": 0,
           "currency": "USD",
           "exchangeRate": 0.73,
           "localAmount": 981.12,
           "dims": {},
           "extras": {}
         },
         {
           "_id": "650fff3a5fcc4b1a4defb125",
           "accountCode": "SALES_REVENUE",
           "debit": 0,
           "credit": 1200,
           "currency": "USD",
           "exchangeRate": 0.73,
           "localAmount": -876.0,
           "dims": {},
           "extras": {}
         },
         {
           "_id": "650fff3a5fcc4b1a4defb126",
           "accountCode": "GST_PAYABLE",
           "debit": 0,
           "credit": 144,
           "currency": "USD",
           "exchangeRate": 0.73,
           "localAmount": -105.12,
           "dims": {},
           "extras": {}
         },
         {
           "_id": "650fff3a5fcc4b1a4defb127",
           "accountCode": "COGS",
           "debit": 500,
           "credit": 0,
           "currency": "USD",
           "exchangeRate": 0.73,
           "localAmount": 365.0,
           "dims": {},
           "extras": {}
         },
         {
           "_id": "650fff3a5fcc4b1a4defb128",
           "accountCode": "INVENTORY",
           "debit": 0,
           "credit": 500,
           "currency": "USD",
           "exchangeRate": 0.73,
           "localAmount": -365.0,
           "dims": {},
           "extras": {}
         }
       ],
       "createdAt": "2025-06-10T15:25:46.789Z",
       "updatedAt": "2025-06-10T15:25:46.789Z",
       "__v": 0
     }
   }
   ```

---

## 8. Summary & Best Practices

1. **Model**:

   - `GLJournalModel` with an array of `glLineSchema`.
   - Pre-save hook enforces **balanced** journal: total debits == total credits.

2. **Controller**:

   - `createGLJournal` verifies each line:

     - Exactly one of `debit` or `credit` > 0.
     - `currency` must be provided.
     - `exchangeRate` must be nonnegative.
     - If `localAmount` not provided, computes it as `(debit – credit) × exchangeRate`.

   - Wraps in a transaction; on any error, aborts the transaction.

3. **Routes**:

   - `POST /api/v1/gl-journals` → create a new journal.
   - `GET  /api/v1/gl-journals` → list/filter journals.

4. **Exchange Rate (`exchangeRate`)**:

   - Always expressed as “1 unit of `currency` = X units of functional currency.”
   - Example when functional currency = INR:

     - `exchangeRate = 75.00` means “1 USD = 75 INR.”

   - Example when functional currency = GBP:

     - `exchangeRate = 0.73` means “1 USD = 0.73 GBP.”

   - `localAmount` is `(debit − credit) × exchangeRate` (rounded to two decimals).

5. **Balancing**:

   - The schema pre-save hook enforces that `sum(debit) == sum(credit)` (to two decimals).
   - If unbalanced, Mongoose throws a validation error; the controller catches it and returns `422 Unprocessable Entity`.

6. **Dimensional Linking** (optional):

   - You can pass a `dims` object on each line if you want to link to specific warehouse, batch, serial, etc.
   - This can be omitted if your GL lines do not require inventory segmentation.

7. **Atomicity**:

   - We wrap the creation in a MongoDB transaction. If you later also create sub-ledger entries (inventory, AR, tax) in the same request, you can run them in the **same** `session` to ensure everything commits or rolls back together.

8. **Pagination & Filtering**:

   - `getGLJournals` accepts `startDate`, `endDate`, `accountCode`, and `createdBy` to filter, and `page`/`limit` for pagination.

With these components in place, your application can reliably record any combination of debit/credit entries (one debit to many credits, many debits to one credit, etc.), handle multiple currencies with accurate exchange rate conversions, and guarantee each journal is balanced both in the foreign currency amounts and in your functional currency.

Feel free to extend:

- **Updating** or **reversing** a GL Journal: create a second journal with reversed lines (swap debit↔credit).
- **Deleting** a GL Journal: ensure you cascade or adjust any sub-ledger postings if necessary.
- **Additional filters** (e.g. by accountCode, date, reference substring) in `getGLJournals`.
- **Security/permissions**: ensure only authorized users can post GL journals.

This pattern is flexible enough to accommodate any future requirements—whether multiple sub-ledger associations, complex multi-currency transaction logic, or partial reversals—while always enforcing the fundamental accounting rule: _“Total Debits = Total Credits.”_
