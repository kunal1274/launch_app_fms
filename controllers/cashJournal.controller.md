Below is a step-by-step design and implementation for handling “bank accounts” (including Cash, Bank, UPI, Crypto, Wallet, etc.) in your system—complete with:

1. **Mongoose schema for Bank Accounts**
2. **Controller & Routes for CRUD on Bank Accounts**
3. **Controller and Routes to post three special “cash/bank”‐type journals**:

   - **AR Receipt Journal** (customer pays you in cash/bank/UPI/etc.)
   - **AP Payment Journal** (you pay a supplier via cash/bank/UPI/etc.)
   - **Bank‐to‐Bank Transfer Journal** (move funds from one bank account to another, possibly cross‐currency)

4. **Currency Revaluation** logic for a foreign‐currency bank account, with a worked example.

> **Note:** We assume you already have the following models in place from earlier conversations:
>
> - **`AccountModel`** (your Chart of Accounts)
> - **`GLJournalModel`** (your general‐ledger journals with lines)
> - A utility to fetch the next voucher number (e.g. `VoucherService.getNextVoucherNo()`)
> - A `VoucherModel` or `GLJournalModel` for storing GL entries
> - The “functional currency” of the company (e.g. stored in an environment variable or settings document). For this example, we’ll assume **INR** is the functional (reporting) currency.

Throughout this section, we will:

- Create and maintain a separate **`BankAccountModel`** for all “cash‐like” and bank‐like methods (Cash, Bank, UPI, Crypto, Wallet, etc.).
- Post special journals that hit the appropriate GL accounts plus subledger linkage back to “bank account” as a subledger.
- Explain how to handle end‐of‐period FX revaluation for a bank account held in a foreign currency (e.g. USD‐denominated bank account, reporting currency INR, with a year‐end spot rate difference).

---

## 1. Bank Account (Payment Method) Schema

First, let’s build a **`BankAccountModel`** that covers multiple “types” of “bank/cash” methods—cash on hand, bank accounts, UPI, Crypto wallets, etc. Each record here is a “payment method” with its own currency, code, and other details. We will assume that actual balances are derived from GL journals and that this document simply stores metadata (account number, name, currency).

Create a new file at `models/bankAccount.model.js`:

```js
// models/bankAccount.model.js

import mongoose, { Schema, model } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Define a schema for BankAccount (or “Payment Method”)
// ─────────────────────────────────────────────────────────────────────────────
const bankAccountSchema = new Schema(
  {
    /**
     * A short code or name to identify this payment method (e.g. "CASH_IN_HAND"
     * or "HDFC_SAVINGS" or "UPI_PAYTM" or "BTC_WALLET").
     * Must be unique so that users can pick from a dropdown without ambiguity.
     */
    code: {
      type: String,
      required: [true, "Payment method code is required"],
      unique: true,
      trim: true,
      match: [
        /^[A-Za-z0-9\-_]+$/,
        "Code may only contain alphanumeric, dash or underscore",
      ],
    },

    /**
     * A human‐readable name for display (e.g. "Cash in Hand", "HDFC Bank Savings",
     * "Paytm UPI", "Bitcoin Wallet").
     */
    name: {
      type: String,
      required: [true, "Payment method name is required"],
      trim: true,
    },

    /**
     * Payment type enumeration: either a pure cash, bank account, UPI ID, Crypto wallet, or “other wallet.”
     * This is mostly for reporting/filtering and UI icons.
     */
    type: {
      type: String,
      required: [true, "Payment method type is required"],
      enum: {
        values: ["CASH", "BANK", "UPI", "CRYPTO", "WALLET", "OTHER"],
        message:
          "`type` must be one of CASH, BANK, UPI, CRYPTO, WALLET, or OTHER",
      },
    },

    /**
     * Currency code (e.g. "INR", "USD", "EUR", "BTC", etc.).
     * Especially important if this is a foreign‐currency bank or crypto wallet.
     */
    currency: {
      type: String,
      required: [true, "Currency is required"],
      trim: true,
      // You could further validate against a list of ISO codes or crypto tickers.
    },

    /**
     * Optional: if this is a BANK type, store the bank’s account number or IBAN/IFSC/Swift.
     * If UPI, store UPI ID; if CRYPTO, store wallet address; if CASH, you can leave blank or store
     * “CASH” as a placeholder. See `type` to decide.
     */
    accountNumber: {
      type: String,
      default: "",
      trim: true,
    },

    /**
     * Transaction reference: e.g. branch code, UPI VPA, crypto network, etc.
     * You can store IFR codes, branch identifiers, or any extra fields here.
     * Not required for CASH.
     */
    extra: {
      type: String,
      default: "",
      trim: true,
    },

    /**
     * Whether this payment method is active. If false, don’t let users deposit/withdraw to/from this
     * account. (Soft‐delete style.)
     */
    isActive: {
      type: Boolean,
      default: true,
    },

    /**
     * Optional: an “openingBalance” in this account (in the account’s own currency).
     * If you prefer, you can leave all balances to be computed from GL, but sometimes a
     * CSV import or initial seed is easier if you store an openingBalance.
     */
    openingBalance: {
      type: Number,
      default: 0,
      min: [0, "Opening balance ≥ 0"],
    },

    /**
     * If you allow multi‐entity: store `companyId`. For now, we’ll omit.
     */

    /**
     * If you allow per‐account maximum or minimum, store here (optional).
     */
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 2. Indexes & Hooks
// ─────────────────────────────────────────────────────────────────────────────
// Unique index on code
bankAccountSchema.index({ code: 1 }, { unique: true });

/**
 * You could add a pre‐save hook to validate that if type==="BANK", `accountNumber` is non‐empty, etc.
 * For brevity, we’ll skip that. But you can do:
 *
 * bankAccountSchema.pre("save", function(next) {
 *   if (this.type === "BANK" && !this.accountNumber) {
 *     return next(new Error("Bank accountNumber is required for type=BANK."));
 *   }
 *   next();
 * });
 */

export const BankAccountModel =
  mongoose.models.BankAccounts || model("BankAccounts", bankAccountSchema);
```

#### Explanation

- **`code`** (String, unique):
  A short, unique code (no spaces) to identify this payment method (e.g. `"CASH"`, `"HDFC_SB_ACC"`, `"UPI_PAYTM"`, `"BTC_WALLET"`).
- **`name`** (String):
  A human‐friendly name (e.g. `"Cash in Hand"`, `"HDFC Bank – Savings"`, `"Paytm UPI"`, `"Bitcoin Wallet"`).
- **`type`** (enum):
  One of `CASH`, `BANK`, `UPI`, `CRYPTO`, `WALLET`, `OTHER`. This helps the UI show appropriate icons and ensures we treat them similarly.
- **`currency`** (String):
  The 3‐ or 4‐letter ISO code for fiat (e.g. `"INR"`, `"USD"`, `"EUR"`) or a crypto ticker (e.g. `"BTC"`, `"ETH"`). Whenever you post a transaction to this bank account, you’ll record amounts in this `currency`.
- **`accountNumber`** (String):
  For `BANK` type, store IBAN/IFSC/Account No. For `UPI`, store the VPA (e.g. `alice@okhdfcbank`). For `CRYPTO`, store the wallet address. For `CASH`, leave blank or store `"CASH"`.
- **`isActive`** (Boolean):
  If you want to disable a payment method (e.g. a bank account that got closed), you can set it to `false`.
- **`openingBalance`** (Number):
  If you want a one‐time opening balance (in the method’s own currency). Otherwise, your GL will reflect all deposits/withdrawals, and the “live balance” is computed by summing GL lines by that bank account (sub-ledger).

---

## 2. Simple Controller & Routes for BankAccount (CRUD)

Next, let’s create a basic **CRUD** controller for `BankAccountModel`, then wire up Express routes. Put this in `controllers/bankAccount.controller.js`:

```js
// controllers/bankAccount.controller.js

import mongoose from "mongoose";
import { BankAccountModel } from "../models/bankAccount.model.js";

// ─────────────────────────────────────────────────────────────────────────────
// 1. Create a new Bank Account (Payment Method)
// ─────────────────────────────────────────────────────────────────────────────
export const createBankAccount = async (req, res) => {
  try {
    const { code, name, type, currency, accountNumber, extra, openingBalance } =
      req.body;

    // 1) Basic validation
    if (!code || !name || !type || !currency) {
      return res.status(400).json({
        status: "failure",
        message: "code, name, type, and currency are required.",
      });
    }

    // 2) Instantiate & save
    const ba = new BankAccountModel({
      code: code.trim(),
      name: name.trim(),
      type,
      currency: currency.trim(),
      accountNumber: accountNumber ? accountNumber.trim() : "",
      extra: extra ? extra.trim() : "",
      openingBalance: openingBalance || 0,
    });
    await ba.save();

    return res.status(201).json({
      status: "success",
      message: "Bank account created.",
      data: ba,
    });
  } catch (error) {
    if (error.name === "ValidationError") {
      return res
        .status(422)
        .json({ status: "failure", message: error.message });
    }
    if (error.code === 11000) {
      // duplicate key
      return res.status(409).json({
        status: "failure",
        message: "A bank account with that code already exists.",
      });
    }
    console.error("Error creating BankAccount:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 2. List all Bank Accounts (active only, or toggle with a query param)
// ─────────────────────────────────────────────────────────────────────────────
export const listBankAccounts = async (req, res) => {
  try {
    // If ?includeInactive=true, show all; otherwise only isActive=true
    const { includeInactive } = req.query;
    const filter = includeInactive === "true" ? {} : { isActive: true };

    const accounts = await BankAccountModel.find(filter).sort({ code: 1 });
    return res.status(200).json({ status: "success", data: accounts });
  } catch (error) {
    console.error("Error listing BankAccounts:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 3. Get a single Bank Account by ID
// ─────────────────────────────────────────────────────────────────────────────
export const getBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid BankAccount ID" });
    }
    const ba = await BankAccountModel.findById(id);
    if (!ba) {
      return res
        .status(404)
        .json({ status: "failure", message: "BankAccount not found." });
    }
    return res.status(200).json({ status: "success", data: ba });
  } catch (error) {
    console.error("Error fetching BankAccount:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 4. Update a Bank Account by ID
// ─────────────────────────────────────────────────────────────────────────────
export const updateBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = {};
    const allowedFields = [
      "name",
      "type",
      "currency",
      "accountNumber",
      "extra",
      "isActive",
      "openingBalance",
      "metadata",
    ];
    for (let field of allowedFields) {
      if (field in req.body) {
        updates[field] = req.body[field];
      }
    }
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid BankAccount ID" });
    }
    const ba = await BankAccountModel.findByIdAndUpdate(id, updates, {
      new: true,
      runValidators: true,
    });
    if (!ba) {
      return res
        .status(404)
        .json({ status: "failure", message: "BankAccount not found." });
    }
    return res
      .status(200)
      .json({ status: "success", message: "BankAccount updated.", data: ba });
  } catch (error) {
    console.error("Error updating BankAccount:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// 5. “Soft‐Delete” a Bank Account (set isActive=false) by ID
// ─────────────────────────────────────────────────────────────────────────────
export const deleteBankAccount = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res
        .status(400)
        .json({ status: "failure", message: "Invalid BankAccount ID" });
    }
    const ba = await BankAccountModel.findByIdAndUpdate(
      id,
      { isActive: false },
      { new: true }
    );
    if (!ba) {
      return res
        .status(404)
        .json({ status: "failure", message: "BankAccount not found." });
    }
    return res
      .status(200)
      .json({ status: "success", message: "BankAccount deactivated." });
  } catch (error) {
    console.error("Error deactivating BankAccount:", error);
    return res
      .status(500)
      .json({ status: "failure", message: "Internal server error." });
  }
};
```

Now wire up these controller methods in `routes/bankAccount.routes.js`:

```js
// routes/bankAccount.routes.js

import express from "express";
import {
  createBankAccount,
  listBankAccounts,
  getBankAccount,
  updateBankAccount,
  deleteBankAccount,
} from "../controllers/bankAccount.controller.js";

const router = express.Router();

// Create a new bank account (POST /api/v1/bank-accounts)
router.post("/", createBankAccount);

// List all bank accounts, optional query ?includeInactive=true (GET /api/v1/bank-accounts)
router.get("/", listBankAccounts);

// Get a single bank account (GET /api/v1/bank-accounts/:id)
router.get("/:id", getBankAccount);

// Update a bank account (PATCH /api/v1/bank-accounts/:id)
router.patch("/:id", updateBankAccount);

// Deactivate (soft‐delete) a bank account (DELETE /api/v1/bank-accounts/:id)
router.delete("/:id", deleteBankAccount);

export default router;
```

Finally, in your main `app.js` or `index.js`, mount:

```js
// app.js (excerpt)

import express from "express";
import bankAccountRoutes from "./routes/bankAccount.routes.js";
// … import other dependencies …

const app = express();
app.use(express.json());

// … other middleware (auth, etc.) …

app.use("/api/v1/bank-accounts", bankAccountRoutes);

// … mount other routes, error handlers, etc.

export default app;
```

---

## 3. Posting “Cash/Bank” Journals

Below is a generalized **“CashJournalController”** that lets you:

1. **Post an AR Receipt Journal** (customer pays you in a bank account;
   → Debit Bank Account, Credit Accounts Receivable)
2. **Post an AP Payment Journal** (you pay a supplier;
   → Debit Accounts Payable, Credit Bank Account)
3. **Post a Bank‐to‐Bank Transfer Journal** (move funds from one bank account to another;
   → Debit target Bank Account, Credit source Bank Account; maybe record FX gain/loss if currencies differ)

We assume:

- You already have an `AccountModel` where:

  - `"Accounts Receivable"` account’s `_id` = some ObjectId.
  - `"Accounts Payable"` account’s `_id` = some ObjectId.
  - `"Cash in Hand"`, `"Bank – HDFC"`, etc., are accounts as well—but we will store those in `BankAccountModel` and then look up their corresponding GL “COA accounts” (e.g. “1.1.1 Cash” or “1.1.2 Accounts Receivable”) through an `AccountModel`. To simplify, we will assume the COA has these relevant account codes:

    - **AR** = accountCode `"1.1.2"` (Accounts Receivable)
    - **AP** = accountCode `"2.1.1"` (Accounts Payable)
    - **Inventory**, **Sales Revenue**, etc. are already in the COA.
    - **Each BankAccount** will have a “linkedCOAAccount” field pointing to the correct leaf AccountModel `_id`. So there’s a 1:1 mapping from `BankAccountModel` → a leaf `AccountModel`.

### 3.1 Extend `BankAccountModel` to link to a COA Account

Go back to `models/bankAccount.model.js` and add a field:

```diff
// models/bankAccount.model.js
const bankAccountSchema = new Schema(
  {
+   /**
+    * Link to your Chart‐of‐Accounts Account to which this “bank account” posts.
+    * Required if you intend to post GL lines here.
+    */
+   linkedCoaAccount: {
+     type: Schema.Types.ObjectId,
+     ref: "Accounts",
+     required: [
+       true,
+       "Every BankAccount must specify the corresponding leaf AccountModel _id",
+     ],
+   },

    code: {
      type: String,
      required: [true, "Payment method code is required"],
      unique: true,
      trim: true,
      match: [
        /^[A-Za-z0-9\-_]+$/,
        "Code may only contain alphanumeric, dash or underscore",
      ],
    },
    name: {
      type: String,
      required: [true, "Payment method name is required"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Payment method type is required"],
      enum: {
        values: ["CASH", "BANK", "UPI", "CRYPTO", "WALLET", "OTHER"],
        message:
          "`type` must be one of CASH, BANK, UPI, CRYPTO, WALLET, or OTHER",
      },
    },
    currency: {
      type: String,
      required: [true, "Currency is required"],
      trim: true,
    },
    accountNumber: {
      type: String,
      default: "",
      trim: true,
    },
    extra: {
      type: String,
      default: "",
      trim: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    openingBalance: {
      type: Number,
      default: 0,
      min: [0, "Opening balance ≥ 0"],
    },
    metadata: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);
```

> **Why this is needed:**
> When you post a cash receipt or payment, you need to debit or credit the correct **GL Account** (COA). If you have multiple bank accounts (HDFC, ICICI, etc.), each one should post to its own “Bank Account (Asset)” COA leaf. By storing `linkedCoaAccount` on the BankAccount document, you can quickly look up “which AccountModel leaf” to post to.

Make sure to run an `npm install` (if you changed files) and that your database has updated for this new required field—existing bank accounts will need a provided `linkedCoaAccount`. You can do a one‐time migration or set a default. For simplicity, let’s assume you’ll create new BankAccounts going forward, each pointing to the correct COA leaf.

---

### 3.2 Controller: Cash/Bank Journal Operations

Create a new file `controllers/cashJournal.controller.js` (or “paymentJournal.controller.js”). In this controller, we will:

1. **Post an AR Receipt** (customer pays money into a BankAccount)

   - Input:

     ```json
     {
       "bankAccountId": "<BankAccount ObjectId>",
       "customerId": "<Customer ObjectId>", // for subledger linkage
       "amount": 1000.0, // in bank’s currency, e.g. 1000 USD
       "currency": "USD", // must match BankAccount.currency
       "exchangeRate": 75.0, // e.g. 1 USD = 75 INR (functional)
       "invoiceId": "<SalesInvoice ObjectId>", // subledger AR invoice record
       "remarks": "Receipt for INV_000123"
     }
     ```

   - Behavior:

     1. Validate `bankAccountId` exists and is active.
     2. Validate `currency === bankAccount.currency`.
     3. Compute `localAmount = amount × exchangeRate` (round to two decimals).
     4. Create a sub‐ledger AR receipt record (`ARTransactionModel`).
     5. Create a balanced GLJournal:

        - **Line 1**: Debit `linkedCoaAccount` (bank’s COA \_id) by `[amount]` in `currency` → local `(amount × exchangeRate)`, with subledger link to the AR receipt txn.
        - **Line 2**: Credit **AR** account (COA leaf “Accounts Receivable”), for `[amount]` in `currency`, local `(amount × exchangeRate)`, with subledger link to the same AR receipt txn.

     6. Save both under a transaction (MongoDB session) so AR and GL are atomic.

2. **Post an AP Payment** (you pay a supplier out of a BankAccount)

   - Input:

     ```json
     {
       "bankAccountId": "<BankAccount ObjectId>",
       "supplierId": "<Supplier ObjectId>",
       "amount": 500.0, // in bank’s currency
       "currency": "USD",
       "exchangeRate": 75.0,
       "purchaseInvoiceId": "<PurchaseInvoice ObjectId>",
       "remarks": "Payment for PCH_000456"
     }
     ```

   - Behavior:

     1. Debit **Accounts Payable** (COA leaf) by `[amount]` in `currency`, local `= amount × exchangeRate`.
     2. Credit `linkedCoaAccount` (bank’s COA leaf) by the same.
     3. Create a subledger AP payment record (`APTransactionModel`) to link to GL lines.

3. **Post a Bank‐to‐Bank Transfer** (move funds between two BankAccounts)

   - Input:

     ```json
     {
       "fromBankAccountId": "<BankAccountId1>",
       "toBankAccountId": "<BankAccountId2>",
       "amount": 1000.0, // in “from” account’s currency
       "fromCurrency": "USD",
       "fromExchangeRate": 75.0, // 1 USD = 75 INR
       "toCurrency": "EUR",
       "toExchangeRate": 85.0, // 1 EUR = 85 INR
       "remarks": "Transfer from HDFC (USD) to ICICI (EUR)"
     }
     ```

   - Behavior:

     1. If both bank accounts are the **same currency**, simply post a single GL transaction:

        - **Line 1**: Debit `linkedCoaAccount` for the **destination** by `amount` (currency), local = `amount × exchangeRate`.
        - **Line 2**: Credit `linkedCoaAccount` for the **source** by `amount` (same currency), local = `amount × exchangeRate`.
        - Balanced, because local debits = local credits (assuming same rate).

     2. If they are **different currencies**, you need two legs plus possibly an FX adjustment:

        - Convert `amount` in “from” currency to INR (functional) via `fromAmount × fromExchangeRate = fromLocal`.

        - Compute the equivalent “to” currency amount as `toAmount × toExchangeRate = toLocal`.

        - Normally, if you say “I want to transfer \$1,000 (USD) to €800 (EUR)”, your local legs might be:

          - **Line 1**: Debit `ICICI_EUR_ACCOUNT` by €800, local = €800 × 85 INR = ₹68,000.
          - **Line 2**: Credit `HDFC_USD_ACCOUNT` by \$1,000, local = \$1,000 × 75 INR = ₹75,000.
          - Now you have a local imbalance: +68,000 (debit) vs. −75,000 (credit) = **₹7,000 CR** difference.
          - You need a third “FX Loss/Gain” line to balance local:

            - If “Debit side (68,000) < Credit (75,000)”, then you have a **Loss** of ₹7,000.
            - That means: you either

              1. Debit an “FX Loss” expense account by ₹7,000 (to add 7,000 DR), making local side: 68,000 (DR) + 7,000 (DR) = 75,000 (DR) = 75,000 (CR).
              2. Or credit an “FX Gain” account if the reverse happened.

        - Implementation wise: compute

          ```js
          fromLocal = amountFrom * fromExchangeRate;
          toLocal = amountTo * toExchangeRate;
          diffLocal = toLocal - fromLocal; // positive if local debit > local credit
          ```

          If `diffLocal !== 0`, then include a line to an FX Gain/Loss account.

Below is a complete `controllers/cashJournal.controller.js` implementing the above 3 functions. We assume you have the following supporting models already imported (adjust paths as needed):

- `GLJournalModel` (or `VoucherModel`) to store GL journals. We assume its schema matches the one discussed earlier (with `lines: [{ account: ObjectId, debit, credit, currency, exchangeRate, localAmount, dims, extras }]`, and a pre‐save hook that enforces balancing).
- `AccountModel` (your Chart of Accounts) to look up AR, AP, FX, COGS, etc.
- `BankAccountModel` (just created above) to link to a leaf Account.
- Optionally, subledger models: `ARTransactionModel` and `APTransactionModel` (simple schemas to record receipts/payments, see below).

We’ll provide minimal dummy subledgers for AR and AP, just to demonstrate the link.

---

### 3.3 Sub‐ledger Models (Simplified)

Create simple files in `models/arTransaction.model.js` and `models/apTransaction.model.js`:

```js
// models/arTransaction.model.js
import mongoose, { Schema, model } from "mongoose";

const arTxnSchema = new Schema(
  {
    txnDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    sourceType: {
      type: String,
      enum: ["SALES"], // always SALES in this context
      required: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "SalesOrders", // or whichever model holds your invoice
    },
    // Optional line‐number if you allow multi‐line invoices:
    sourceLine: {
      type: Number,
      default: 1,
    },
    customer: {
      type: Schema.Types.ObjectId,
      ref: "Customers",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Amount ≥ 0"],
    },
    currency: {
      type: String,
      required: true,
    },
    exchangeRate: {
      type: Number,
      required: true,
      min: [0, "ExchangeRate ≥ 0"],
    },
    localAmount: {
      type: Number,
      required: true,
    },
    bankAccount: {
      type: Schema.Types.ObjectId,
      ref: "BankAccounts",
      required: true,
    },
    remarks: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export const ARTransactionModel =
  mongoose.models.ARTransactions || model("ARTransactions", arTxnSchema);
```

```js
// models/apTransaction.model.js
import mongoose, { Schema, model } from "mongoose";

const apTxnSchema = new Schema(
  {
    txnDate: {
      type: Date,
      required: true,
      default: Date.now,
    },
    sourceType: {
      type: String,
      enum: ["PURCHASE"], // always PURCHASE for AP
      required: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      ref: "PurchaseOrders",
    },
    sourceLine: {
      type: Number,
      default: 1,
    },
    supplier: {
      type: Schema.Types.ObjectId,
      ref: "Suppliers",
      required: true,
    },
    amount: {
      type: Number,
      required: true,
      min: [0, "Amount ≥ 0"],
    },
    currency: {
      type: String,
      required: true,
    },
    exchangeRate: {
      type: Number,
      required: true,
      min: [0, "ExchangeRate ≥ 0"],
    },
    localAmount: {
      type: Number,
      required: true,
    },
    bankAccount: {
      type: Schema.Types.ObjectId,
      ref: "BankAccounts",
      required: true,
    },
    remarks: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

export const APTransactionModel =
  mongoose.models.APTransactions || model("APTransactions", apTxnSchema);
```

---

### 3.4 General‐Ledger Journal Model (Recap)

We assume you already have something like this `GLJournalModel`. If not, create `models/glJournal.model.js`:

```js
// models/glJournal.model.js
import mongoose, { Schema, model } from "mongoose";

const glLineSchema = new Schema(
  {
    account: {
      type: Schema.Types.ObjectId,
      ref: "Accounts",
      required: [true, "Account is required."],
    },
    debit: {
      type: Number,
      default: 0,
      min: [0, "Debit ≥ 0"],
    },
    credit: {
      type: Number,
      default: 0,
      min: [0, "Credit ≥ 0"],
    },
    currency: {
      type: String,
      required: [true, "Currency is required."],
      trim: true,
    },
    exchangeRate: {
      type: Number,
      required: [true, "Exchange rate is required."],
      min: [0, "Exchange rate ≥ 0."],
    },
    localAmount: {
      type: Number,
      required: [true, "Local amount is required."],
    },
    // Link to subledger (if any)
    subledger: {
      sourceType: {
        type: String,
        enum: ["AR", "AP", "BANK_TRANSFER", "FX_REVAL"],
        default: null,
      },
      txnId: {
        type: Schema.Types.ObjectId,
      },
      lineNum: {
        type: Number,
      },
    },
    // dims, extras optional
    dims: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
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
    voucherNo: {
      type: String,
      required: [true, "voucherNo is required."],
      unique: true,
      trim: true,
    },
    voucherDate: {
      type: Date,
      required: [true, "voucherDate is required."],
      default: Date.now,
    },
    sourceType: {
      type: String,
      enum: ["AR_RECEIPT", "AP_PAYMENT", "BANK_TRANSFER", "FX_REVALUATION"],
      required: true,
    },
    sourceId: {
      type: Schema.Types.ObjectId,
      required: true,
      // e.g. ARReceipt txn._id, APPayment txn._id, or whatever
    },
    lines: {
      type: [glLineSchema],
      required: [true, "GL Journal must have at least one line."],
      validate: {
        validator(arr) {
          return Array.isArray(arr) && arr.length > 0;
        },
        message: "A GL Journal needs at least one line.",
      },
    },
  },
  { timestamps: true }
);

/**
 * Pre‐save hook to ensure the journal is balanced (sum(debit) == sum(credit))
 */
glJournalSchema.pre("save", function (next) {
  // Sum in functional currency, using each line’s localAmount
  // However, since localAmount may be positive or negative depending on debit/credit,
  // we can enforce: sum( localAmount ) == 0
  let sumLocal = 0;
  for (let ln of this.lines) {
    // Convention: localAmount is signed: debit → +, credit → – (or vice versa).
    // To keep it consistent, we can recompute local as (debit - credit) * exchangeRate.
    const computedLocal = (ln.debit - ln.credit) * ln.exchangeRate;
    sumLocal += Math.round(computedLocal * 100) / 100;
  }
  sumLocal = Math.round(sumLocal * 100) / 100;
  if (sumLocal !== 0) {
    return next(
      new Error(
        `GL is unbalanced: sumLocal = ${sumLocal.toFixed(
          2
        )}, must be 0. Check debits/credits & exchange rates.`
      )
    );
  }
  next();
});

// Index for fast lookups by date
glJournalSchema.index({ voucherDate: 1, createdAt: -1 });

export const GLJournalModel =
  mongoose.models.GLJournals || model("GLJournals", glJournalSchema);
```

> **Note on `localAmount`:**
> We are recomputing `localAmount` inside the pre‐save hook rather than trusting the user’s input. That ensures data integrity. Each `localAmount` should be `(debit - credit) × exchangeRate`. If you prefer to store a separate `drLocal` and `crLocal`, that is fine too, but using a single signed `localAmount` is simpler.

---

### 3.5 CashJournal Controller Implementation

Now create `controllers/cashJournal.controller.js`:

```js
// controllers/cashJournal.controller.js

import mongoose from "mongoose";
import { BankAccountModel } from "../models/bankAccount.model.js";
import { AccountModel } from "../models/account.model.js";
import { ARTransactionModel } from "../models/arTransaction.model.js";
import { APTransactionModel } from "../models/apTransaction.model.js";
import { GLJournalModel } from "../models/glJournal.model.js";
import VoucherService from "../services/voucher.service.js"; // or directly use GLJournalModel

/**
 * Utility to round numbers to 2 decimal places.
 */
function round2(x) {
  return Math.round(x * 100) / 100;
}

/**
 * 1) AR Receipt: Customer pays you -> Debit BankAccount, Credit Accounts Receivable.
 *
 *    Request Body:
 *    {
 *      "bankAccountId": "<ObjectId>",
 *      "customerId": "<ObjectId>",
 *      "amount": 1000.00,
 *      "currency": "USD",
 *      "exchangeRate": 75.00,
 *      "invoiceId": "<SalesInvoice ObjectId>",
 *      "remarks": "Receipt for INV_000123"
 *    }
 */
export const postARReceipt = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      bankAccountId,
      customerId,
      amount,
      currency,
      exchangeRate,
      invoiceId,
      remarks,
    } = req.body;

    // 1. Basic validation
    if (
      !bankAccountId ||
      !customerId ||
      !invoiceId ||
      !amount ||
      !currency ||
      !exchangeRate
    ) {
      throw new Error(
        "bankAccountId, customerId, invoiceId, amount, currency, exchangeRate are required."
      );
    }
    if (!mongoose.Types.ObjectId.isValid(bankAccountId)) {
      throw new Error("Invalid bankAccountId.");
    }
    if (!mongoose.Types.ObjectId.isValid(customerId)) {
      throw new Error("Invalid customerId.");
    }
    if (!mongoose.Types.ObjectId.isValid(invoiceId)) {
      throw new Error("Invalid invoiceId.");
    }

    // 2. Fetch BankAccount
    const bankAcc = await BankAccountModel.findById(bankAccountId).session(
      session
    );
    if (!bankAcc || !bankAcc.isActive) {
      throw new Error("BankAccount not found or inactive.");
    }
    if (bankAcc.currency !== currency) {
      throw new Error(
        `Currency mismatch: BankAccount currency is ${bankAcc.currency}, but received ${currency}.`
      );
    }

    // 3. Determine COA IDs
    //  - bankAcc.linkedCoaAccount (leaf COA for this bank account)
    //  - AR account (lookup by code "1.1.2" or some known code)
    const bankCoaId = bankAcc.linkedCoaAccount;
    const arAccount = await AccountModel.findOne({
      accountCode: "1.1.2", // replace with your actual AR leaf code
    }).session(session);
    if (!arAccount) {
      throw new Error("Accounts Receivable account not found in COA.");
    }
    const arCoaId = arAccount._id;

    // 4. Compute localAmount
    const localAmount = round2(amount * exchangeRate);

    // 5. Create AR subledger transaction
    const arTxn = await ARTransactionModel.create(
      [
        {
          txnDate: new Date(),
          sourceType: "SALES",
          sourceId: invoiceId,
          sourceLine: 1,
          customer: customerId,
          amount: round2(amount),
          currency: currency.trim(),
          exchangeRate: round2(exchangeRate),
          localAmount,
          bankAccount: bankAccountId,
          remarks: remarks || "",
        },
      ],
      { session }
    );
    const arTxnDoc = arTxn[0];

    // 6. Build GL Journal lines
    //    Line 1: Debit bank account (bankCoaId) by [amount/currency] → local = +localAmount
    //    Line 2: Credit AR (arCoaId) by [amount/currency] → local = -localAmount
    const voucherNo = await VoucherService.getNextVoucherNo();

    const glLines = [
      {
        account: bankCoaId,
        debit: round2(amount),
        credit: 0,
        currency: currency.trim(),
        exchangeRate: round2(exchangeRate),
        // localAmount = + (debit - credit) * exchangeRate
        localAmount: localAmount,
        subledger: {
          sourceType: "AR",
          txnId: arTxnDoc._id,
          lineNum: 1,
        },
      },
      {
        account: arCoaId,
        debit: 0,
        credit: round2(amount),
        currency: currency.trim(),
        exchangeRate: round2(exchangeRate),
        // localAmount = (0 - credit) * exchangeRate = -localAmount
        localAmount: -localAmount,
        subledger: {
          sourceType: "AR",
          txnId: arTxnDoc._id,
          lineNum: 1,
        },
      },
    ];

    // 7. Create GLJournal
    const glJournal = new GLJournalModel({
      voucherNo,
      voucherDate: new Date(),
      sourceType: "AR_RECEIPT",
      sourceId: arTxnDoc._id,
      lines: glLines,
    });
    await glJournal.save({ session });

    // 8. Commit
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: "success",
      message: "AR Receipt posted and GL Journal created.",
      data: { arTxn: arTxnDoc, glJournal },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ postARReceipt Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 2) AP Payment: You pay a supplier -> Debit Accounts Payable, Credit BankAccount.
 *
 *    Request Body:
 *    {
 *      "bankAccountId": "<ObjectId>",
 *      "supplierId": "<ObjectId>",
 *      "amount": 500.00,
 *      "currency": "USD",
 *      "exchangeRate": 75.00,
 *      "purchaseInvoiceId": "<PurchaseInvoice ObjectId>",
 *      "remarks": "Payment for PCH_000456"
 *    }
 */
export const postAPPayment = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      bankAccountId,
      supplierId,
      amount,
      currency,
      exchangeRate,
      purchaseInvoiceId,
      remarks,
    } = req.body;

    // 1. Basic validation
    if (
      !bankAccountId ||
      !supplierId ||
      !purchaseInvoiceId ||
      !amount ||
      !currency ||
      !exchangeRate
    ) {
      throw new Error(
        "bankAccountId, supplierId, purchaseInvoiceId, amount, currency, exchangeRate are required."
      );
    }
    if (!mongoose.Types.ObjectId.isValid(bankAccountId)) {
      throw new Error("Invalid bankAccountId.");
    }
    if (!mongoose.Types.ObjectId.isValid(supplierId)) {
      throw new Error("Invalid supplierId.");
    }
    if (!mongoose.Types.ObjectId.isValid(purchaseInvoiceId)) {
      throw new Error("Invalid purchaseInvoiceId.");
    }

    // 2. Fetch BankAccount
    const bankAcc = await BankAccountModel.findById(bankAccountId).session(
      session
    );
    if (!bankAcc || !bankAcc.isActive) {
      throw new Error("BankAccount not found or inactive.");
    }
    if (bankAcc.currency !== currency) {
      throw new Error(
        `Currency mismatch: BankAccount currency is ${bankAcc.currency}, but received ${currency}.`
      );
    }

    // 3. Determine COA IDs
    //  - bankAcc.linkedCoaAccount
    //  - AP account (lookup by code "2.1.1" or whichever is your AP leaf code)
    const bankCoaId = bankAcc.linkedCoaAccount;
    const apAccount = await AccountModel.findOne({
      accountCode: "2.1.1", // replace with your actual AP leaf code
    }).session(session);
    if (!apAccount) {
      throw new Error("Accounts Payable account not found in COA.");
    }
    const apCoaId = apAccount._id;

    // 4. Compute localAmount
    const localAmount = round2(amount * exchangeRate);

    // 5. Create AP subledger transaction
    const apTxn = await APTransactionModel.create(
      [
        {
          txnDate: new Date(),
          sourceType: "PURCHASE",
          sourceId: purchaseInvoiceId,
          sourceLine: 1,
          supplier: supplierId,
          amount: round2(amount),
          currency: currency.trim(),
          exchangeRate: round2(exchangeRate),
          localAmount,
          bankAccount: bankAccountId,
          remarks: remarks || "",
        },
      ],
      { session }
    );
    const apTxnDoc = apTxn[0];

    // 6. Build GL Journal lines
    //    Line 1: Debit AP (apCoaId) by amount ↑ local = +localAmount
    //    Line 2: Credit bank account (bankCoaId) by amount ↑ local = -localAmount
    const voucherNo = await VoucherService.getNextVoucherNo();

    const glLines = [
      {
        account: apCoaId,
        debit: round2(amount),
        credit: 0,
        currency: currency.trim(),
        exchangeRate: round2(exchangeRate),
        localAmount: localAmount,
        subledger: {
          sourceType: "AP",
          txnId: apTxnDoc._id,
          lineNum: 1,
        },
      },
      {
        account: bankCoaId,
        debit: 0,
        credit: round2(amount),
        currency: currency.trim(),
        exchangeRate: round2(exchangeRate),
        localAmount: -localAmount,
        subledger: {
          sourceType: "AP",
          txnId: apTxnDoc._id,
          lineNum: 1,
        },
      },
    ];

    // 7. Create GLJournal
    const glJournal = new GLJournalModel({
      voucherNo,
      voucherDate: new Date(),
      sourceType: "AP_PAYMENT",
      sourceId: apTxnDoc._id,
      lines: glLines,
    });
    await glJournal.save({ session });

    // 8. Commit
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: "success",
      message: "AP Payment posted and GL Journal created.",
      data: { apTxn: apTxnDoc, glJournal },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ postAPPayment Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};

/**
 * 3) Bank‐to‐Bank Transfer: Move funds from one bank account to another.
 *
 *    Request Body:
 *    {
 *      "fromBankAccountId": "<ObjectId>",
 *      "toBankAccountId": "<ObjectId>",
 *      "amountFrom": 1000.00,
 *      "currencyFrom": "USD",
 *      "exchangeRateFrom": 75.00,
 *      "amountTo": 800.00,
 *      "currencyTo": "EUR",
 *      "exchangeRateTo": 85.00,
 *      "remarks": "USD→EUR transfer"
 *    }
 *
 *  If currencyFrom === currencyTo, we only need two lines (debit/credit).
 *  If different, we need a third “FX Gain/Loss” line to balance.
 */
export const postBankTransfer = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      fromBankAccountId,
      toBankAccountId,
      amountFrom,
      currencyFrom,
      exchangeRateFrom,
      amountTo,
      currencyTo,
      exchangeRateTo,
      remarks,
    } = req.body;

    // 1. Basic validation
    if (
      !fromBankAccountId ||
      !toBankAccountId ||
      !amountFrom ||
      !currencyFrom ||
      !exchangeRateFrom ||
      !amountTo ||
      !currencyTo ||
      !exchangeRateTo
    ) {
      throw new Error(
        "fromBankAccountId, toBankAccountId, amountFrom, currencyFrom, exchangeRateFrom, amountTo, currencyTo, exchangeRateTo are required."
      );
    }
    if (
      !mongoose.Types.ObjectId.isValid(fromBankAccountId) ||
      !mongoose.Types.ObjectId.isValid(toBankAccountId)
    ) {
      throw new Error("Invalid BankAccountId.");
    }
    if (fromBankAccountId === toBankAccountId) {
      throw new Error(
        "fromBankAccountId and toBankAccountId cannot be the same."
      );
    }

    // 2. Fetch both BankAccount documents
    const fromBA = await BankAccountModel.findById(fromBankAccountId).session(
      session
    );
    if (!fromBA || !fromBA.isActive) {
      throw new Error("Source BankAccount not found or inactive.");
    }
    if (fromBA.currency !== currencyFrom) {
      throw new Error(
        `Source BankAccount currency mismatch: expected ${fromBA.currency}, got ${currencyFrom}`
      );
    }
    const toBA = await BankAccountModel.findById(toBankAccountId).session(
      session
    );
    if (!toBA || !toBA.isActive) {
      throw new Error("Destination BankAccount not found or inactive.");
    }
    if (toBA.currency !== currencyTo) {
      throw new Error(
        `Dest BankAccount currency mismatch: expected ${toBA.currency}, got ${currencyTo}`
      );
    }

    // 3. Determine COA IDs
    const fromCoaId = fromBA.linkedCoaAccount;
    const toCoaId = toBA.linkedCoaAccount;

    // 4. Compute local amounts
    const localFrom = round2(amountFrom * exchangeRateFrom);
    const localTo = round2(amountTo * exchangeRateTo);
    // FX difference in local currency
    const diffLocal = round2(localTo - localFrom);
    // If diffLocal > 0 → net local DEBIT bigger → we have an FX GAIN to record
    // If diffLocal < 0 → net local CREDIT bigger → we have an FX LOSS to record

    // 5. Build GL Journal lines
    const voucherNo = await VoucherService.getNextVoucherNo();
    const glLines = [];

    // a) Debit “to” account by amountTo in currencyTo
    glLines.push({
      account: toCoaId,
      debit: round2(amountTo),
      credit: 0,
      currency: currencyTo.trim(),
      exchangeRate: round2(exchangeRateTo),
      localAmount: localTo,
      subledger: {
        sourceType: "BANK_TRANSFER",
        txnId: null, // we’ll fill after we create a “BankTransfer” doc if needed
        lineNum: 1,
      },
    });

    // b) Credit “from” account by amountFrom in currencyFrom
    glLines.push({
      account: fromCoaId,
      debit: 0,
      credit: round2(amountFrom),
      currency: currencyFrom.trim(),
      exchangeRate: round2(exchangeRateFrom),
      localAmount: -localFrom,
      subledger: {
        sourceType: "BANK_TRANSFER",
        txnId: null,
        lineNum: 1,
      },
    });

    // c) If currencies differ, add FX Gain/Loss line to balance local
    if (diffLocal !== 0) {
      // Decide which COA account to use for FX gain/loss:
      //   if diffLocal > 0 → (localTo > localFrom) → local net DR > CR → that means we booked
      //     too little credit in local, so we have FX Gain (credit local) or FX Loss (debit local)?
      //   Actually: localTo (DR) − localFrom (CR) = diffLocal. If diffLocal > 0, then DR > CR, i.e. we need
      //     to **credit** an FX Gain account for diffLocal to make DR = CR.
      //   If diffLocal < 0, we need to **debit** an FX Loss account for |diffLocal|.
      //
      const fxAcct = await AccountModel.findOne({
        accountCode: diffLocal > 0 ? "FX_GAIN" : "FX_LOSS",
      }).session(session);
      if (!fxAcct) {
        throw new Error(
          `FX ${diffLocal > 0 ? "Gain" : "Loss"} account not found in COA.`
        );
      }

      if (diffLocal > 0) {
        // Credit FX Gain by diffLocal (in functional currency)
        glLines.push({
          account: fxAcct._id,
          debit: 0,
          credit: 0, // we store 0 in foreign currency fields (since no foreign currency here)
          currency: null, // you can keep null if this account is only functional
          exchangeRate: 1,
          localAmount: -diffLocal, // credit local
          subledger: {
            sourceType: "BANK_TRANSFER",
            txnId: null,
            lineNum: 1,
          },
        });
      } else {
        // diffLocal < 0 → we need to debit FX Loss
        const lossAmt = Math.abs(diffLocal);
        glLines.push({
          account: fxAcct._id,
          debit: 0,
          credit: 0,
          currency: null,
          exchangeRate: 1,
          localAmount: lossAmt, // debit local
          subledger: {
            sourceType: "BANK_TRANSFER",
            txnId: null,
            lineNum: 1,
          },
        });
      }
    }

    // 6. Create GLJournal (two or three lines)
    const glJournal = new GLJournalModel({
      voucherNo,
      voucherDate: new Date(),
      sourceType: "BANK_TRANSFER",
      sourceId: new mongoose.Types.ObjectId(), // we can leave blank or generate a separate BankTransfer doc if needed
      lines: glLines,
      extras: { remarks: remarks || "" },
    });
    await glJournal.save({ session });

    // 7. Commit
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: "success",
      message: "Bank transfer posted and GL Journal created.",
      data: glJournal,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ postBankTransfer Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};
```

#### Explanation of `CashJournalController`

1. **`postARReceipt`**

   - Validates inputs (`bankAccountId`, `customerId`, `invoiceId`, `amount`, `currency`, `exchangeRate`).
   - Fetches the `BankAccountModel` and checks its `currency`.
   - Fetches the COA “Accounts Receivable” leaf (by `accountCode: "1.1.2"`).
   - Computes `localAmount = amount × exchangeRate` (to functional INR).
   - Creates an `ARTransactionModel` record for subledger linkage.
   - Builds a balanced GL Journal with:

     1. **Debit** BankAccount (COA) → `(debit = amount, localAmount = +localAmount)`, linking to AR subledger.
     2. **Credit** AR (COA) → `(credit = amount, localAmount = −localAmount)`, same subledger.

   - Saves under a MongoDB transaction (`session`).

2. **`postAPPayment`**

   - Very similar, except:

     1. Creates an `APTransactionModel` subledger.
     2. **Debit** AP (COA) → `(debit = amount, localAmount = +localAmount)`
     3. **Credit** BankAccount (COA) → `(credit = amount, localAmount = −localAmount)`.

3. **`postBankTransfer`**

   - Validates `fromBankAccountId`, `toBankAccountId`, and currency/rate for both.
   - Computes `localFrom = amountFrom × exchangeRateFrom`, `localTo = amountTo × exchangeRateTo`.
   - Computes `diffLocal = localTo − localFrom`. If zero (same currency & same rate), only two lines needed.
   - If `diffLocal ≠ 0`, looks up an `FX_GAIN` or `FX_LOSS` account in the COA and posts a third GL line to balance the local.

     - For `diffLocal > 0`, you have a local **gain** (debited local side > credited), so you **credit** FX Gain by `diffLocal` (local).
     - For `diffLocal < 0`, you have a local **loss**, so you **debit** FX Loss by `|diffLocal|`.

   - Builds the GL Journal with lines:

     1. Debit destination bank’s COA leaf (amountTo, local = +localTo).
     2. Credit source bank’s COA leaf (amountFrom, local = −localFrom).
     3. (If needed) Debit or Credit FX Gain/Loss to balance local.

---

### 3.6 Routes for Cash/Bank Journals

Add a new file `routes/cashJournal.routes.js`:

```js
// routes/cashJournal.routes.js

import express from "express";
import {
  postARReceipt,
  postAPPayment,
  postBankTransfer,
} from "../controllers/cashJournal.controller.js";

const router = express.Router();

// 1. AR Receipt: POST /api/v1/cash‐journals/ar‐receipt
router.post("/ar‐receipt", postARReceipt);

// 2. AP Payment: POST /api/v1/cash‐journals/ap‐payment
router.post("/ap‐payment", postAPPayment);

// 3. Bank Transfer: POST /api/v1/cash‐journals/bank‐transfer
router.post("/bank‐transfer", postBankTransfer);

export default router;
```

In your main `app.js`, mount:

```js
// app.js (excerpt)

import cashJournalRoutes from "./routes/cashJournal.routes.js";

app.use("/api/v1/cash‐journals", cashJournalRoutes);
```

---

## 4. Currency Revaluation of Bank Accounts

Most companies hold foreign‐currency bank accounts (e.g. a USD‐denominated bank account). At period-end (e.g. 31 March, 30 June), you must revalue that foreign currency balance to the functional currency (INR). The difference between the historical rate (or last posting rate) and the current spot rate is booked to an **FX Gain** or **FX Loss** account. Below is a worked example and code.

### 4.1 Example Scenario

- Functional currency = **INR**.

- You have a **USD Bank Account** (e.g. “Axis Bank USD Savings”).

- On 2025-06-01, you posted a \$10,000 deposit at USD→INR ₹75. Thus, GL lines:

  1. **Debit** AxisBankUSDAccount: \$10,000 @ ₹75 → local ₹750,000
  2. **Credit** AR (or SalesRevenue): \$10,000 @ ₹75 → local ₹−750,000

- Over June, you did not post any more to this USD account. Its **booked USD balance** = \$10,000 (equivalent ₹750,000).

- At the end of Q2 (2025-06-30), the USD/INR spot rate is ₹76 (instead of ₹75).

  - The USD bank account should now show \$10,000 × ₹76 = ₹760,000 (not ₹750,000).
  - Thus you have an **unrealized FX gain** of ₹10,000 (₹760,000 − ₹750,000).

- To record that, you create a GL journal dated 2025-06-30:

  1. **Debit** USD Bank Account (COA) by ₹10,000
  2. **Credit** FX Gain (COA) by ₹10,000

  Now,

  - The bank’s local INR balance moves from ₹750,000 → ₹760,000 (because you debited ₹10,000).
  - The difference is credited to FX Gain.

If instead the spot was ₹74 at month-end, you would have a ₹−10,000 difference (₹740,000 − ₹750,000 = −₹10,000), i.e. **FX Loss** of ₹10,000, and you’d post:

- **Debit** FX Loss ₹10,000
- **Credit** USD Bank Account ₹10,000

### 4.2 Implementation: FX Revaluation Endpoint

Add a new method in `controllers/cashJournal.controller.js` (or create a separate `fxReval.controller.js`). Below is a snippet appended at the bottom of `cashJournal.controller.js`. We assume you already know which bank account(s) you want to revalue. The request will supply:

```json
{
  "bankAccountId": "<ObjectId>",
  "asOfDate": "2025-06-30",
  "spotRate": 76.0,
  "remarks": "June‐end FX reval"
}
```

The controller will:

1. Fetch the current USD balance of that bank account by aggregating GLJournal lines up to `asOfDate` for that bank account.

2. Convert that USD balance to INR at the “last booked rate” (we must find the weighted average historical rate or assume that the “book local balance” on that account is just the sum of line.localAmount). But an easier approach:

   - Sum up all **`localAmount`** for GL lines posted to that bank account up to `asOfDate` = **booked local** (INR).
   - Also, sum up all **`debitDebitEq`** and **`creditCreditEq`** for the foreign currency amounts to compute the “foreign currency net balance” = Σ(debitForeign) − Σ(creditForeign).
   - That “foreign currency net” × `spotRate` = **revaluedLocal**.
   - The difference = `revaluedLocal − bookedLocal` = `diffLocal`.

3. Create a GL Journal with two lines:

   - If `diffLocal > 0`, **Debit** bank account by `diffLocal` (INR) and **Credit** FX Gain by `diffLocal`.
   - If `diffLocal < 0`, **Debit** FX Loss by `|diffLocal|` and **Credit** bank account by `|diffLocal|`.

Below is the code:

```js
// controllers/cashJournal.controller.js (append at bottom)

import { AccountModel } from "../models/account.model.js";
import { CashFXRevalModel } from "../models/cashFXReval.model.js"; // if you want to store reval events (optional)

/**
 * 4) FX Revaluation: Revalue a foreign‐currency bank account as of a given date.
 *
 *    Request Body:
 *    {
 *      "bankAccountId": "<ObjectId>",
 *      "asOfDate": "2025-06-30",
 *      "spotRate": 76.00,
 *      "remarks": "June‐end FX revaluation"
 *    }
 */
export const postFXRevaluation = async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const { bankAccountId, asOfDate, spotRate, remarks } = req.body;

    if (!bankAccountId || !asOfDate || !spotRate) {
      throw new Error("bankAccountId, asOfDate, and spotRate are required.");
    }
    if (!mongoose.Types.ObjectId.isValid(bankAccountId)) {
      throw new Error("Invalid bankAccountId.");
    }

    // 1) Fetch BankAccount
    const bankAcc = await BankAccountModel.findById(bankAccountId).session(
      session
    );
    if (!bankAcc || !bankAcc.isActive) {
      throw new Error("BankAccount not found or inactive.");
    }

    // It must be a non‐functional currency (i.e. currency != functional). For demonstration, assume INR is functional.
    const functionalCurrency = "INR";
    if (bankAcc.currency === functionalCurrency) {
      throw new Error("Cannot revalue a bank account in functional currency.");
    }

    // 2) Compute net foreign currency balance and booked local balance as of asOfDate
    const cutoff = new Date(asOfDate + "T23:59:59.999Z");

    // a) Aggregate GLJournal lines to get:
    //    1. netForeign = Σ(debit if currency==bankAcc.currency) − Σ(credit if currency==bankAcc.currency)
    //    2. bookedLocal = Σ(localAmount) for those lines (that local amount is already computed at historical rates).
    const agg = await GLJournalModel.aggregate([
      { $unwind: "$lines" },
      {
        $match: {
          "lines.account": bankAcc.linkedCoaAccount,
          voucherDate: { $lte: cutoff },
          "lines.currency": bankAcc.currency,
        },
      },
      {
        $group: {
          _id: null,
          netForeign: {
            $sum: {
              $subtract: ["$lines.debit", "$lines.credit"],
            },
          },
          bookedLocal: {
            $sum: "$lines.localAmount",
          },
        },
      },
    ]).session(session);

    const netForeign = agg.length ? agg[0].netForeign : 0; // e.g. 10000 (USD)
    const bookedLocal = agg.length ? agg[0].bookedLocal : 0; // e.g. 750000 (INR)

    // 3) Compute revalued local = netForeign × spotRate
    const revaluedLocal = round2(netForeign * spotRate);

    // 4) Compute difference
    const diffLocal = round2(revaluedLocal - bookedLocal);

    if (diffLocal === 0) {
      // No revaluation needed
      await session.commitTransaction();
      session.endSession();
      return res.status(200).json({
        status: "success",
        message: "No FX revaluation needed; already at spot.",
        data: { netForeign, bookedLocal, revaluedLocal, diffLocal },
      });
    }

    // 5) Build GL Journal lines
    const voucherNo = await VoucherService.getNextVoucherNo();
    const glLines = [];

    // a) If diffLocal > 0 → local is higher now → FX Gain. → Credit FX Gain, Debit Bank.
    // b) If diffLocal < 0 → local is lower → FX Loss. → Debit FX Loss, Credit Bank.

    // Fetch relevant FX Gain or FX Loss account
    const fxAcct = await AccountModel.findOne({
      accountCode: diffLocal > 0 ? "FX_GAIN" : "FX_LOSS",
    }).session(session);
    if (!fxAcct) {
      throw new Error(
        `FX ${diffLocal > 0 ? "Gain" : "Loss"} account not found in COA.`
      );
    }

    if (diffLocal > 0) {
      // Debit bank by diffLocal, Credit FX Gain by diffLocal
      glLines.push({
        account: bankAcc.linkedCoaAccount,
        debit: 0,
        credit: 0, // local currency only
        currency: functionalCurrency,
        exchangeRate: 1.0,
        localAmount: diffLocal, // [DEBIT local = +diffLocal]
        subledger: {
          sourceType: "FX_REVALUATION",
          txnId: null,
          lineNum: 1,
        },
      });
      glLines.push({
        account: fxAcct._id,
        debit: 0,
        credit: 0,
        currency: functionalCurrency,
        exchangeRate: 1.0,
        localAmount: -diffLocal, // [CREDIT local = -diffLocal]
        subledger: {
          sourceType: "FX_REVALUATION",
          txnId: null,
          lineNum: 1,
        },
      });
    } else {
      // diffLocal < 0 → local net is lower → FX Loss
      const lossAmt = Math.abs(diffLocal);
      glLines.push({
        account: fxAcct._id,
        debit: 0,
        credit: 0,
        currency: functionalCurrency,
        exchangeRate: 1.0,
        localAmount: lossAmt, // [DEBIT local = +lossAmt]
        subledger: {
          sourceType: "FX_REVALUATION",
          txnId: null,
          lineNum: 1,
        },
      });
      glLines.push({
        account: bankAcc.linkedCoaAccount,
        debit: 0,
        credit: 0,
        currency: functionalCurrency,
        exchangeRate: 1.0,
        localAmount: -lossAmt, // [CREDIT local = -lossAmt]
        subledger: {
          sourceType: "FX_REVALUATION",
          txnId: null,
          lineNum: 1,
        },
      });
    }

    // 6) Create GLJournal
    const glJournal = new GLJournalModel({
      voucherNo,
      voucherDate: cutoff,
      sourceType: "FX_REVALUATION",
      sourceId: bankAccountId, // you can store the bankAccount as the source
      lines: glLines,
      extras: {
        spotRate: round2(spotRate),
        oldLocalBalance: round2(bookedLocal),
        newLocalBalance: round2(revaluedLocal),
        remarks: remarks || "",
      },
    });
    await glJournal.save({ session });

    // 7) Optionally, record this reval event to a separate collection (for audit)
    // const fxRevalRecord = await CashFXRevalModel.create(
    //   [
    //     {
    //       bankAccount: bankAccountId,
    //       asOfDate: cutoff,
    //       spotRate: round2(spotRate),
    //       netForeign,
    //       bookedLocal,
    //       revaluedLocal,
    //       diffLocal: round2(diffLocal),
    //       glJournal: glJournal._id,
    //       remarks: remarks || "",
    //     },
    //   ],
    //   { session }
    // );
    // const fxRevalDoc = fxRevalRecord[0];

    // 8) Commit
    await session.commitTransaction();
    session.endSession();

    return res.status(201).json({
      status: "success",
      message: "FX Revaluation posted and GL Journal created.",
      data: {
        bankAccountId,
        netForeign,
        bookedLocal,
        revaluedLocal,
        diffLocal,
        glJournal,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("❌ postFXRevaluation Error:", error);
    return res.status(400).json({ status: "failure", message: error.message });
  }
};
```

> **Notes on FX Revaluation**
>
> 1. We aggregate all GL lines on that bank account (foreign currency) up to the “asOfDate,” summing:
>
>    - `netForeign = Σ(debitForeign) − Σ(creditForeign)`
>    - `bookedLocal = Σ(localAmount)`
>      If you always posted foreign currency jobs with `debitForeign=+amt, creditForeign=0` (for receipts) or `debitForeign=0, creditForeign=+amt` (for payments), then `netForeign` is simply “current foreign balance.”
>
> 2. We compute `revaluedLocal = netForeign × spotRate` (new local).
> 3. We find the difference `diffLocal = revaluedLocal − bookedLocal`. Positive means a **gain** (bank is worth more in INR); negative means a **loss**.
> 4. We post a balanced GL Journal with:
>
>    - If `diffLocal > 0`: **Debit** bank account (COA) by `diffLocal` (INR), **Credit** FX Gain (COA) by `diffLocal`.
>    - If `diffLocal < 0`: **Debit** FX Loss by `|diffLocal|`, **Credit** bank account by `|diffLocal|`.

---

### 3.7 Routes for FX Revaluation

Add to `routes/cashJournal.routes.js` (below the other endpoints):

```js
// routes/cashJournal.routes.js (continued)

import { postFXRevaluation } from "../controllers/cashJournal.controller.js";

// … existing routes …

// 4. FX Revaluation: POST /api/v1/cash‐journals/fx‐revaluation
router.post("/fx‐revaluation", postFXRevaluation);

export default router;
```

---

## 5. Putting It All in Context

1. **Bank Account Management**

   - You can create a new bank account (e.g. `POST /api/v1/bank-accounts` with `{ code:"HDFC_USD", name:"HDFC USD Account", type:"BANK", currency:"USD", accountNumber:"1234567890", linkedCoaAccount:"<COA._id for bank asset>" }`).
   - Fetch details, list all, update, or deactivate.

2. **AR Receipt (Customer Payment)**

   - Call `POST /api/v1/cash-journals/ar-receipt` with:

     ```json
     {
       "bankAccountId": "650fffa0a1b2c3d4e5f67890",
       "customerId": "650fffa0a1b2c3d4e5f67891",
       "amount": 1000.0,
       "currency": "USD",
       "exchangeRate": 75.0,
       "invoiceId": "650fffa0a1b2c3d4e5f67892",
       "remarks": "Receipt for Sales INV_000456"
     }
     ```

   - The system will:

     1. Create an `ARTransactionModel` record linking you to the Sales Invoice.
     2. Create a balanced GL journal:

        - Debit `HDFC_USD_Account` (COA leaf) by \$1,000 (local +75,000)
        - Credit `Accounts Receivable` (COA leaf) by \$1,000 (local −75,000)

3. **AP Payment (Supplier Payment)**

   - Call `POST /api/v1/cash-journals/ap-payment` with:

     ```json
     {
       "bankAccountId": "650fffa0a1b2c3d4e5f67893",
       "supplierId": "650fffa0a1b2c3d4e5f67894",
       "amount": 500.0,
       "currency": "EUR",
       "exchangeRate": 85.0,
       "purchaseInvoiceId": "650fffa0a1b2c3d4e5f67895",
       "remarks": "Payment for Purchase PCH_000789"
     }
     ```

   - The system:

     1. Creates an `APTransactionModel` subledger.
     2. Creates a balanced GL journal:

        - Debit `Accounts Payable` (COA) by €500 (local +42,500)
        - Credit `ICICI_EUR_Account` (COA leaf) by €500 (local −42,500)

4. **Bank‐to‐Bank Transfer**

   - Call `POST /api/v1/cash-journals/bank-transfer` with:

     ```json
     {
       "fromBankAccountId": "650fffa0a1b2c3d4e5f67896", // HDFC_USD
       "toBankAccountId": "650fffa0a1b2c3d4e5f67897", // ICICI_EUR
       "amountFrom": 1000.0,
       "currencyFrom": "USD",
       "exchangeRateFrom": 75.0,
       "amountTo": 800.0,
       "currencyTo": "EUR",
       "exchangeRateTo": 85.0,
       "remarks": "USD→EUR transfer"
     }
     ```

   - The system:

     1. Determines net foreign \$ balance (e.g. \$10,000) and booked local (₹750,000).
     2. Computes new local if 10,000 × 85 = ₹850,000.
     3. Difference = ₹100,000 UNREALIZED→ FX Gain.
     4. Creates GL Journal with lines:

        - **Debit** `ICICI_EUR_Account` by €800 (local +68,000)
        - **Credit** `HDFC_USD_Account` by \$1,000 (local −75,000)
        - **Credit** `FX_GAIN` account by ₹7,000 (no foreign currency)

     5. **Notice** local: 68,000 (DR) + 7,000 (DR) = 75,000 (CR) to 75,000 → balanced.

5. **FX Revaluation at Period End**

   - Call `POST /api/v1/cash-journals/fx-revaluation` with:

     ```json
     {
       "bankAccountId": "650fffa0a1b2c3d4e5f67896", // HDFC_USD
       "asOfDate": "2025-06-30",
       "spotRate": 76.0,
       "remarks": "June‐end revaluation"
     }
     ```

   - The system:

     1. Aggregates all GL lines for `HDFC_USD_Account` up to `2025-06-30`:

        - Finds net foreign USD balance = \$10,000.
        - Booked local = ₹750,000.

     2. Computes revaluedLocal = 10,000 × 76 = ₹760,000.
     3. diffLocal = ₹760,000 − ₹750,000 = ₹10,000 → FX Gain.
     4. Creates GL Journal with:

        - **Debit** `HDFC_USD_Account` by ₹10,000
        - **Credit** `FX_GAIN` by ₹10,000

---

## 6. Recap of Routes

```text
POST    /api/v1/bank-accounts          → createBankAccount
GET     /api/v1/bank-accounts          → listBankAccounts (optionally ?includeInactive=true)
GET     /api/v1/bank-accounts/:id      → getBankAccount
PATCH   /api/v1/bank-accounts/:id      → updateBankAccount
DELETE  /api/v1/bank-accounts/:id      → deleteBankAccount

POST    /api/v1/cash-journals/ar-receipt   → postARReceipt
POST    /api/v1/cash-journals/ap-payment    → postAPPayment
POST    /api/v1/cash-journals/bank-transfer → postBankTransfer
POST    /api/v1/cash-journals/fx-revaluation→ postFXRevaluation
```

---

## 7. How “Bank Account Balances” Are Computed

- We do **not** store a `currentBalance` on the BankAccount document itself (though you could if you want a quick lookup). Instead, the “true” balance of any bank account is computed as:

  ```js
  // e.g. compute balance for one BankAccount at any moment:
  const now = new Date();

  const agg = await GLJournalModel.aggregate([
    { $unwind: "$lines" },
    {
      $match: {
        "lines.account": bankAcc.linkedCoaAccount,
        voucherDate: { $lte: now },
      },
    },
    {
      $group: {
        _id: null,
        netForeignBalance: {
          $sum: { $subtract: ["$lines.debit", "$lines.credit"] },
        },
        netLocalBalance: { $sum: "$lines.localAmount" },
      },
    },
  ]);

  const foreignBalance = agg.length ? agg[0].netForeignBalance : 0;
  const localBalance = agg.length ? agg[0].netLocalBalance : 0;
  ```

- If you want an endpoint to retrieve the “live” balance for a given bank account, you could create a controller like:

  ```js
  export const getBankAccountBalance = async (req, res) => {
    try {
      const { id } = req.params;
      if (!mongoose.Types.ObjectId.isValid(id)) {
        return res
          .status(400)
          .json({ status: "failure", message: "Invalid ID" });
      }
      const ba = await BankAccountModel.findById(id);
      if (!ba) {
        return res
          .status(404)
          .json({ status: "failure", message: "Not found" });
      }

      const now = new Date();
      const agg = await GLJournalModel.aggregate([
        { $unwind: "$lines" },
        {
          $match: {
            "lines.account": ba.linkedCoaAccount,
            voucherDate: { $lte: now },
          },
        },
        {
          $group: {
            _id: null,
            netForeignBalance: {
              $sum: { $subtract: ["$lines.debit", "$lines.credit"] },
            },
            netLocalBalance: { $sum: "$lines.localAmount" },
          },
        },
      ]);

      const foreignBalance = agg.length ? agg[0].netForeignBalance : 0;
      const localBalance = agg.length ? agg[0].netLocalBalance : 0;

      return res.status(200).json({
        status: "success",
        data: {
          bankAccount: ba,
          foreignBalance,
          localBalance,
        },
      });
    } catch (error) {
      console.error(error);
      return res
        .status(500)
        .json({ status: "failure", message: error.message });
    }
  };
  ```

  And route it:

  ```js
  router.get("/balance/:id", getBankAccountBalance);
  ```

---

## 8. Summary & Best Practices

1. **Separate BankAccount (Payment Method) from COA**

   - `BankAccountModel` holds metadata (code, name, type, currency, accountNumber, linkedCOA \_id, openingBalance).
   - The true “balance” comes from summing your GL journals.

2. **Link BankAccount → COA Leaf**

   - Every BankAccount must have `linkedCoaAccount` pointing to a leaf `AccountModel` of type `ASSET` (e.g. “Cash”, “Bank – HDFC”, etc.).
   - On creation, validate that `linkedCoaAccount` exists and isLeaf = true & allowManualPost = true.

3. **Post AR Receipts & AP Payments**

   - AR Receipt:

     - Subledger: Create `ARTransactionModel` (+link to Sales Invoice & Customer).
     - GL Journal:

       1. Debit BankAccount (COA leaf)
       2. Credit Accounts Receivable (COA leaf)

   - AP Payment:

     - Subledger: Create `APTransactionModel` (+link to Purchase Invoice & Supplier).
     - GL Journal:

       1. Debit Accounts Payable (COA leaf)
       2. Credit BankAccount (COA leaf)

4. **Post Bank-to-Bank Transfer**

   - If both accounts share the same currency:

     1. Debit “to” bank account by amount
     2. Credit “from” bank account by amount

   - If different currencies, compute local:

     1. Debit “to” bank by amountTo → localTo
     2. Credit “from” bank by amountFrom → −localFrom
     3. Compute `diffLocal = localTo − localFrom` → If ≠ 0, post a third line to `FX_GAIN` (credit) or `FX_LOSS` (debit).

5. **FX Revaluation**

   - On a schedule (e.g. last business day of period), fetch each foreign account’s net foreign balance and booked local balance, compute revalued local at new spot rate, find difference, and post a two‐line GL journal:

     - If difference > 0: Debit bank, Credit FX Gain.
     - If difference < 0: Debit FX Loss, Credit bank.

6. **Trail Balance & Reports**

   - Once GL journals exist, run aggregations (discussed earlier) to produce a Trial Balance, Account Ledger, Income Statement, Balance Sheet, etc.

7. **Recommended Best Practices**

   - Always use _ObjectId references_ to `AccountModel`—never free‐text `accountCode`. This ensures data integrity and easy “drill-down.”
   - Use a central **`AccountModel`** (Chart of Accounts) with fields: `accountCode`, `accountName`, `type`, `parentAccount`, `normalBalance`, `isLeaf`, etc.
   - In each GL line, store:

     ```json
     {
       "account": "<AccountModel _id>",
       "debit": number,
       "credit": number,
       "currency": "USD",
       "exchangeRate": 75.00,
       "localAmount": 75000,
       "subledger": {
         "sourceType": "AR"|"AP"|"BANK_TRANSFER"|"FX_REVALUATION",
         "txnId": "<subledger _id>",
         "lineNum": 1
       }
     }
     ```

   - Always wrap multi‐document changes (subledger + GL journal) in a MongoDB transaction (`session`).
   - Enforce balanced GL in a pre‐save hook so that sum of all `(debit−credit)×exchangeRate == 0`.
   - Index heavily on `lines.account` for ledger queries, and on `voucherDate` for trial balance queries.

With these models, controllers, and routes, you now have:

- A **complete “Bank Account” master** that can hold multiple types (Cash, Bank, UPI, Crypto, etc.).
- A **CRUD interface** to manage those payment methods.
- A **CashJournalController** that posts AR receipts, AP payments, bank transfers, and FX revaluations—linking every subledger transaction to a balanced GL Journal.
- A clear pattern for **drill-down**: subledger → GL → COA.
- Everything you need to generate Trial Balances, Ledger reports, and financial statements in later conversations.

Feel free to modify account codes (e.g. `"1.1.2"` for AR or `"2.1.1"` for AP) to match your own Chart of Accounts. Also adjust field names (e.g. `sourceType`, `sourceId`) if your existing schemas differ slightly.

This completes the design, models, controllers, routes, and an example of FX revaluation. You should now be able to:

1. **Create new bank accounts** (including foreign currency)
2. **Receive customer receipts** into those accounts
3. **Pay suppliers** from those accounts
4. **Transfer between accounts** (cross‐currency or same‐currency)
5. **Revalue foreign‐currency accounts** at any cutoff date

All while maintaining a clean audit trail and full integration with your general ledger.
