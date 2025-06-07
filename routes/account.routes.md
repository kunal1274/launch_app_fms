Below is a complete set of controllers and routes for your **Account** (Chart‐of‐Accounts) model, supporting:

1. **Get All** (with optional filtering/archived flag)
2. **Get One** by ID
3. **Create One**
4. **Bulk Create**
5. **Update One** by ID
6. **Bulk Update** (array of `{ _id, ...updates }`)
7. **Delete One** (soft‐delete → “archive”)
8. **Bulk Delete** (soft‐delete multiple)
9. **Archive One**
10. **Unarchive One**

> **Note:** to support “archive/unarchive,” we add an `isArchived` field to the schema. If you haven’t already, add this to your `accountSchema`:
>
> ```js
> isArchived: {
>   type: Boolean,
>   default: false,
> }
> ```
>
> (You can place it anywhere in the top‐level fields.)

After that, use `isArchived` for “delete/archive” operations.

---

## 1. Updated Account Model (with `isArchived`)

```js
// models/account.model.js

import mongoose, { Schema, model } from "mongoose";

// (Optional) Sub‐schema for nested/hierarchical retrieval
const accountNodeSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, ref: "Accounts" },
    accountCode: { type: String, required: true },
    accountName: { type: String, required: true },
    children: [
      /* recursively embed additional accountNodeSchema entries if you want to return a tree */
    ],
  },
  { _id: false }
);

// Top‐level Account schema
const accountSchema = new Schema(
  {
    accountCode: {
      type: String,
      required: [true, "Account code is required"],
      trim: true,
      unique: true,
      match: [
        /^[A-Za-z0-9\.\-]+$/,
        "Account code may only contain letters, numbers, dots, or dashes",
      ],
    },
    accountName: {
      type: String,
      required: [true, "Account name is required"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Account type is required"],
      enum: {
        values: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"],
        message:
          "`type` must be one of ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE",
      },
    },
    parentAccount: {
      type: Schema.Types.ObjectId,
      ref: "Accounts",
      default: null,
    },
    normalBalance: {
      type: String,
      enum: ["DEBIT", "CREDIT"],
      required: [true, "Normal balance side is required"],
      default: "DEBIT",
    },
    isLeaf: {
      type: Boolean,
      required: true,
      default: true,
    },
    allowManualPost: {
      type: Boolean,
      required: true,
      default: true,
    },
    currency: {
      type: String,
      required: true,
      default: "INR",
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    group: {
      type: String,
      default: "",
      trim: true,
    },

    // ─── added to support “archive/unarchive” ───
    isArchived: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

// Unique index on accountCode
accountSchema.index({ accountCode: 1 }, { unique: true });

// Pre-save hook: if parentAccount is set, ensure parent exists & is not a leaf
accountSchema.pre("save", async function (next) {
  if (this.parentAccount) {
    const parent = await mongoose
      .model("Accounts")
      .findById(this.parentAccount);
    if (!parent) {
      return next(
        new Error(
          `parentAccount ${this.parentAccount} does not exist in Chart of Accounts.`
        )
      );
    }
    if (parent.isLeaf) {
      return next(
        new Error(
          `Cannot assign parentAccount ${this.parentAccount} because it is a leaf node.`
        )
      );
    }
  }
  next();
});

export const AccountModel =
  mongoose.models.Accounts || model("Accounts", accountSchema);
```

### How to Use `accountNodeSchema`

The `accountNodeSchema` is **optional**—it’s meant for situations where you want to return a hierarchical (tree) representation of your COA. For example, if your COA looks like:

```
1. Assets
  1.1 Cash
    1.1.1 Cash – INR
    1.1.2 Cash – USD
  1.2 Bank Accounts
    1.2.1 HDFC Savings
    1.2.2 ICICI Current
2. Liabilities
  2.1 Accounts Payable
  2.2 Loans Payable
… etc.
```

you could query all accounts and then build a nested structure by matching `parentAccount` pointers, populating an array of children for each “parent.” In that scenario, you’d return an array of top‐level nodes shaped like:

```js
[
  {
    _id: <ObjectId of “Assets”>,
    accountCode: "1",
    accountName: "Assets",
    children: [
      {
        _id: <ObjectId of “Cash”>,
        accountCode: "1.1",
        accountName: "Cash",
        children: [
          { _id: <ObjectId of “Cash – INR”>, accountCode: "1.1.1", accountName: "Cash – INR", children: [] },
          { _id: <ObjectId of “Cash – USD”>, accountCode: "1.1.2", accountName: "Cash – USD", children: [] }
        ]
      },
      {
        _id: <ObjectId of “Bank Accounts”>,
        accountCode: "1.2",
        accountName: "Bank Accounts",
        children: [
          { _id: <…>, accountCode: "1.2.1", accountName: "HDFC Savings", children: [] },
          { _id: <…>, accountCode: "1.2.2", accountName: "ICICI Current", children: [] }
        ]
      }
    ]
  },
  {
    _id: <ObjectId of “Liabilities”>,
    accountCode: "2",
    accountName: "Liabilities",
    children: [
      { _id: <…>, accountCode: "2.1", accountName: "Accounts Payable", children: [] },
      { _id: <…>, accountCode: "2.2", accountName: "Loans Payable", children: [] }
    ]
  },
  … etc.
]
```

You would typically build that structure in your “Get All” controller by:

1. Fetching all accounts with `AccountModel.find({ isArchived: false })`.
2. Splitting them into a dictionary keyed by `_id` (for O(1) lookups), then looping through and pushing each account into `parent.children` (if it has a `parentAccount`), otherwise into the top‐level array.
3. Projecting each node into the shape defined by `accountNodeSchema`.

---

## 2. Account Controller

Create a new file `controllers/account.controller.js`:

```js
// controllers/account.controller.js

import mongoose from "mongoose";
import { AccountModel } from "../models/account.model.js";

/**
 * Utility: validate MongoDB ObjectId
 */
function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

/**
 * 1) GET ALL ACCOUNTS
 *    - Optional query param: ?includeArchived=true  (defaults to false)
 *    - Optional query param: ?hierarchy=true       (if you want nested tree)
 */
export const getAllAccounts = async (req, res) => {
  try {
    const { includeArchived, hierarchy } = req.query;
    const filter = {};

    if (includeArchived !== "true") {
      // Only fetch non-archived by default
      filter.isArchived = false;
    }

    // 1) Fetch all matching accounts
    const accounts = await AccountModel.find(filter)
      .sort({ accountCode: 1 })
      .lean();

    // 2) If user wants a hierarchical tree, build it
    if (hierarchy === "true") {
      // Build a map of id → node
      const nodeMap = {};
      accounts.forEach((acct) => {
        nodeMap[acct._id.toString()] = {
          _id: acct._id,
          accountCode: acct.accountCode,
          accountName: acct.accountName,
          type: acct.type,
          normalBalance: acct.normalBalance,
          isLeaf: acct.isLeaf,
          allowManualPost: acct.allowManualPost,
          currency: acct.currency,
          description: acct.description,
          group: acct.group,
          isArchived: acct.isArchived,
          parentAccount: acct.parentAccount,
          children: [],
        };
      });

      // Now connect children → parent
      const roots = [];
      accounts.forEach((acct) => {
        if (acct.parentAccount) {
          const parentId = acct.parentAccount.toString();
          if (nodeMap[parentId]) {
            nodeMap[parentId].children.push(nodeMap[acct._id.toString()]);
          }
        } else {
          // no parent → top‐level
          roots.push(nodeMap[acct._id.toString()]);
        }
      });

      return res.status(200).json({ status: "success", data: roots });
    }

    // 3) Otherwise return flat list
    return res.status(200).json({ status: "success", data: accounts });
  } catch (error) {
    console.error("❌ getAllAccounts Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 2) GET ONE ACCOUNT BY ID
 */
export const getAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: "failure", message: "Invalid ID" });
    }
    const acct = await AccountModel.findById(id).lean();
    if (!acct) {
      return res
        .status(404)
        .json({ status: "failure", message: "Account not found." });
    }
    return res.status(200).json({ status: "success", data: acct });
  } catch (error) {
    console.error("❌ getAccountById Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 3) CREATE ONE ACCOUNT
 */
export const createAccount = async (req, res) => {
  try {
    const {
      accountCode,
      accountName,
      type,
      parentAccount,
      normalBalance,
      isLeaf,
      allowManualPost,
      currency,
      description,
      group,
    } = req.body;

    // Basic validation
    if (!accountCode || !accountName || !type || !normalBalance) {
      return res.status(400).json({
        status: "failure",
        message:
          "accountCode, accountName, type, and normalBalance are required.",
      });
    }

    const newAcct = new AccountModel({
      accountCode: accountCode.trim(),
      accountName: accountName.trim(),
      type,
      parentAccount: parentAccount || null,
      normalBalance,
      isLeaf: isLeaf === false ? false : true, // default true
      allowManualPost: allowManualPost === false ? false : true,
      currency: currency ? currency.trim() : "INR",
      description: description || "",
      group: group || "",
    });

    await newAcct.save();
    return res
      .status(201)
      .json({ status: "success", message: "Account created.", data: newAcct });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      return res.status(409).json({
        status: "failure",
        message: "Duplicate accountCode. That code already exists.",
      });
    }
    console.error("❌ createAccount Error:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

/**
 * 4) BULK CREATE ACCOUNTS
 *    Expect: { data: [ { accountCode, accountName, type, … }, … ] }
 */
export const bulkCreateAccounts = async (req, res) => {
  try {
    const { data } = req.body;
    if (!Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        status: "failure",
        message: "Request body must contain a non-empty `data` array.",
      });
    }

    // Normalize each entry
    const inserts = data.map((acct) => ({
      accountCode: acct.accountCode?.trim(),
      accountName: acct.accountName?.trim(),
      type: acct.type,
      parentAccount: acct.parentAccount || null,
      normalBalance: acct.normalBalance,
      isLeaf: acct.isLeaf === false ? false : true,
      allowManualPost: acct.allowManualPost === false ? false : true,
      currency: acct.currency ? acct.currency.trim() : "INR",
      description: acct.description || "",
      group: acct.group || "",
    }));

    const inserted = await AccountModel.insertMany(inserts, { ordered: true });
    return res.status(201).json({
      status: "success",
      message: `Inserted ${inserted.length} account(s).`,
      data: inserted,
    });
  } catch (error) {
    console.error("❌ bulkCreateAccounts Error:", error);
    // If a validation error occurs, Mongoose may throw a BulkWriteError with details.
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 5) UPDATE ONE ACCOUNT BY ID
 */
export const updateAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: "failure", message: "Invalid ID" });
    }

    // Build an updates object only for allowed fields
    const updates = {};
    const allowedFields = [
      "accountCode",
      "accountName",
      "type",
      "parentAccount",
      "normalBalance",
      "isLeaf",
      "allowManualPost",
      "currency",
      "description",
      "group",
    ];
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

    const updated = await AccountModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
    if (!updated) {
      return res
        .status(404)
        .json({ status: "failure", message: "Account not found." });
    }
    return res.status(200).json({
      status: "success",
      message: "Account updated.",
      data: updated,
    });
  } catch (error) {
    console.error("❌ updateAccountById Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 6) BULK UPDATE ACCOUNTS
 *    Expect: { data: [ { _id, ...fieldsToUpdate }, ... ] }
 */
export const bulkUpdateAccounts = async (req, res) => {
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

      // Only allow certain fields
      const updates = {};
      const allowedFields = [
        "accountCode",
        "accountName",
        "type",
        "parentAccount",
        "normalBalance",
        "isLeaf",
        "allowManualPost",
        "currency",
        "description",
        "group",
      ];
      for (let f of allowedFields) {
        if (f in fields) {
          updates[f] = fields[f];
        }
      }
      if (Object.keys(updates).length === 0) {
        throw new Error(`No valid fields to update for ID ${_id}`);
      }

      const updated = await AccountModel.findByIdAndUpdate(_id, updates, {
        new: true,
        runValidators: true,
        session,
      });
      if (!updated) {
        throw new Error(`Account not found: ${_id}`);
      }
      results.push(updated);
    }

    await session.commitTransaction();
    session.endSession();
    return res.status(200).json({
      status: "success",
      message: `Updated ${results.length} account(s).`,
      data: results,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ bulkUpdateAccounts Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 7) DELETE ONE ACCOUNT (soft-delete → archive)
 *    We set isArchived = true
 */
export const deleteAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: "failure", message: "Invalid ID" });
    }
    const acct = await AccountModel.findByIdAndUpdate(
      id,
      { isArchived: true },
      { new: true }
    );
    if (!acct) {
      return res
        .status(404)
        .json({ status: "failure", message: "Account not found." });
    }
    return res.status(200).json({
      status: "success",
      message: "Account archived.",
      data: acct,
    });
  } catch (error) {
    console.error("❌ deleteAccountById Error:", error);
    return res.status(500).json({ status: "failure", message: error.message });
  }
};

/**
 * 8) BULK DELETE ACCOUNTS (soft‐delete → archive multiple)
 *    Expect: { ids: ["id1", "id2", ...] }
 */
export const bulkDeleteAccounts = async (req, res) => {
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
    const result = await AccountModel.updateMany(
      { _id: { $in: ids } },
      { isArchived: true }
    );
    return res.status(200).json({
      status: "success",
      message: `Archived ${result.nModified} account(s).`,
    });
  } catch (error) {
    console.error("❌ bulkDeleteAccounts Error:", error);
    return res.status(500).json({ status: "failure", message: error.message });
  }
};

/**
 * 9) ARCHIVE ONE (same as deleteAccountById)
 */
export const archiveAccountById = async (req, res) => {
  // alias for deleteAccountById
  return deleteAccountById(req, res);
};

/**
 * 10) UNARCHIVE ONE (restore isArchived = false)
 */
export const unarchiveAccountById = async (req, res) => {
  try {
    const { id } = req.params;
    if (!isValidObjectId(id)) {
      return res.status(400).json({ status: "failure", message: "Invalid ID" });
    }
    const acct = await AccountModel.findByIdAndUpdate(
      id,
      { isArchived: false },
      { new: true }
    );
    if (!acct) {
      return res
        .status(404)
        .json({ status: "failure", message: "Account not found." });
    }
    return res.status(200).json({
      status: "success",
      message: "Account unarchived.",
      data: acct,
    });
  } catch (error) {
    console.error("❌ unarchiveAccountById Error:", error);
    return res.status(500).json({ status: "failure", message: error.message });
  }
};
```

### Explanation of Each Controller

1. **`getAllAccounts`**

   - Reads optional query strings:

     - `includeArchived=true` to include archived (`isArchived: true`) accounts.
     - `hierarchy=true` to return a nested tree structure rather than a flat list.

   - If `hierarchy=true`, we build a dictionary (`nodeMap`) of all accounts, then attach each account to its parent’s `.children[]`. Any account with no `parentAccount` becomes a root node in the returned array.

2. **`getAccountById`**

   - Validates that `:id` is a valid ObjectId, then `findById` and return 404 if not found.

3. **`createAccount`**

   - Validates required fields: `accountCode`, `accountName`, `type`, `normalBalance`.
   - Instantiates a new `AccountModel(...)` and calls `.save()`.
   - Returns 409 if `accountCode` duplicates, or 422 on validation errors.

4. **`bulkCreateAccounts`**

   - Expects request body `{ data: [ { accountCode, accountName, ... }, ... ] }`.
   - Maps each object to the minimal `{ accountCode, accountName, type, parentAccount, … }` shape.
   - Calls `AccountModel.insertMany(inserts)`.
   - Returns inserted documents. Note that if any one fails validation/duplicate, the whole batch fails (because `ordered: true`).

5. **`updateAccountById`**

   - Validates `:id`, then builds an `updates` object containing only allowed fields.
   - Uses `findByIdAndUpdate(id, updates, { new: true, runValidators: true })`.

6. **`bulkUpdateAccounts`**

   - Expects `{ data: [ { _id: "xxx", accountName: "...", … }, … ] }`.
   - Opens a `session`, iterates over each entry, validates the `_id` and the allowed update fields, performs `findByIdAndUpdate(..., { session })`.
   - Commits or aborts the transaction depending on success/failure.

7. **`deleteAccountById`** (soft delete)

   - Sets `isArchived: true` on that account.
   - Returns the updated doc.

8. **`bulkDeleteAccounts`**

   - Expects `{ ids: ["id1", "id2", …] }`.
   - Runs `updateMany({ _id: { $in: ids } }, { isArchived: true })`.

9. **`archiveAccountById`**

   - Alias to `deleteAccountById`.

10. **`unarchiveAccountById`**

    - Sets `isArchived: false` on that account.

---

## 3. Account Routes

Create `routes/account.routes.js`:

```js
// routes/account.routes.js

import express from "express";
import {
  getAllAccounts,
  getAccountById,
  createAccount,
  bulkCreateAccounts,
  updateAccountById,
  bulkUpdateAccounts,
  deleteAccountById,
  bulkDeleteAccounts,
  archiveAccountById,
  unarchiveAccountById,
} from "../controllers/account.controller.js";

const router = express.Router();

// 1. GET ALL ACCOUNTS
//    Optional: ?includeArchived=true  ?hierarchy=true
router.get("/", getAllAccounts);

// 2. GET ONE ACCOUNT BY ID
router.get("/:id", getAccountById);

// 3. CREATE ONE ACCOUNT
router.post("/", createAccount);

// 4. BULK CREATE ACCOUNTS
router.post("/bulk", bulkCreateAccounts);

// 5. UPDATE ONE ACCOUNT BY ID
router.patch("/:id", updateAccountById);

// 6. BULK UPDATE ACCOUNTS
router.patch("/bulk", bulkUpdateAccounts);

// 7. DELETE (archive) ONE ACCOUNT
router.delete("/:id", deleteAccountById);

// 8. BULK DELETE (archive) ACCOUNTS
router.delete("/bulk", bulkDeleteAccounts);

// 9. ARCHIVE ONE ACCOUNT (alias for delete)
router.patch("/:id/archive", archiveAccountById);

// 10. UNARCHIVE ONE ACCOUNT
router.patch("/:id/unarchive", unarchiveAccountById);

export default router;
```

Then in your main `app.js` (or wherever you mount routes):

```js
// app.js (excerpt)

import express from "express";
import accountRoutes from "./routes/account.routes.js";
// … other imports …

const app = express();
app.use(express.json());

// … any middleware (auth, logging) …

app.use("/api/v1/accounts", accountRoutes);

// … error handlers, etc. …

export default app;
```

---

## 4. How to Use the Endpoints

1. **Get All Accounts (flat)**

   ```http
   GET /api/v1/accounts
   ```

   → returns all non‐archived accounts in a flat array.

2. **Get All Accounts (including archived)**

   ```http
   GET /api/v1/accounts?includeArchived=true
   ```

3. **Get All Accounts (hierarchy)**

   ```http
   GET /api/v1/accounts?hierarchy=true
   ```

   → returns an array of top‐level nodes, each with `.children` recursively built. Only non‐archived by default.

   ```http
   GET /api/v1/accounts?hierarchy=true&includeArchived=true
   ```

   → returns nested structure including archived nodes.

4. **Get One Account**

   ```http
   GET /api/v1/accounts/64a7f9e12345abcd6789ef01
   ```

5. **Create One Account**

   ```http
   POST /api/v1/accounts
   Content-Type: application/json

   {
     "accountCode": "1.1.1",
     "accountName": "Cash – INR",
     "type": "ASSET",
     "parentAccount": "64a7f9d2345678abcd90ef12",   // optional
     "normalBalance": "DEBIT",
     "isLeaf": true,
     "allowManualPost": true,
     "currency": "INR",
     "description": "Primary cash account (INR)",
     "group": "OPERATIONS"
   }
   ```

6. **Bulk Create**

   ```http
   POST /api/v1/accounts/bulk
   Content-Type: application/json

   {
     "data": [
       {
         "accountCode": "1.1.2",
         "accountName": "Cash – USD",
         "type": "ASSET",
         "parentAccount": "64a7f9d2345678abcd90ef12",
         "normalBalance": "DEBIT",
         "isLeaf": true,
         "allowManualPost": true,
         "currency": "USD",
         "description": "Cash account (USD)",
         "group": "OPERATIONS"
       },
       {
         "accountCode": "2.1.1",
         "accountName": "Accounts Payable",
         "type": "LIABILITY",
         "parentAccount": null,
         "normalBalance": "CREDIT",
         "isLeaf": true,
         "allowManualPost": true,
         "currency": "INR",
         "description": "AP control account",
         "group": "FINANCE"
       }
     ]
   }
   ```

7. **Update One**

   ```http
   PATCH /api/v1/accounts/64a7f9e12345abcd6789ef01
   Content-Type: application/json

   {
     "accountName": "Cash – Indian Rupees",
     "description": "Updated name"
   }
   ```

8. **Bulk Update**

   ```http
   PATCH /api/v1/accounts/bulk
   Content-Type: application/json

   {
     "data": [
       {
         "_id": "64a7f9e12345abcd6789ef01",
         "accountName": "HDFC Savings (Revised)"
       },
       {
         "_id": "64a7f9e22345abcd6789ef02",
         "isLeaf": false
       }
     ]
   }
   ```

9. **Delete/Archive One**

   ```http
   DELETE /api/v1/accounts/64a7f9e12345abcd6789ef01
   ```

   → sets `isArchived = true`.

10. **Bulk Delete/Archive**

    ```http
    DELETE /api/v1/accounts/bulk
    Content-Type: application/json

    {
      "ids": [
        "64a7f9e12345abcd6789ef01",
        "64a7f9e22345abcd6789ef02"
      ]
    }
    ```

11. **Archive (alias)**

    ```http
    PATCH /api/v1/accounts/64a7f9e12345abcd6789ef01/archive
    ```

12. **Unarchive**

    ```http
    PATCH /api/v1/accounts/64a7f9e12345abcd6789ef01/unarchive
    ```

---

## 5. When & How to Use the `accountNodeSchema`

- The `accountNodeSchema` is **only used** when you want to **return a nested, hierarchical** Chart of Accounts (COA).
- Use case: on your UI, you might want to display the COA as a collapsible tree (e.g. “Assets → Cash → Cash–INR; Assets → Bank Accounts → HDFC Savings; Liabilities → Accounts Payable; …”).
- In `getAllAccounts` with `?hierarchy=true`, we:

  1. Fetch all non‐archived accounts.
  2. Build a dictionary `nodeMap` mapping `_id → { _id, accountCode, accountName, children:[] }`.
  3. Iterate over each account; if it has `parentAccount`, find its parent in `nodeMap` and push it into `parent.children[]`; otherwise push it into a top‐level `roots[]`.
  4. Return `roots`—an array of top‐level nodes, each matching the shape of `accountNodeSchema`.

> **When to use:**
>
> - On reports where users need to **drill down** by clicking on a parent account to see its child accounts.
> - On any UI where you want a tree‐like representation rather than a flat table.
> - For exporting a nested COA in a hierarchy, e.g. PDF or CSV that shows indentation.

---

### Recap

- **Controllers** in `controllers/account.controller.js` implement all core operations (CRUD, bulk, archive/unarchive) against `AccountModel`.
- **Routes** in `routes/account.routes.js` tie those controller methods to REST endpoints under `/api/v1/accounts`.
- We added an `isArchived` boolean to the schema to support “archive/unarchive” patterns.
- The optional `accountNodeSchema` is used when you want to return a nested (parent/child) tree of accounts (instead of a flat list) by setting `?hierarchy=true` on the GET endpoint.

With this in place, you have a fully featured “Chart of Accounts” REST interface, ready to plug into your GL and subledger flows.
