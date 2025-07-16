Below is a complete, self-contained implementation of a “General Ledger Journal” feature in an Express/Mongoose setup. It allows you to create arbitrarily complex journal entries (one debit to many credits, or many debits to many credits), enforces a balanced‐entry check (total debits == total credits), and exposes a simple REST API (routes, controller, model). Whenever possible, it follows best practices around validation, error handling, and MongoDB transactions.

---

## 1. Mongoose Model (schema)

Create a new file at `models/glJournal.model.js`. This defines:

1. A top‐level `GLJournal` document, which has:

   - `journalDate`
   - `reference` (optional user reference or description)
   - `createdBy` (user or system who made the GL journal)
   - An array of `lines` (sub‐documents), each line containing:

     - `accountCode` (string, required)
     - `debit` (number, default 0)
     - `credit` (number, default 0)
     - `currency` (string, required)
     - `exchangeRate` (number, required; rate to functional currency)
     - `localAmount` (number, required; usually `(debit – credit) × exchangeRate`)
     - `dims` (optional storage/product dimensions exactly as in your voucher model
       if you want to link inventory details; otherwise can be omitted)
     - `extras` (an optional free‐form map for any sub‐ledger references)

2. A pre‐`save` hook that verifies the journal is balanced before saving:

   - i.e. sum of all `debit` values must equal sum of all `credit` values.
   - If unbalanced, Mongoose will throw a validation error.

```js
// models/glJournal.model.js

import mongoose, { Schema, model } from "mongoose";

const glLineSchema = new Schema(
  {
    accountCode: { type: String, required: true, trim: true },
    debit: { type: Number, default: 0, min: 0 },
    credit: { type: Number, default: 0, min: 0 },
    currency: { type: String, required: true, trim: true },
    exchangeRate: { type: Number, required: true, min: 0 },
    localAmount: { type: Number, required: true }, // computed as (debit - credit) × exchangeRate

    // Optional storage/product dims (copy/paste from voucher model if needed)
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

    // any additional metadata
    extras: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: true }
);

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
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "A general ledger journal must have at least one line.",
      },
    },
  },
  {
    timestamps: true,
  }
);

// Pre‐save hook: ensure total debits == total credits
glJournalSchema.pre("save", function (next) {
  const journal = this;
  let totalDebits = 0;
  let totalCredits = 0;

  for (const ln of journal.lines) {
    totalDebits += ln.debit;
    totalCredits += ln.credit;
  }

  // If not balanced, throw a validation error
  if (
    Math.round(totalDebits * 100) / 100 !==
    Math.round(totalCredits * 100) / 100
  ) {
    return next(
      new mongoose.Error.ValidationError(
        new Error(
          `Unbalanced Journal: totalDebits (${totalDebits.toFixed(
            2
          )}) ≠ totalCredits (${totalCredits.toFixed(2)})`
        )
      )
    );
  }

  next();
});

// Create an index if you want to query by date or createdBy, etc.
glJournalSchema.index({ journalDate: 1, createdBy: 1 });

export const GLJournalModel =
  mongoose.models.GLJournals || model("GLJournals", glJournalSchema);
```

### Explanation

- **`glLineSchema`**:

  - `accountCode`: e.g. `"SALES_REVENUE"`, `"CASH"`, `"ACCOUNTS_RECEIVABLE"`, etc.
  - `debit` and `credit`: each line must have at least one side = 0; they cannot both be nonzero.
    We’ll rely on business logic in the controller to ensure you set exactly one of them (debit > 0 xor credit > 0).
  - `currency` and `exchangeRate` allow you to record FX information.
  - `localAmount` is a computed field that must equal `(debit – credit) × exchangeRate`. You supply it on creation; we do not recompute it automatically in a hook, but you must calculate it in your controller before saving.
  - `dims` block is exactly the same shape you used in your voucher model—this is optional. If you do not need it for purely financial journals, you can drop it. But usually a GL posting line for inventory will want to capture exactly which warehouse/location it came from.

- **`glJournalSchema.pre("save")`**:

  - Loops through `journal.lines`, sums `debit` and `credit` to ensure they are equal (to two decimal places). If they are not, Mongoose throws a validation error, preventing the document from saving.

- **Index** on `(journalDate, createdBy)` helps if you want to quickly list journals by date or user.

---

## 2. Controller Logic

Create a file at `controllers/glJournal.controller.js`. This will export two main methods:

1. `createGLJournal`:

   - Expects a JSON body containing:

     ```js
     {
       "journalDate": "2025-06-01T00:00:00.000Z", // optional (defaults to now)
       "reference": "Month‐end adjustment",
       "createdBy": "alice",
       "lines": [
         {
           "accountCode": "CASH",
           "debit": 1000,
           "credit": 0,
           "currency": "USD",
           "exchangeRate": 1.0,
           "localAmount": 1000.0
         },
         {
           "accountCode": "SALES_REVENUE",
           "debit": 0,
           "credit": 1000,
           "currency": "USD",
           "exchangeRate": 1.0,
           "localAmount": -1000.0
         }
       ]
     }
     ```

   - Validates that each line has exactly one side (debit or credit) > 0, calculates `localAmount` if missing, and lets Mongoose’s pre‐save check handle balancing.
   - Wraps everything in a MongoDB session (transaction) so that in future you can expand to update related sub‐ledgers, etc.

2. `getGLJournals`:

   - A paginated listing (with a basic filter on date range or accountCode, if needed).
   - You can extend filters at will.

```js
// controllers/glJournal.controller.js

import mongoose from "mongoose";
import { GLJournalModel } from "../models/glJournal.model.js";

/**
 * Create a new General Ledger Journal.
 * Body: {
 *   journalDate?, reference?, createdBy?, lines: [ {accountCode,debit,credit,currency,exchangeRate, localAmount, dims?} ]
 * }
 */
export const createGLJournal = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const {
      journalDate = new Date(),
      reference = "",
      createdBy = req.user?.username || "system", // you can integrate with auth
      lines: rawLines,
    } = req.body;

    if (!Array.isArray(rawLines) || rawLines.length === 0) {
      throw new Error("A journal must have at least one line.");
    }

    // 1) Validate each line’s structure, compute/validate localAmount
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

      if (!accountCode || typeof accountCode !== "string") {
        throw new Error(`Line ${idx + 1}: accountCode is required.`);
      }
      if (!currency || typeof currency !== "string") {
        throw new Error(`Line ${idx + 1}: currency is required.`);
      }
      if (typeof exchangeRate !== "number" || exchangeRate < 0) {
        throw new Error(
          `Line ${idx + 1}: exchangeRate must be a non‐negative number.`
        );
      }
      if ((debit > 0 && credit > 0) || (debit === 0 && credit === 0)) {
        throw new Error(
          `Line ${
            idx + 1
          }: exactly one of debit or credit must be > 0 (got debit=${debit}, credit=${credit}).`
        );
      }

      // If localAmount is not provided, compute it as (debit - credit) × exchangeRate, rounding to 2 decimals:
      let computedLocal = localAmount;
      if (typeof computedLocal !== "number") {
        computedLocal = Math.round((debit - credit) * exchangeRate * 100) / 100;
      }

      return {
        accountCode: accountCode.trim(),
        debit: Math.round(debit * 100) / 100,
        credit: Math.round(credit * 100) / 100,
        currency: currency.trim(),
        exchangeRate: Math.round(exchangeRate * 1000000) / 1000000, // six‐digit precision
        localAmount: computedLocal,
        dims: dims || {},
        extras: extras || {},
      };
    });

    // 2) Build the GLJournal document
    const glJournal = new GLJournalModel({
      journalDate,
      reference: reference.trim(),
      createdBy: createdBy.trim(),
      lines: processedLines,
    });

    // 3) Save (pre-save hook will enforce balancing)
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
    // If ValidationError, respond 422
    if (err instanceof mongoose.Error.ValidationError) {
      return res.status(422).json({ status: "failure", message: err.message });
    }
    return res.status(400).json({ status: "failure", message: err.message });
  }
};

/**
 * List / filter GL Journals (paginated).
 * Query params supported:
 *   - startDate (ISO)
 *   - endDate   (ISO)
 *   - accountCode
 *   - createdBy
 *   - page (1-based), limit
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
    if (createdBy) {
      filter.createdBy = createdBy;
    }
    if (accountCode) {
      // We want to find any journal that has at least one line with this accountCode
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

### Explanation

1. **`createGLJournal`**:

   - Opens a Mongoose session and transaction (`session.startTransaction()`).
   - Validates each line in `req.body.lines`, ensuring exactly one of `debit` or `credit` is positive.
   - Computes `localAmount` if not provided.
   - Creates a new `GLJournalModel` instance and calls `.save({ session })`.

     - The pre‐save hook in the model ensures total debits = total credits.

   - Commits or aborts the transaction based on success/failure.

2. **`getGLJournals`**:

   - Accepts optional query filters (`startDate`, `endDate`, `accountCode`, `createdBy`) to filter the journals.
   - Performs pagination (`page`, `limit`), returns a `meta` object and the array of matching journal documents.

---

## 3. Routes (Express)

Finally, wire these controller methods up in an Express router. Create a file at `routes/glJournal.routes.js`:

```js
// routes/glJournal.routes.js

import express from "express";
import {
  createGLJournal,
  getGLJournals,
} from "../controllers/glJournal.controller.js";

const router = express.Router();

/**
 * @route   POST /api/v1/gl‐journals
 * @desc    Create a new General Ledger Journal (balanced entries)
 * @access  Private (you can hook in authentication middleware if needed)
 */
router.post("/", createGLJournal);

/**
 * @route   GET /api/v1/gl‐journals
 * @desc    List/filter GL Journals (paginated)
 * @access  Private
 *
 * Query parameters:
 *   - startDate=YYYY‐MM‐DD
 *   - endDate=YYYY‐MM‐DD
 *   - accountCode=SALES_REVENUE
 *   - createdBy=alice
 *   - page=1
 *   - limit=20
 */
router.get("/", getGLJournals);

export default router;
```

Then, in your main server file (often `app.js` or `server.js`), mount the router:

```js
// server.js or app.js

import express from "express";
import mongoose from "mongoose";
// … other imports …
import glJournalRoutes from "./routes/glJournal.routes.js";

const app = express();

app.use(express.json());

// … your existing middleware, auth, etc. …

// Mount GL Journal endpoint:
app.use("/api/v1/gl‐journals", glJournalRoutes);

// … error handling middleware, etc. …

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server listening on port ${PORT}`);
});
```

---

## 4. How It Works in Practice

1. **Creating a Journal**
   Request:

   ```http
   POST /api/v1/gl-journals
   Content-Type: application/json

   {
     "journalDate": "2025-06-10T00:00:00.000Z",
     "reference": "Record sales on Invoice INV_000123",
     "createdBy": "alice",
     "lines": [
       {
         "accountCode": "ACCOUNTS_RECEIVABLE",
         "debit": 1210,
         "credit": 0,
         "currency": "USD",
         "exchangeRate": 1.0
       },
       {
         "accountCode": "SALES_REVENUE",
         "debit": 0,
         "credit": 1000,
         "currency": "USD",
         "exchangeRate": 1.0
       },
       {
         "accountCode": "GST_PAYABLE",
         "debit": 0,
         "credit": 210,
         "currency": "USD",
         "exchangeRate": 1.0
       }
     ]
   }
   ```

   - The controller validates each line, computes `localAmount` for each line as `(debit – credit) × exchangeRate`.
     e.g. for line #1: `(1210 – 0) × 1.0 = 1210.00`
   - The pre‐save hook checks:

     ```
     totalDebits  = 1210
     totalCredits = 1000 + 210 = 1210
     → balanced
     ```

   - If unbalanced, you’d get:

     ```
     422 Unprocessable Entity
     {
       "status":"failure",
       "message":"Unbalanced Journal: totalDebits (1210.00) ≠ totalCredits (1200.00)"
     }
     ```

   - On success, you receive:

     ```json
     {
       "status":"success",
       "data": {
         "_id": "650f1a8e9adf4b5c8ef6912a",
         "journalDate":"2025-06-10T00:00:00.000Z",
         "reference":"Record sales on Invoice INV_000123",
         "createdBy":"alice",
         "lines":[ … <each line with localAmount> … ],
         "createdAt": "2025-06-10T14:32:30.123Z",
         "updatedAt": "2025-06-10T14:32:30.123Z",
         "__v": 0
       }
     }
     ```

2. **Listing/Filtering Journals**
   Request:

   ```http
   GET /api/v1/gl-journals?startDate=2025-06-01&endDate=2025-06-30&page=1&limit=10
   ```

   Response:

   ```json
   {
     "status": "success",
     "meta": {
       "total": 42,
       "page": 1,
       "limit": 10,
       "pages": 5
     },
     "data": [
       {
         "_id":"650f1a8e9adf4b5c8ef6912a",
         "journalDate":"2025-06-10T00:00:00.000Z",
         "reference":"Record sales on Invoice INV_000123",
         "createdBy":"alice",
         "lines":[ … ],
         "createdAt":"2025-06-10T14:32:30.123Z",
         "updatedAt":"2025-06-10T14:32:30.123Z"
       },
       { /* next journal… */ }
     ]
   }
   ```

---

## 5. Best Practices & Notes

1. **Strict Debit/Credit Validation**

   - Each line enforces `debit >= 0`, `credit >= 0`, and **exactly one** side must be positive.
   - The pre‐save hook enforces the “balanced” rule across all lines.

2. **FX Handling**

   - Always store `currency` and `exchangeRate` on each line.
   - `localAmount` is your “functional‐currency” value = `(debit – credit) × exchangeRate`.
   - The ledger controller does not recalc FX; it trusts the caller to pass correct `exchangeRate` and `localAmount`.

3. **Dimensions (dims)**

   - If you need to attach a line to a particular warehouse/location (for inventory‐related journals), you have the full `dims` block in your schema. If this is not needed for purely financial journals, you can omit or leave it optional.

4. **Microservice / Separation of Concerns**

   - The “sub-ledger” (inventory, AR, tax, WHT, etc.) should each be recorded separately in their respective collections (e.g. `InventoryTransactionModel`, `ARTransactionModel`, `TaxTransactionModel`, etc.).
   - Once all sub-ledger entries exist, you call the GL controller to “mirror” those sub‐ledgers into one balanced GL journal.

5. **Transactions**

   - We opened a Mongoose session and used a `transaction()` around the GL journal creation. In real life, if you also need to create multiple sub‐ledgers (inventory, AR, etc.) in the same operation, you should wrap all of them in the **same** session so that either all sub-ledgers **and** the GL journal commit, or all are rolled back.

6. **Extensibility**

   - If you later want to add a “reverse” operation for a GL journal, simply copy each line, swap `debit ↔ credit`, and prefix `reference` with “Reversal of XXX”. Then the pre‐save hook will still force you to remain balanced.

7. **Indexing & Query Patterns**

   - We added an index on `(journalDate, createdBy)` so you can quickly list month‐end journals for a given user.
   - If you often search by a specific `accountCode`, add an index on `"lines.accountCode": 1`.

---

### Summarized Folder Structure

```
project-root/
├── controllers/
│   └── glJournal.controller.js
├── models/
│   └── glJournal.model.js
├── routes/
│   └── glJournal.routes.js
├── server.js  (or app.js)
└── package.json
```

---

## 6. Example: Posting an Unbalanced Journal

If you submit:

```json
POST /api/v1/gl-journals
{
  "reference": "Test",
  "createdBy": "bob",
  "lines": [
    { "accountCode": "CASH", "debit": 500, "credit": 0, "currency": "USD", "exchangeRate": 1.0 },
    { "accountCode": "SALES_REVENUE", "debit": 0, "credit": 400, "currency": "USD", "exchangeRate": 1.0 }
  ]
}
```

Because 500 (debits) ≠ 400 (credits), you’ll receive:

```json
422 Unprocessable Entity
{
  "status": "failure",
  "message": "Unbalanced Journal: totalDebits (500.00) ≠ totalCredits (400.00)"
}
```

---

### 7. Example: Posting a Balanced Journal with Mixed FX

```json
POST /api/v1/gl-journals
{
  "reference": "Record FX gain on sale",
  "createdBy": "charlie",
  "lines": [
    {
      "accountCode": "ACCOUNTS_RECEIVABLE",
      "debit": 1200,
      "credit": 0,
      "currency": "EUR",
      "exchangeRate": 1.10
    },
    {
      "accountCode": "SALES_REVENUE",
      "debit": 0,
      "credit": 1000,
      "currency": "EUR",
      "exchangeRate": 1.10
    },
    {
      "accountCode": "FX_GAIN",
      "debit": 0,
      "credit": 200,
      "currency": "EUR",
      "exchangeRate": 1.10
    }
  ]
}
```

- For each line, your controller recomputes `localAmount` as `(debit – credit) × exchangeRate`:

  1. `"ACCOUNTS_RECEIVABLE"`: `(1200 – 0) × 1.10 = 1320.00`
  2. `"SALES_REVENUE"`: `(0 – 1000) × 1.10 = –1100.00`
  3. `"FX_GAIN"`: `(0 – 200) × 1.10 = –220.00`

- The sum of local amounts is `1320 + (–1100) + (–220) = 0` → balanced at the functional currency level as well.

Because total debits = 1200 and total credits = 1000 + 200 = 1200, the journal is balanced, so it will be saved successfully.

---

### 8. Summary

- **Model:** `GLJournalModel`, with a `pre("save")` hook that enforces that total debits = total credits.
- **Controller:** `createGLJournal` (validates each line, calculates `localAmount`, runs in a transaction), `getGLJournals` (list/filter).
- **Routes:** `POST /api/v1/gl-journals`, `GET /api/v1/gl-journals`.

This pattern gives you a flexible, robust GL‐journal posting mechanism that can accommodate:

- Many‐to‐many debits/credits
- FX conversions
- Inventory sub‐ledger dims
- Arbitrary extra sub‐ledger references (via `extras` on each line)
- Easy future enhancement (e.g. reverse‐journal, update, delete)

Feel free to adapt the `glLineSchema.dims` block, indexes, or validation logic to exactly match your chart of accounts, dimension tables, or business rules.

---
