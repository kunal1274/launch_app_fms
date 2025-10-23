Below is a complete controller and routing setup for your **Bank** model, mirroring the patterns we used for **Account** (sites/warehouses), including:

1. Get All Banks (flat or hierarchical; optionally include archived)
2. Get One Bank by ID
3. Create One Bank
4. Bulk Create Banks
5. Update One Bank by ID
6. Bulk Update Banks
7. “Delete” (archive) One Bank
8. Bulk Delete (archive) Banks
9. Archive One Bank (alias)
10. Unarchive One Bank

You’ll find:

- **`controllers/bank.controller.js`**: all controller functions.
- **`routes/bank.routes.js`**: route definitions.

Make sure you have added an `isArchived` field to your **Bank** schema (as shown below), so that “delete” simply sets `isArchived = true`.

---

## 1. Updated Bank Model (with `isArchived`)

```js
// models/bank.model.js

import mongoose, { Schema, model } from "mongoose";

const bankSchema = new Schema(
  {
    systemCode: {
      type: String,
      required: false,
      // auto-generated like "Bank_001", "Bank_002", etc.
    },
    accountCode: {
      type: String,
      required: [
        false,
        "⚠️ Bank Account or UPI or Crypto Number is mandatory and it should be unique",
      ],
      unique: true,
      validate: {
        validator: (v) => /^[A-Za-z0-9@._-]+$/.test(v),
        message:
          "⚠️ Bank Account or UPI or Crypto Number can only contain alphanumeric characters, dashes, underscores, '@', or '.'",
      },
    },
    type: {
      type: String,
      required: true,
      enum: {
        values: ["BankAndUpi", "Cash", "Bank", "UPI", "Crypto", "Barter"],
        message:
          "⚠️ {VALUE} is not a valid type. Use 'Cash', 'Bank', 'UPI', 'Crypto', or 'Barter'.",
      },
      default: "Bank",
    },
    parentAccount: {
      // if bank accounts are hierarchical
      type: Schema.Types.ObjectId,
      ref: "Banks",
      default: null,
    },
    linkedCoaAccount: {
      // every bank account must link to a COA leaf‐account
      type: Schema.Types.ObjectId,
      ref: "Accounts",
      required: [
        true,
        "Every BankAccount must specify the corresponding AccountModel _id",
      ],
    },
    upi: {
      // if type is UPI or BankAndUpi, user may enter UPI ID
      type: String,
      required: false,
    },
    bankName: {
      type: String,
      required: false,
    },
    accountHolderName: {
      type: String,
      required: false,
    },
    ifsc: {
      type: String,
      required: false,
    },
    swift: {
      type: String,
      required: false,
    },
    active: {
      type: Boolean,
      required: true,
      default: false,
    },
    qrDetails: {
      // e.g. UPI QR string
      type: String,
      default: "",
    },
    isLeaf: {
      // indicates if this bank node is a leaf (no children) or can have children
      type: Boolean,
      required: true,
      default: true,
    },

    currency: {
      type: String,
      required: true,
      default: "INR",
      trim: true,
      // you may tighten to valid ISO codes if you wish
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    ledgerGroup: {
      // to group multiple bank accounts under one ledger code
      type: String,
      default: "",
      trim: true,
    },
    // ─── archive‐flag ───
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// (Optional) for returning hierarchical structure
const bankNodeSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, ref: "Banks" },
    accountCode: { type: String, required: true },
    bankName: { type: String, required: true },
    children: [
      /* recursive embedding if needed */
    ],
  },
  { _id: false }
);

// Unique index on accountCode
bankSchema.index({ accountCode: 1 }, { unique: true });

// Pre‐save: if parentAccount is set, ensure parent exists and is non‐leaf
bankSchema.pre("save", async function (next) {
  if (this.parentAccount) {
    const parent = await mongoose.model("Banks").findById(this.parentAccount);
    if (!parent) {
      return next(
        new Error(`parentBankAccount ${this.parentAccount} does not exist.`)
      );
    }
    if (parent.isLeaf) {
      return next(
        new Error(
          `Cannot assign parentBankAccount ${this.parentAccount} because it is a leaf node.`
        )
      );
    }
  }
  next();
});

export const BankModel = mongoose.models.Banks || model("Banks", bankSchema);
```

---

## 2. Bank Controller

Create `controllers/bank.controller.js`:

```js
// controllers/bank.controller.js

import mongoose from "mongoose";
import { BankModel } from "../models/bank.model.js";

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * 1) GET ALL BANKS
 *    Query params:
 *      - includeArchived=true  (optional; default: false)
 *      - hierarchy=true        (optional; default: false)
 */
export const getAllBanks = async (req, res) => {
  try {
    const { includeArchived, hierarchy } = req.query;
    const filter = {};

    if (includeArchived !== "true") {
      filter.isArchived = false;
    }

    const banks = await BankModel.find(filter).sort({ accountCode: 1 }).lean();

    if (hierarchy === "true") {
      // Build a map of id → node
      const nodeMap = {};
      banks.forEach((b) => {
        nodeMap[b._id.toString()] = {
          _id: b._id,
          accountCode: b.accountCode,
          bankName: b.bankName,
          children: [],
        };
      });

      const roots = [];
      banks.forEach((b) => {
        if (b.parentAccount) {
          const pid = b.parentAccount.toString();
          if (nodeMap[pid]) {
            nodeMap[pid].children.push(nodeMap[b._id.toString()]);
          }
        } else {
          roots.push(nodeMap[b._id.toString()]);
        }
      });

      return res.status(200).json({ status: "success", data: roots });
    }

    return res.status(200).json({ status: "success", data: banks });
  } catch (error) {
    console.error("❌ getAllBanks Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 2) GET ONE BANK BY ID
 */
export const getBankById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid Bank ID." });
    }
    const bank = await BankModel.findById(id).lean();
    if (!bank) {
      return res
        .status(404)
        .json({ status: "failure", message: "Bank not found." });
    }
    return res.status(200).json({ status: "success", data: bank });
  } catch (error) {
    console.error("❌ getBankById Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 3) CREATE ONE BANK
 */
export const createBank = async (req, res) => {
  try {
    const {
      systemCode,
      accountCode,
      type,
      parentAccount,
      linkedCoaAccount,
      upi,
      bankName,
      accountHolderName,
      ifsc,
      swift,
      active,
      qrDetails,
      isLeaf,
      currency,
      description,
      ledgerGroup,
    } = req.body;

    // Basic checks
    if (!type || !linkedCoaAccount || !currency) {
      return res.status(400).json({
        status: "failure",
        message:
          "Fields `type`, `linkedCoaAccount` (ObjectId), and `currency` are required.",
      });
    }
    if (!isValidObjectId(linkedCoaAccount)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid linkedCoaAccount ID." });
    }
    if (parentAccount && !isValidObjectId(parentAccount)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid parentAccount ID." });
    }

    const newBank = new BankModel({
      systemCode: systemCode || null,
      accountCode: accountCode ? accountCode.trim() : undefined,
      type,
      parentAccount: parentAccount || null,
      linkedCoaAccount,
      upi: upi || "",
      bankName: bankName || "",
      accountHolderName: accountHolderName || "",
      ifsc: ifsc || "",
      swift: swift || "",
      active: active === true,
      qrDetails: qrDetails || "",
      isLeaf: isLeaf === false ? false : true,
      currency,
      description: description || "",
      ledgerGroup: ledgerGroup || "",
    });

    await newBank.save();
    return res
      .status(201)
      .json({ status: "success", message: "Bank created.", data: newBank });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        status: "failure",
        message:
          "Duplicate accountCode. That bank account code already exists.",
      });
    }
    console.error("❌ createBank Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 4) BULK CREATE BANKS
 *    Expects: { data: [ { /* bank fields *\/ }, ... ] }
 */
export const bulkCreateBanks = async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: "Request body must contain a non-empty `data` array.",
      });
    }

    const inserts = data.map((b) => {
      // Basic normalization
      return {
        systemCode: b.systemCode || null,
        accountCode: b.accountCode ? b.accountCode.trim() : undefined,
        type: b.type,
        parentAccount: b.parentAccount || null,
        linkedCoaAccount: b.linkedCoaAccount,
        upi: b.upi || "",
        bankName: b.bankName || "",
        accountHolderName: b.accountHolderName || "",
        ifsc: b.ifsc || "",
        swift: b.swift || "",
        active: b.active === true,
        qrDetails: b.qrDetails || "",
        isLeaf: b.isLeaf === false ? false : true,
        currency: b.currency,
        description: b.description || "",
        ledgerGroup: b.ledgerGroup || "",
      };
    });

    // Insert many (one failure aborts entire batch)
    const inserted = await BankModel.insertMany(inserts, { ordered: true });
    return res.status(201).json({
      status: "success",
      message: `Inserted ${inserted.length} bank(s).`,
      data: inserted,
    });
  } catch (error) {
    console.error("❌ bulkCreateBanks Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 5) UPDATE ONE BANK BY ID
 */
export const updateBankById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid Bank ID." });
    }

    // Only allow certain fields to be updated
    const allowedFields = [
      "systemCode",
      "accountCode",
      "type",
      "parentAccount",
      "linkedCoaAccount",
      "upi",
      "bankName",
      "accountHolderName",
      "ifsc",
      "swift",
      "active",
      "qrDetails",
      "isLeaf",
      "currency",
      "description",
      "ledgerGroup",
      "isArchived",
    ];
    const updates = {};
    for (let f of allowedFields) {
      if (f in req.body) {
        updates[f] = req.body[f];
      }
    }
    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        status: "failure",
        message: "No valid fields supplied for update.",
      });
    }

    // Validate object IDs if present
    if (updates.parentAccount && !isValidObjectId(updates.parentAccount)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid parentAccount ID." });
    }
    if (
      updates.linkedCoaAccount &&
      !isValidObjectId(updates.linkedCoaAccount)
    ) {
      return res.status(400).json({
        status: "failure",
        message: "Invalid linkedCoaAccount ID.",
      });
    }

    const updated = await BankModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res
        .status(404)
        .json({ status: "failure", message: "Bank not found." });
    }
    return res.status(200).json({
      status: "success",
      message: "Bank updated.",
      data: updated,
    });
  } catch (error) {
    console.error("❌ updateBankById Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 6) BULK UPDATE BANKS
 *    Expects: { data: [ { _id, /* fields *\/ }, … ] }
 */
export const bulkUpdateBanks = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      throw new Error("Request body must contain a non-empty `data` array.");
    }

    const results = [];
    for (let entry of data) {
      const { _id, ...fields } = entry;
      if (!isValidObjectId(_id)) {
        throw new Error(`Invalid _id: ${_id}`);
      }

      const allowedFields = [
        "systemCode",
        "accountCode",
        "type",
        "parentAccount",
        "linkedCoaAccount",
        "upi",
        "bankName",
        "accountHolderName",
        "ifsc",
        "swift",
        "active",
        "qrDetails",
        "isLeaf",
        "currency",
        "description",
        "ledgerGroup",
        "isArchived",
      ];
      const updates = {};
      for (let f of allowedFields) {
        if (f in fields) {
          updates[f] = fields[f];
        }
      }
      if (Object.keys(updates).length === 0) {
        throw new Error(`No valid fields to update for ID ${_id}`);
      }

      if (updates.parentAccount && !isValidObjectId(updates.parentAccount)) {
        throw new Error(`Invalid parentAccount ID: ${updates.parentAccount}`);
      }
      if (
        updates.linkedCoaAccount &&
        !isValidObjectId(updates.linkedCoaAccount)
      ) {
        throw new Error(
          `Invalid linkedCoaAccount ID: ${updates.linkedCoaAccount}`
        );
      }

      const updated = await BankModel.findByIdAndUpdate(_id, updates, {
        new: true,
        runValidators: true,
        session,
      });
      if (!updated) {
        throw new Error(`Bank not found: ${_id}`);
      }
      results.push(updated);
    }

    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({
      status: "success",
      message: `Updated ${results.length} bank(s).`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ bulkUpdateBanks Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 7) “DELETE” ONE BANK (soft‐delete → archive)
 *    Set isArchived = true
 */
export const deleteBankById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid Bank ID." });
    }
    const bank = await BankModel.findByIdAndUpdate(
      id,
      { isArchived: true },
      { new: true }
    );
    if (!bank) {
      return res
        .status(404)
        .json({ status: "failure", message: "Bank not found." });
    }
    return res.status(200).json({
      status: "success",
      message: "Bank archived.",
      data: bank,
    });
  } catch (error) {
    console.error("❌ deleteBankById Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 8) BULK DELETE BANKS (soft‐delete → archive)
 *    Expects: { ids: [ "id1", "id2", … ] }
 */
export const bulkDeleteBanks = async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: "Request body must contain a non-empty `ids` array.",
      });
    }
    // Validate each ID
    for (let id of ids) {
      if (!isValidObjectId(id)) {
        return res
          .status(400)
          .json({ status: "failure", message: `Invalid ID: ${id}` });
      }
    }
    const result = await BankModel.updateMany(
      { _id: { $in: ids } },
      { isArchived: true }
    );
    return res.status(200).json({
      status: "success",
      message: `Archived ${result.nModified} bank(s).`,
    });
  } catch (error) {
    console.error("❌ bulkDeleteBanks Error:", error);
    return res.status(500).json({ status: "failure", message: error.message });
  }
};

/**
 * 9) ARCHIVE ONE BANK (alias for deleteBankById)
 */
export const archiveBankById = async (req, res) => {
  return deleteBankById(req, res);
};

/**
 * 10) UNARCHIVE ONE BANK
 */
export const unarchiveBankById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid Bank ID." });
    }
    const bank = await BankModel.findByIdAndUpdate(
      id,
      { isArchived: false },
      { new: true }
    );
    if (!bank) {
      return res
        .status(404)
        .json({ status: "failure", message: "Bank not found." });
    }
    return res.status(200).json({
      status: "success",
      message: "Bank unarchived.",
      data: bank,
    });
  } catch (error) {
    console.error("❌ unarchiveBankById Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};
```

---

## 3. Bank Routes

Create `routes/bank.routes.js`:

```js
// routes/bank.routes.js

import express from "express";
import {
  getAllBanks,
  getBankById,
  createBank,
  bulkCreateBanks,
  updateBankById,
  bulkUpdateBanks,
  deleteBankById,
  bulkDeleteBanks,
  archiveBankById,
  unarchiveBankById,
} from "../controllers/bank.controller.js";

const router = express.Router();

// 1. GET ALL BANKS
//    Optional query: ?includeArchived=true  ?hierarchy=true
router.get("/", getAllBanks);

// 2. GET ONE BANK BY ID
router.get("/:id", getBankById);

// 3. CREATE ONE BANK
router.post("/", createBank);

// 4. BULK CREATE BANKS
router.post("/bulk", bulkCreateBanks);

// 5. UPDATE ONE BANK BY ID
router.patch("/:id", updateBankById);

// 6. BULK UPDATE BANKS
router.patch("/bulk", bulkUpdateBanks);

// 7. “DELETE” (archive) ONE BANK
router.delete("/:id", deleteBankById);

// 8. BULK DELETE (archive) BANKS
router.delete("/bulk", bulkDeleteBanks);

// 9. ARCHIVE ONE BANK (alias)
router.patch("/:id/archive", archiveBankById);

// 10. UNARCHIVE ONE BANK
router.patch("/:id/unarchive", unarchiveBankById);

export default router;
```

Then in your main app (e.g. `app.js`), mount these routes:

```js
// app.js (excerpt)

import express from "express";
import bankRoutes from "./routes/bank.routes.js";

const app = express();
app.use(express.json());

// … any middleware (auth, logging) …

app.use("/api/v1/banks", bankRoutes);

// … error handlers, etc. …

export default app;
```

---

## 4. How to Use These Endpoints

1. **Get all (flat)**

   ```
   GET /api/v1/banks
   ```

   → returns all non‐archived bank accounts in a flat array.

2. **Get all (including archived)**

   ```
   GET /api/v1/banks?includeArchived=true
   ```

3. **Get all (hierarchy)**

   ```
   GET /api/v1/banks?hierarchy=true
   ```

4. **Get one bank**

   ```
   GET /api/v1/banks/64b1234abcd567890ef12345
   ```

5. **Create one bank**

   ```
   POST /api/v1/banks
   Content-Type: application/json

   {
     "systemCode": "Bank_007",
     "accountCode": "HDFC123456",
     "type": "BankAndUpi",
     "parentAccount": "64b0000aaa000bbb000cc111", // optional
     "linkedCoaAccount": "64a7f9d2345678abcd90ef12",
     "upi": "9876543210@upi",
     "bankName": "HDFC Bank Ltd.",
     "accountHolderName": "Acme Co.",
     "ifsc": "HDFC0001234",
     "swift": "HDFCINBB",
     "active": true,
     "qrDetails": "upi://pay?pn=AcmeCo@hdfcbank",
     "isLeaf": true,
     "currency": "INR",
     "description": "Primary operational account",
     "ledgerGroup": "OPERATIONS"
   }
   ```

6. **Bulk create**

   ```
   POST /api/v1/banks/bulk
   Content-Type: application/json

   {
     "data": [
       {
         "accountCode": "HDFC777777",
         "type": "Bank",
         "linkedCoaAccount": "64a7f9d2345678abcd90ef12",
         "bankName": "HDFC Bank Qwik",
         "active": true,
         "currency": "INR",
         "description": "Savings account",
         "ledgerGroup": "OPERATIONS"
       },
       {
         "accountCode": "BOBI986754",
         "type": "Bank",
         "linkedCoaAccount": "64a7f9d2345678abcd90ef13",
         "bankName": "Bank of Barter India",
         "active": false,
         "currency": "USD",
         "description": "Foreign currency account",
         "ledgerGroup": "FINANCE"
       }
     ]
   }
   ```

7. **Update one**

   ```
   PATCH /api/v1/banks/64b1234abcd567890ef12345
   Content-Type: application/json

   {
     "bankName": "HDFC Bank Limited",
     "active": false
   }
   ```

8. **Bulk update**

   ```
   PATCH /api/v1/banks/bulk
   Content-Type: application/json

   {
     "data": [
       {
         "_id": "64b1234abcd567890ef12345",
         "bankName": "HDFC Main Branch (Updated)",
         "active": false
       },
       {
         "_id": "64b1234abcd567890ef12346",
         "isLeaf": false
       }
     ]
   }
   ```

9. **Delete/archive one**

   ```
   DELETE /api/v1/banks/64b1234abcd567890ef12345
   ```

   → sets `isArchived = true`.

10. **Bulk delete/archive**

    ```
    DELETE /api/v1/banks/bulk
    Content-Type: application/json

    {
      "ids": ["64b1234abcd567890ef12345", "64b1234abcd567890ef12346"]
    }
    ```

11. **Archive alias**

    ```
    PATCH /api/v1/banks/64b1234abcd567890ef12345/archive
    ```

12. **Unarchive**

    ```
    PATCH /api/v1/banks/64b1234abcd567890ef12345/unarchive
    ```

---

### Explanation of Key Points

- **`isArchived` flag**
  We never fully delete bank documents; instead, setting `isArchived = true` hides them from “Get All” by default. To see archived banks, add `?includeArchived=true`.

- **Hierarchical retrieval**
  If you want a parent/child tree of bank accounts (e.g. “BankGroup A → SubAccount A1 → Sub-SubAccount A1.1”), call:

  ```
  GET /api/v1/banks?hierarchy=true
  ```

  The controller builds a simple dictionary of nodes keyed by `_id`, then pushes each bank into its `parent.children[]`. Any bank with `parentAccount = null` becomes a root.

- **Validation**

  - We check `isValidObjectId` whenever an ID is passed (`:id`, `parentAccount`, `linkedCoaAccount`).
  - We rely on the schema’s `unique` index on `accountCode` and the regex validator for `accountCode`.

- **Bulk operations**

  - We wrap bulk updates in a **transactional** session (`session.startTransaction()` / `session.commitTransaction()`), so that either all succeed or all roll back.
  - Bulk create uses `insertMany({ ordered: true })`, meaning if any insert fails (e.g. duplicate key), the entire batch aborts.

- **Pre‐save parent check**
  The schema’s `pre("save")` hook ensures that if you set `parentAccount`, that referenced bank exists and is not a leaf. This prevents hanging references.

You now have a fully featured set of controllers and routes for **BankModel**, supporting one‐by‐one and bulk CRUD, plus archive/unarchive and hierarchical listing.
