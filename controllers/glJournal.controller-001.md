Below is a discussion of how to design and maintain a Chart of Accounts (COA) “master” in MongoDB/Mongoose—plus best practices for linking your sub-ledger and GL journals into that COA so you can drill down from sub-ledger entries to GL, and ultimately build a Trial Balance, Ledger reports, Income Statement, and Balance Sheet. We’ll cover:

1. **Why you want an Account Master**
2. **A recommended Mongoose schema for Accounts (Chart of Accounts)**
3. **How to link GL lines (and sub-ledgers) to those Accounts**
4. **How to “drill down” from sub-ledger → GL → Account**
5. **How to produce Trail Balance, Ledger, Income Statement, and Balance Sheet**
6. **Additional “best practices” tips**

---

## 1. Why You Want a Centralized Account Master

1. **Consistency & Integrity**

   - If every GL journal line stores a free-form string like `"SALES_REVENUE"`, typos creep in. By having a single “Account” collection (often called the Chart of Accounts), you centralize every valid account code, name, type, and hierarchy. Every journal line then refers to a validated Account document by its ObjectId or by a canonical code.

2. **Hierarchical Reporting**

   - Most COAs are hierarchical: e.g.

     - **1. Assets**

       - 1.1 Current Assets

         - 1.1.1 Cash
         - 1.1.2 Accounts Receivable

       - 1.2 Fixed Assets

     - **2. Liabilities**
     - **3. Equity**
     - **4. Revenue**
     - **5. Expenses**

   - A parent/child structure allows you to roll up balances (e.g. “Total Assets = sum of all child accounts”). You can easily generate a Balance Sheet by summing balances under Asset, Liability, Equity. Same for P\&L under Revenue/Expense.

3. **Drill-Down & Subledger Links**

   - If a sub-ledger entry (e.g. an AR transaction, inventory sale, tax transaction) knows “I posted to account X,” and “account X” is stored in the COA, you can trace exactly which GL journal lines hit that account, which in turn can link back to the original sub-ledger entry (e.g. via the GL line’s `extras.subledger` fields). That makes audit trails and “drill-down reporting” trivial.

4. **Financial Statement Generation**

   - When you want a Trial Balance (list of each account’s debit and credit totals), simply query your GL journal lines, group by their `accountCode` (or account `_id`), and sum up debit vs credit. Then you know which accounts have DR or CR net balances.
   - Income Statement (P\&L): sum all GL lines whose account type = `Revenue` or `Expense`, for the period.
   - Balance Sheet: sum GL lines whose account type = `Asset`, `Liability`, or `Equity`.

---

## 2. Mongoose Schema for “Account” (Chart of Accounts)

Below is a _recommended_ Mongoose schema for your COA. You can store it in, say, `models/account.model.js`. We’ll call it `AccountModel`.

```js
// models/account.model.js

import mongoose, { Schema, model } from "mongoose";

// ─────────────────────────────────────────────────────────────────────────────
// Sub‐schema for nested accounts (if you want to embed children; optional)
// ─────────────────────────────────────────────────────────────────────────────
const accountNodeSchema = new Schema(
  {
    _id: { type: Schema.Types.ObjectId, ref: "Accounts" },
    accountCode: { type: String, required: true },
    accountName: { type: String, required: true },
    children: [
      /* recursively embed if needed, otherwise skip this */
    ],
  },
  { _id: false }
);

// ─────────────────────────────────────────────────────────────────────────────
// 1. Top‐level Account schema
// ─────────────────────────────────────────────────────────────────────────────
const accountSchema = new Schema(
  {
    accountCode: {
      type: String,
      required: [true, "Account code is required"],
      trim: true,
      unique: true,
      match: [
        /^[A-Za-z0-9\.\-]+$/,
        "Account code may only contain letters, numbers, dots, dashes",
      ],
      // e.g. "1.1000", or "2000-Expense-Office"
    },
    accountName: {
      type: String,
      required: [true, "Account name is required"],
      trim: true,
    },

    // 2. The “type” of account (helps roll-up into BS or P&L)
    //    Common types: ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE
    type: {
      type: String,
      required: [true, "Account type is required"],
      enum: {
        values: ["ASSET", "LIABILITY", "EQUITY", "REVENUE", "EXPENSE"],
        message:
          "`type` must be one of ASSET, LIABILITY, EQUITY, REVENUE, EXPENSE",
      },
    },

    // 3. Parent account reference (allow to build a tree or hierarchy)
    parentAccount: {
      type: Schema.Types.ObjectId,
      ref: "Accounts",
      default: null,
    },

    // 4. “Normal balance” side: either DEBIT or CREDIT
    //    (helps when building Trial Balance or checking balance sign)
    normalBalance: {
      type: String,
      enum: ["DEBIT", "CREDIT"],
      required: [true, "Normal balance side is required"],
    },

    // 5. Whether this account is a “leaf” sub-ledger (i.e. you can post to it),
    //    or a pure “parent”/roll-up account (so you cannot post entries to it directly).
    isLeaf: {
      type: Boolean,
      required: true,
      default: true,
    },

    // 6. Optional “allowManualPost”: if false, you cannot post a GL line directly to this account.
    //    (Sometimes you want certain accounts to be system-only or controlled by sub-ledgers.)
    allowManualPost: {
      type: Boolean,
      required: true,
      default: true,
    },

    // 7. Extra fields like “currency” (if multi-currency chart of accounts),
    //    “description”, “openingBalance” if needed, etc.
    currency: {
      type: String,
      required: true,
      default: "INR",
      trim: true,
      // You could restrict to ["INR","USD","GBP",…] or allow any valid ISO code.
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },

    // 8. Any other flags or “grouping code” if you need multiple COAs
    group: {
      type: String,
      default: "",
      trim: true,
      // e.g. "OPERATIONS", "FINANCE", "GLOBAL" (for multi-entity usage)
    },

    // 9. Timestamps
  },
  {
    timestamps: true, // adds createdAt, updatedAt
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// 10. Indexes & Hooks
// ─────────────────────────────────────────────────────────────────────────────

// Ensure accountCode is unique
accountSchema.index({ accountCode: 1 }, { unique: true });

// Pre-save hook: if parentAccount is set, ensure parent exists
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
    // You might also require that parent.isLeaf = false, i.e. a non-leaf parent.
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

### Explanation of `AccountModel`

1. **`accountCode`** (String, required, unique)

   - The “natural” or unique code of the account, e.g. `"1.1000"` for Current Assets, `"4.2000"` for Sales Revenue, `"5.3000"` for Office Expense, etc.
   - We enforce an alphanumeric/dot/dash pattern so codes remain tidy. You can adjust the regex or remove it if you want more freedom.

2. **`accountName`** (String, required)

   - A human-readable name for the account, e.g. `"Cash on Hand"`, `"Accounts Receivable"`, `"Sales Revenue"`, `"Cost of Goods Sold"`, etc.

3. **`type`** (String, required, enum)

   - One of the five primary categories: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, or `EXPENSE`.
   - This allows you to classify accounts into Balance Sheet vs. P\&L:

     - BS accounts = `ASSET`, `LIABILITY`, `EQUITY`
     - P\&L accounts = `REVENUE`, `EXPENSE`

4. **`parentAccount`** (ObjectId, optional)

   - A self-reference to “roll up” multiple child accounts under a parent.
   - If `null`, this is a top-level account (e.g. “1. Assets”). If non-null, it must refer to another Account document whose `isLeaf` = `false`.

5. **`normalBalance`** (String, required, enum `["DEBIT","CREDIT"]`)

   - Tells you which side (Debit or Credit) normally holds a positive balance for this account.

     - e.g. `ASSET` & `EXPENSE` accounts typically have a **DEBIT** normal balance.
     - `LIABILITY`, `EQUITY`, & `REVENUE` normally have a **CREDIT** normal balance.

   - This is mostly used in formatting a Trial Balance (to decide if a net debit or net credit shows as a positive or negative number).

6. **`isLeaf`** (Boolean, required)

   - If `true`, it’s a “posting” account— you can post GL lines to it.
   - If `false`, it’s a “group/rollup” account—you usually _don’t_ post directly, but sum up child accounts.
   - Example:

     ```text
     1. (ASSET, isLeaf: false)
       1.1 (ASSET, isLeaf: false)
         1.1.1 Cash (ASSET, isLeaf: true)
         1.1.2 Accounts Receivable (ASSET, isLeaf: true)
       1.2 (ASSET, isLeaf: false)
         1.2.1 Inventory (ASSET, isLeaf: true)
     ```

   - In your pre-save hook, we check that if you set `parentAccount = someId`, then that parent exists and has `isLeaf === false`.

7. **`allowManualPost`** (Boolean)

   - If `false`, then your controller can refuse to let the user post to that account manually (only sub-ledgers—like your AR or Inventory—can post to it).
   - Example: You might set the top-level “1. Assets” as `allowManualPost: false`, but allow “1.1.1 Cash” as `allowManualPost: true`.

8. **`currency`** (String, required)

   - If your COA is multi-currency, you can store the functional currency or the “reporting currency.”
   - In simple single-currency implementations, you always set this to your company’s functional code (e.g. `"INR"` or `"GBP"`).
   - If you eventually allow multi-currency GL (i.e. each account can also have a separate “home currency”), you could store `currency` per account. For now, you can default it to your functional currency (e.g. `default: "INR"`).

9. **`description`** (String, optional)

   - Any notes about the account (e.g. “Used for petty cash in USD”, or “All receivables denominated in USD”).

10. **`group`** (String, optional)

    - Helps you categorize COA by business unit, region, or module (e.g. `"OPERATIONS"`, `"FINANCE"`, `"GLOBAL"`, `"US_ENTITY"`). For small companies, you can leave this empty.

11. **Indexes & Hooks**

    - We set a unique index on `accountCode`.
    - We have a pre-save hook that checks `parentAccount` is valid and not a leaf itself.

---

## 3. Linking GL Lines & Sub-Ledgers to Accounts

With `AccountModel` in place, each GL line in your `GLJournalModel` should refer back to an account—preferably by storing the `Account`’s `_id` instead of a raw string code. In our earlier `glJournal.model.js`, we used `accountCode` as a free string. Let’s modify it to reference the Account document:

#### Updated `glLineSchema` to reference `AccountModel`:

```js
// models/glJournal.model.js (modified)

import mongoose, { Schema, model } from "mongoose";

// … (other code) …

const glLineSchema = new Schema(
  {
    account: {
      type: Schema.Types.ObjectId,
      ref: "Accounts",
      required: true,
      // We store the actual Account _id instead of the bare string code.
    },
    debit: { type: Number, default: 0, min: [0, "Debit ≥ 0"] },
    credit: { type: Number, default: 0, min: [0, "Credit ≥ 0"] },
    currency: {
      type: String,
      required: [true, "Currency is required."],
      trim: true,
    },
    exchangeRate: {
      type: Number,
      required: [true, "Exchange rate is required."],
      min: [0, "Exchange rate ≥ 0"],
    },
    localAmount: {
      type: Number,
      required: [true, "Local amount is required."],
    },

    // dims & extras unchanged
    dims: {
      /* … same as before … */
    },
    extras: {
      type: Map,
      of: Schema.Types.Mixed,
      default: {},
    },
  },
  { _id: true }
);

// … rest of glJournalSchema unchanged …
```

Now, instead of `accountCode: "SALES_REVENUE"`, you’ll pass the **ObjectId** of the corresponding Account document. This ensures:

- You can **populate** the account and retrieve its `accountCode`, `accountName`, `type`, or `parentAccount` for reporting or drill-down.
- When you run queries to build a Trial Balance, you group by `account` (ObjectId) instead of the raw string—safer.

In your `createGLJournal` controller, you must now validate that the provided `account` (ObjectId) truly exists in `Accounts` and is a leaf (if `allowManualPost` is `true`). For example:

```js
// Inside createGLJournal, change the line validation:

const processedLines = await Promise.all(
  rawLines.map(async (ln, idx) => {
    const {
      account: accountId,
      debit = 0,
      credit = 0,
      currency,
      exchangeRate,
      localAmount,
      dims,
      extras,
    } = ln;

    // 1) accountId must be a valid ObjectId
    if (!mongoose.Types.ObjectId.isValid(accountId)) {
      throw new Error(`Line ${idx + 1}: account must be a valid Account _id.`);
    }
    const acct = await AccountModel.findById(accountId);
    if (!acct) {
      throw new Error(
        `Line ${idx + 1}: Account ${accountId} not found in COA.`
      );
    }
    if (!acct.isLeaf || !acct.allowManualPost) {
      throw new Error(
        `Line ${idx + 1}: Cannot post to account ${
          acct.accountCode
        } because not a leaf or manual post is disallowed.`
      );
    }

    // … rest of debit / credit / currency / exchangeRate validation …
    // localAmount computation…
    return {
      account: accountId,
      debit: d,
      credit: c,
      currency: currency.trim(),
      exchangeRate: roundToTwo(exchangeRate),
      localAmount: computedLocal,
      dims: dims || {},
      extras: extras || {},
    };
  })
);
```

And when you build your GL journal lines in JSON, each line’s `"account"` field is the ObjectId of whichever account you intend to post to.

---

## 4. Drill-Down: Sub-Ledger → GL → Account

Once you adopt the above structure:

1. **Sub-ledger entries (Inventory, AR, Tax, etc.)** each create their own sub-ledger transactions (e.g. `InventoryTransactionModel`, `ARTransactionModel`) and each of those sub-ledger records has an `_id`. In the service which posts your sales order, you create sub-ledger entries first (e.g. AR), then use their `_id` when creating GL lines under the `extras.subledger` or a dedicated `subledger` field.

2. **Creating the GL Journal**:

   - Each GL line references:

     - `account` → an ObjectId in `Accounts` (COA).
     - `extras.subledger: { sourceType: "AR", txnId: <arTxn._id>, lineNum: X }`
       so you know exactly which AR transaction (and which line within it) “caused” this GL line.

3. **Drill-down**:

   - If a user wants to see all sub-ledger (e.g. AR) transactions that hit the GL account “ACCOUNTS_RECEIVABLE” →
     a) Look up the `AccountModel` document where `accountCode = "ACCOUNTS_RECEIVABLE"`.
     b) Use its `_id` to query `GLJournalModel` lines:

     ```js
     const arAccount = await AccountModel.findOne({
       accountCode: "ACCOUNTS_RECEIVABLE",
     });
     const glLines = await GLJournalModel.find(
       {
         "lines.account": arAccount._id,
       },
       { "lines.$": 1 }
     );
     // This returns only matching lines in each journal
     ```

     c) For each matching line, inspect `line.extras.subledger` to fetch actual AR transactions:

     ```js
     const subledgerInfo = line.extras.subledger;
     // { sourceType: "AR", txnId: <someObjectId>, lineNum: 1 }
     const arTxn = await ARTransactionModel.findById(subledgerInfo.txnId);
     ```

     d) Display both the GL line (date, debit/credit, localAmount) and the original AR sub-ledger detail (customer, invoice number, line amount, etc.). That is your drill-down.

4. **Orphan Sub-ledgers**

   - If you ever create sub-ledger transactions that SHOULD be in the GL but haven’t yet been posted (e.g. an AR invoice in DRAFT), either:

     - Do **not** create the sub-ledger record until you post to GL; or
     - Mark those sub-ledger records `isPosted: false`, and the GL lines will later refer to them with `isPosted: true`.

---

## 5. Generating Financial Reports

Once (a) you have a Chart of Accounts (`Accounts` collection), and (b) you’re posting every GL line to one of those accounts, you can generate:

### 5.1 Trial Balance

A Trial Balance is simply:

- **For each “leaf” account** (or optionally each account, but grouping sums up children):

  - `sumDebit = Σ(debit)  for all GL lines where lines.account = this account’s _id`
  - `sumCredit = Σ(credit) for all GL lines where lines.account = this account’s _id`
  - `net = sumDebit − sumCredit`
  - If the `normalBalance` = DEBIT and `net` is positive → report as **DR** balance.
    If `net` is negative → report as **CR** (absolute value).
  - If `normalBalance` = CREDIT, reverse interpretation.

You can write an aggregation on `GLJournalModel`:

```js
const trialBalance = await GLJournalModel.aggregate([
  // 1) Unwind lines
  { $unwind: "$lines" },

  // 2) Group by lines.account:
  {
    $group: {
      _id: "$lines.account",
      totalDebit: { $sum: "$lines.debit" },
      totalCredit: { $sum: "$lines.credit" },
    },
  },

  // 3) Lookup account details
  {
    $lookup: {
      from: "accounts",
      localField: "_id",
      foreignField: "_id",
      as: "accountInfo",
    },
  },
  { $unwind: "$accountInfo" },

  // 4) Project the final shape
  {
    $project: {
      accountId: "$_id",
      accountCode: "$accountInfo.accountCode",
      accountName: "$accountInfo.accountName",
      type: "$accountInfo.type",
      normalBalance: "$accountInfo.normalBalance",
      sumDebit: 1,
      sumCredit: 1,
      net: { $subtract: ["$totalDebit", "$totalCredit"] },
    },
  },

  // 5) Optionally, sort by code
  { $sort: { accountCode: 1 } },
]);
```

The result `trialBalance` array looks like:

```json
[
  {
    "accountId": "650fffa01abc4b4b55cdeaaa",
    "accountCode": "1.1000",
    "accountName": "Cash",
    "type": "ASSET",
    "normalBalance": "DEBIT",
    "sumDebit": 100000,
    "sumCredit": 50000,
    "net": 50000
  },
  {
    "accountId": "650fffa01abc4b4b55cdebbb",
    "accountCode": "2.2000",
    "accountName": "Accounts Payable",
    "type": "LIABILITY",
    "normalBalance": "CREDIT",
    "sumDebit": 20000,
    "sumCredit": 80000,
    "net": -60000
  }
  // …
]
```

Then you can format “net” as either a DR or CR column (based on `normalBalance` and sign).

### 5.2 Ledger Account Transactions (“Account Detail”)

If someone clicks on an account (e.g. “COGS”), you want to show:

- All GL lines where `lines.account = <COGS._id>`, with date, ref, debit, credit, localAmount, and possibly a link back to any sub-ledger (via `line.extras.subledger`).

You can query:

```js
const accountId = req.params.accountId; // the ObjectId of the account
const glEntries = await GLJournalModel.find(
  { "lines.account": accountId },
  { lines: 1, journalDate: 1, reference: 1, createdBy: 1 }
).lean();

// Then reshape each result to show a single row per matching line:
const ledgerRows = [];
for (let doc of glEntries) {
  // Find the single matching line in doc.lines array
  const matchingLines = doc.lines.filter(
    (l) => String(l.account) === String(accountId)
  );
  matchingLines.forEach((ln) => {
    ledgerRows.push({
      journalDate: doc.journalDate,
      reference: doc.reference,
      createdBy: doc.createdBy,
      lineDebit: ln.debit,
      lineCredit: ln.credit,
      localAmount: ln.localAmount,
      currency: ln.currency,
      exchangeRate: ln.exchangeRate,
      subledger: ln.extras.subledger || null,
      dims: ln.dims || {},
      // you can also store doc._id if you want a link to the journal itself
      journalId: doc._id,
    });
  });
}
```

Then display `ledgerRows` in a table:

```
Date       | Reference                    | Debit (USD) | Credit (USD) | Local (INR) | Sub-ledger
---------------------------------------------------------------------------------------
2025-06-10 | INV_000123                  |     500.00  |      0.00    |  37500.00   | InventoryTxn: 650ffd...
2025-06-10 | INV_000123                  |       0.00  |    1200.00   | –90000.00   | InventoryTxn: 650ffd...
… etc.
```

### 5.3 Income Statement (Profit & Loss)

An Income Statement covers a period (e.g. 2025-04-01 to 2025-06-30) and includes:

- **Revenue accounts** (type = `REVENUE`): sum of `credit − debit` for each line in that date range.
- **Expense accounts** (type = `EXPENSE`): sum of `debit − credit` for each line in that date range.

You can run a MongoDB aggregation like:

```js
const periodStart = new Date("2025-04-01");
const periodEnd = new Date("2025-06-30");

const incomeStatement = await GLJournalModel.aggregate([
  // 1) Unwind lines
  { $unwind: "$lines" },

  // 2) Filter by period
  {
    $match: {
      journalDate: { $gte: periodStart, $lte: periodEnd },
    },
  },

  // 3) Lookup account to get its type (REVENUE or EXPENSE)
  {
    $lookup: {
      from: "accounts",
      localField: "lines.account",
      foreignField: "_id",
      as: "acct",
    },
  },
  { $unwind: "$acct" },

  // 4) Only keep lines where acct.type in [ "REVENUE", "EXPENSE" ]
  {
    $match: {
      "acct.type": { $in: ["REVENUE", "EXPENSE"] },
    },
  },

  // 5) Group by account to compute net for each:
  {
    $group: {
      _id: "$acct._id",
      accountCode: { $first: "$acct.accountCode" },
      accountName: { $first: "$acct.accountName" },
      type: { $first: "$acct.type" },
      sumDebit: { $sum: "$lines.debit" },
      sumCredit: { $sum: "$lines.credit" },
    },
  },

  // 6) Compute net = (if REVENUE → credit − debit), if EXPENSE → debit − credit
  {
    $addFields: {
      netAmount: {
        $switch: {
          branches: [
            {
              case: { $eq: ["$type", "REVENUE"] },
              then: { $subtract: ["$sumCredit", "$sumDebit"] },
            },
            {
              case: { $eq: ["$type", "EXPENSE"] },
              then: { $subtract: ["$sumDebit", "$sumCredit"] },
            },
          ],
          default: 0,
        },
      },
    },
  },

  // 7) Sort by accountCode
  { $sort: { accountCode: 1 } },
]);
```

The result `incomeStatement` might look like:

```json
[
  {
    "_id": "650fffa11abc4b4b55cdeccc",
    "accountCode": "4.1000",
    "accountName": "Sales Revenue",
    "type": "REVENUE",
    "sumDebit": 0,
    "sumCredit": 12000,
    "netAmount": 12000
  },
  {
    "_id": "650fffa11abc4b4b55cdecdd",
    "accountCode": "5.2000",
    "accountName": "Cost of Goods Sold",
    "type": "EXPENSE",
    "sumDebit": 5000,
    "sumCredit": 0,
    "netAmount": 5000
  },
  {
    "_id": "650fffa11abc4b4b55cdeeaa",
    "accountCode": "5.3000",
    "accountName": "Office Expense",
    "type": "EXPENSE",
    "sumDebit": 1200,
    "sumCredit": 0,
    "netAmount": 1200
  }
  // … etc …
]
```

You can then sum `netAmount` of all REVENUE accounts to get “Total Revenue = 12,000,” sum all EXPENSE `netAmount` = 6200, and compute “Net Profit = 5800.”

### 5.4 Balance Sheet

Similarly, for a Balance Sheet (as of a cutoff date, say `2025-06-30`), you include:

- **Assets** (`type = "ASSET"`):
  netBalance = `sumDebit − sumCredit` (because assets have DEBIT normal balance).
- **Liabilities** (`type = "LIABILITY"`):
  netBalance = `sumCredit − sumDebit` (liabilities have CREDIT normal balance).
- **Equity** (`type = "EQUITY"`):
  netBalance = `sumCredit − sumDebit` (equity is credit normal).

So an aggregation like:

```js
const cutoff = new Date("2025-06-30T23:59:59.999Z");

const balanceSheet = await GLJournalModel.aggregate([
  { $unwind: "$lines" },
  { $match: { journalDate: { $lte: cutoff } } },
  {
    $lookup: {
      from: "accounts",
      localField: "lines.account",
      foreignField: "_id",
      as: "acct",
    },
  },
  { $unwind: "$acct" },
  {
    $match: {
      "acct.type": { $in: ["ASSET", "LIABILITY", "EQUITY"] },
    },
  },
  {
    $group: {
      _id: "$acct._id",
      accountCode: { $first: "$acct.accountCode" },
      accountName: { $first: "$acct.accountName" },
      type: { $first: "$acct.type" },
      sumDebit: { $sum: "$lines.debit" },
      sumCredit: { $sum: "$lines.credit" },
    },
  },
  {
    $addFields: {
      netBalance: {
        $switch: {
          branches: [
            {
              case: { $eq: ["$type", "ASSET"] },
              then: { $subtract: ["$sumDebit", "$sumCredit"] },
            },
            {
              case: { $in: ["$type", ["LIABILITY", "EQUITY"]] },
              then: { $subtract: ["$sumCredit", "$sumDebit"] },
            },
          ],
          default: 0,
        },
      },
    },
  },
  { $sort: { accountCode: 1 } },
]);
```

That yields a list of all ASSET, LIABILITY, and EQUITY accounts (leaf accounts only, or you can roll up if desired), with each account’s net balance in functional currency.

---

## 6. Best Practices & Recommendations

1. **Always Post to “Leaf” Accounts**

   - Enforce that GL lines can only be posted to `Account` documents where `isLeaf === true` and `allowManualPost === true`. Group accounts (rollup nodes) should have `isLeaf = false` so you never post directly to them.

2. **Use Hierarchical Codes**

   - Adopt a logical numbering scheme, e.g.:

     ```
     1.   Assets
       1.1   Current Assets
         1.1.1 Cash
         1.1.2 Accounts Receivable
         1.1.3 Inventory
       1.2   Fixed Assets
         1.2.1 Machinery
         1.2.2 Building
     2.   Liabilities
       2.1   Current Liabilities
         2.1.1 Accounts Payable
         2.1.2 Short-Term Loans
       2.2   Long-Term Liabilities
     3.   Equity
       3.1   Share Capital
       3.2   Retained Earnings
     4.   Revenue
       4.1   Sales Revenue
       4.2   Service Revenue
     5.   Expenses
       5.1   COGS
       5.2   Operating Expenses
         5.2.1 Rent
         5.2.2 Salaries
         5.2.3 Utilities
     ```

   - This makes reports more intuitive and easy to “drill up” (sum children into parents).

3. **Store Both the Code and the Internal ObjectId**

   - You’ll query/group by the ObjectId in aggregation. But keep `accountCode` and `accountName` on the Account document so when you populate, you can show `"4.1. Sales Revenue"` in your report.
   - In a GL line, store only the `account: <ObjectId>`. If you want, you can _also_ store a denormalized `accountCode` or `accountName` for quick lookup/queries, but that introduces redundancy—so only do that if you need very high performance.

4. **Maintain Opening Balances**

   - If you’re migrating historical data, you might want an `openingBalance` on each Account (in functional currency) to seed your first period. Alternatively, create a “Journal” dated the first day of your fiscal year that posts each account’s opening balances (debit or credit). After that, all subsequent transactions flow normally.

5. **Always Capture Exchange Rates at the Time of Posting**

   - Whenever a user posts a GL line in USD (or any foreign currency), store exactly the `exchangeRate` used (e.g. “1 USD = 74.50 INR” on that date). If the rate is stale or user-entered, keep it—because that is what you posted. Do _not_ auto-update old lines if FX rates change—those become permanent historical records.

6. **Reversals & Period Close Adjustments**

   - If you need to reverse a journal (e.g. to correct an entry), create a new GL Journal dated the reversal date, with each line’s debit↔credit swapped (and the same exchangeRate—unless you wish to post that reversal in a different currency period). That ensures the original journal stays in the audit trail.
   - For period close, you can write a “ReClassification” journal to move any intermediate accounts to Retained Earnings, etc.

7. **Validation & Error Handling**

   - In the `createGLJournal` controller, we enforced that exactly one of `debit`/`credit` is > 0, and that sums match.
   - You may also want to enforce that each line’s `(debit − credit) × exchangeRate` equals the provided `localAmount`, to two-decimal accuracy.
   - Always use `Number(debit)`, `Number(credit)`, `Number(exchangeRate)`—don’t trust the user to pass a number.

8. **Populating for Reports**

   - When showing a GL journal, you typically want to `populate("lines.account", "accountCode accountName type")` so you can display each line as:

     ```
     Dr ₹37,500.00  (COGS – Cost of Goods Sold, 5.1)
     Cr ₹37,500.00  (INVENTORY – Inventory, 1.1.3)
     ```

   - Build `virtuals` or helper methods on your `GLJournalModel` if needed to quickly show a “pull-down” of account details.

9. **Performance & Indexing**

   - We added `glJournalSchema.index({ journalDate: 1, createdBy: 1 });` for faster date/creator searches.
   - You might also create a **multikey** index on `lines.account` if you regularly query by an account:

     ```js
     glJournalSchema.index({ "lines.account": 1, journalDate: -1 });
     ```

   - For the Account model, `index({ accountCode: 1 }, { unique: true })` ensures no duplicates.

10. **Consistent “Functional Currency”**

    - Choose once (e.g. `"INR"` or `"GBP"`) and store it in your system’s environment or a “Company Settings” document. When users post a GL line, if they submit a `currency` that doesn’t match, you either reject (if you only allow functional currency) or require a valid `exchangeRate` (if you allow multi-currency).
    - In most SME accounting apps, “functional currency” = one single currency. If you truly support multi-entity/multi-currency, then you might have a `company` collection that stores each entity’s functional currency. Then in your GL line, you store `companyId` as well and validate that the posted `currency` is either the functional currency or a permitted trading currency.

---

## 7. Putting It All Together: Example “Drill-Down” Flow

1. **Create some Accounts** (via an Admin UI or seeds):

   ```js
   // (in a one-time seed script, or via an admin controller)
   await AccountModel.create([
     {
       accountCode: "1",
       accountName: "Assets",
       type: "ASSET",
       normalBalance: "DEBIT",
       isLeaf: false,
       allowManualPost: false,
     },
     {
       accountCode: "1.1",
       accountName: "Current Assets",
       type: "ASSET",
       normalBalance: "DEBIT",
       parentAccount: <ObjectId of “1”>,
       isLeaf: false,
       allowManualPost: false,
     },
     {
       accountCode: "1.1.1",
       accountName: "Cash",
       type: "ASSET",
       normalBalance: "DEBIT",
       parentAccount: <ObjectId of “1.1”>,
       isLeaf: true,
       allowManualPost: true,
     },
     {
       accountCode: "1.1.2",
       accountName: "Accounts Receivable",
       type: "ASSET",
       normalBalance: "DEBIT",
       parentAccount: <ObjectId of “1.1”>,
       isLeaf: true,
       allowManualPost: true,
     },
     {
       accountCode: "2",
       accountName: "Liabilities",
       type: "LIABILITY",
       normalBalance: "CREDIT",
       isLeaf: false,
       allowManualPost: false,
     },
     {
       accountCode: "2.1",
       accountName: "Current Liabilities",
       type: "LIABILITY",
       normalBalance: "CREDIT",
       parentAccount: <ObjectId of “2”>,
       isLeaf: false,
       allowManualPost: false,
     },
     {
       accountCode: "2.1.1",
       accountName: "Accounts Payable",
       type: "LIABILITY",
       normalBalance: "CREDIT",
       parentAccount: <ObjectId of “2.1”>,
       isLeaf: true,
       allowManualPost: true,
     },
     {
       accountCode: "3",
       accountName: "Equity",
       type: "EQUITY",
       normalBalance: "CREDIT",
       isLeaf: false,
       allowManualPost: false,
     },
     {
       accountCode: "3.1",
       accountName: "Retained Earnings",
       type: "EQUITY",
       normalBalance: "CREDIT",
       parentAccount: <ObjectId of “3”>,
       isLeaf: true,
       allowManualPost: false,
     },
     {
       accountCode: "4",
       accountName: "Revenue",
       type: "REVENUE",
       normalBalance: "CREDIT",
       isLeaf: false,
       allowManualPost: false,
     },
     {
       accountCode: "4.1",
       accountName: "Sales Revenue",
       type: "REVENUE",
       normalBalance: "CREDIT",
       parentAccount: <ObjectId of “4”>,
       isLeaf: true,
       allowManualPost: true,
     },
     {
       accountCode: "5",
       accountName: "Expenses",
       type: "EXPENSE",
       normalBalance: "DEBIT",
       isLeaf: false,
       allowManualPost: false,
     },
     {
       accountCode: "5.1",
       accountName: "Cost of Goods Sold",
       type: "EXPENSE",
       normalBalance: "DEBIT",
       parentAccount: <ObjectId of “5”>,
       isLeaf: true,
       allowManualPost: true,
     },
     {
       accountCode: "5.2",
       accountName: "Operating Expenses",
       type: "EXPENSE",
       normalBalance: "DEBIT",
       parentAccount: <ObjectId of “5”>,
       isLeaf: false,
       allowManualPost: false,
     },
     {
       accountCode: "5.2.1",
       accountName: "Rent",
       type: "EXPENSE",
       normalBalance: "DEBIT",
       parentAccount: <ObjectId of “5.2”>,
       isLeaf: true,
       allowManualPost: true,
     },
     {
       accountCode: "5.2.2",
       accountName: "Salaries & Wages",
       type: "EXPENSE",
       normalBalance: "DEBIT",
       parentAccount: <ObjectId of “5.2”>,
       isLeaf: true,
       allowManualPost: true,
     }
   ]);
   ```

2. **Post a Sales Invoice** → Creates Sub-Ledger + GL Journal:

   - Your Sales Order → final “Invoiced” step runs your `SalesStockService` (inventory), `ARTransactionModel` (AR), maybe `TaxTransactionModel` (GST), etc., then calls `VoucherService.createSalesVoucher` or our new `GLJournalService` to post one balanced GL Journal with lines referencing those accounts.
   - Each GL line’s `account` points to one of:

     - `Accounts Receivable` (1.1.2.\_id)
     - `Sales Revenue` (4.1.\_id)
     - `GST Payable` (2.1.2.\_id if you created a “Sales Tax Payable” account)
     - `COGS` (5.1.\_id)
     - `Inventory` (1.1.3.\_id if that account exists)

3. **Drill-down**

   - If a manager wants to view the “Accounts Receivable” ledger:

     - Query `GLJournalModel` for lines where `lines.account = <1.1.2._id>`.
     - You get each GL line that debits AR, with an `extras.subledger` that points back to an AR invoice.
     - The UI can show “Date | JournalRef | DR(\$) | CR(\$) | Subledger: AR Invoice INV_000123”.

4. **Trial Balance & Reports**

   - Run the aggregations mentioned in Section 5.
   - You can build an Income Statement (sum all P\&L accounts in the period) and a Balance Sheet (sum all BS accounts as of cutoff).

---

## 8. Summary

1. **Maintain a dedicated `AccountModel` (Chart of Accounts)**, with fields:

   - `accountCode` (string, unique)
   - `accountName` (string)
   - `type` (enum: ASSET/LIABILITY/EQUITY/REVENUE/EXPENSE)
   - `parentAccount` (self-reference, for rollups)
   - `normalBalance` (DEBIT or CREDIT)
   - `isLeaf` (boolean: can you post to this account?)
   - `allowManualPost` (boolean: can user create a GL line manually to it?)
   - `currency`, `description`, etc.

2. **Modify your `GLJournalModel`** so that each line’s `account` is an ObjectId referencing `Accounts`, rather than a raw string.

   - Validate on creation that the referenced Account exists and is leaf & `allowManualPost` = true.

3. **Whenever you create a GL Journal**, each line must supply:

   - `account: <AccountId>`,
   - `debit` ≥ 0, `credit` ≥ 0, exactly one > 0
   - `currency` (e.g. `"USD"`)
   - `exchangeRate` to functional (e.g. `75.00` if 1 USD = 75 INR)
   - `localAmount` = (debit – credit) × exchangeRate (rounded to two decimals)
   - Optionally `dims` or `extras` for sub-ledger linkage

4. **Your `glJournalSchema.pre("save")`** enforces that `sum(debit) == sum(credit)` at two-decimal precision. If not balanced, Mongoose throws a validation error.

5. **Store sub-ledger references** (e.g. AR, Inventory, Tax) in each line’s `extras.subledger = { sourceType, txnId, lineNum }`. That allows you to drill from the GL line back to exactly which sub-ledger entry generated it.

6. **To generate a Trial Balance**: aggregate all GL lines, group by account, sum `debit`/`credit`, compute net, and fetch account codes/names. Balanced if net sums of all accounts = 0.

7. **To build an Income Statement**: filter GL lines by `account.type ∈ ["REVENUE","EXPENSE"]`, group, compute net for each, then sum Revenue nets and Expense nets—Profit = Revenue − Expense.

8. **To build a Balance Sheet**: filter GL lines by `account.type ∈ ["ASSET","LIABILITY","EQUITY"]`, group, compute net with the correct normalBalance logic. Check that Assets = Liabilities + Equity.

9. **Recommended best practices**:

   - Use a hierarchical chart of accounts with clear numbering (e.g. “1.1.2”).
   - Maintain a single “Account” master table/collection.
   - Always post to leaf accounts.
   - Capture FX rates at posting time.
   - Implement pre-save “balanced” validation.
   - Use MongoDB transactions if you also post sub-ledger entries in the same process.
   - Index heavily on `lines.account`, `journalDate`, and/or `createdBy` for efficient reporting.

With this design, you will have:

- A single source of truth for your chart of accounts
- Full traceability from a sub-ledger transaction (e.g. AR invoice) → GL line → Account → aggregated reports
- The ability to build Trial Balance, Ledger, P\&L, and Balance Sheet using simple MongoDB aggregations

Feel free to adapt and extend this pattern—for example, if you want a multi-entity setup (each `Account` might belong to a particular `companyId`) or if you need more sub-ledger categories. The key is to keep the COA centralized and require that every posting references a valid `Account` document.

Once your COA is in place and your GL journaling is wired up as shown, you’ll be able to:

- **Drill-down**: “Show me all sub-ledger AR transactions that hit Accounts Receivable (1.1.2).”
- **Generate**: “Trial Balance as of June 30, 2025.”
- **Produce**: “Income Statement for Q2 2025.”
- **Produce**: “Balance Sheet as of June 30, 2025.”

—all by querying **one** unified `GLJournalModel` collection combined with your `AccountModel`.

---

**That completes the design & code for maintaining an Account Master (Chart of Accounts) and linking it to your general-ledger/journal entries.** Once this foundation is in place, building Trial Balances and financial statements is just a matter of aggregation.
