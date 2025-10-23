Here’s a worked-out voucher for our two-line sale (Widget A + Widget B) extended to include:

- **COGS** (you debit cost, credit inventory)
- **Commission** (2% on sales) with **TDS** (10% on that commission)
- **Freight charged** to customer (revenue) vs **freight incurred** (expense)
- **TCS** (1% on total sale)
- A toy **FX loss** example

---

### A) Underlying numbers

| Line | Item       | Qty | Unit Price | Line Amt  |  GST 12%  | COGS @ 60/120 |
| :--: | :--------- | :-: | :--------: | :-------: | :-------: | ------------: |
|  1   | Widget A   |  5  |   \$100    |   \$500   |   \$60    |         \$300 |
|  2   | Widget B   |  2  |   \$200    |   \$400   |   \$48    |         \$240 |
|      | **Totals** |     |            | **\$900** | **\$108** |     **\$540** |

- **Discount** 5% on A: \$500×0.05 = \$25
- **Freight charged** to customer: \$20
- **TCS** @1% on gross sale: \$900×0.01 = \$9
- **Commission** 2% on gross sale: \$900×0.02 = \$18
- **TDS** @10% on commission: \$18×0.10 = \$1.8
- **Freight incurred** (shipper cost): \$15
- **FX loss** (e.g. USD/EUR fluctuation): \$20

Hence **Net AR** = 900 + 108 – 25 + 20 + 9 = **\$1 012**

---

### B) Full Double-Entry Voucher

|  #  | Account                       |      Dr      |   Cr   | Note                                                             |
| :-: | :---------------------------- | :----------: | :----: | :--------------------------------------------------------------- |
|  1  | **Accounts Receivable**       | **1 012.00** |        | Net amount customer owes (incl GST, freight, TCS, less discount) |
|  2  | **Sales Revenue**             |              | 900.00 | Credit gross sale                                                |
|  3  | **GST Payable**               |              | 108.00 | Output GST on sale                                               |
|  4  | **Sales Discounts**           |    25.00     |        | 5% discount on Widget A                                          |
|  5  | **Freight Income**            |              | 20.00  | Freight charged to customer                                      |
|  6  | **TCS Payable**               |              |  9.00  | Tax collected at source (1% of sale)                             |
|  7  | **Cost of Goods Sold (COGS)** |    540.00    |        | Expense for goods delivered                                      |
|  8  | **Inventory**                 |              | 540.00 | Reduce on-hand inventory                                         |
|  9  | **Commission Expense**        |    18.00     |        | 2% sales commission                                              |
| 10  | **Commission Payable**        |              | 16.20  | Net commission owed (18 – 1.8 TDS)                               |
| 11  | **TDS Receivable**            |     1.80     |        | Withholding on commission (asset)                                |
| 12  | **Freight Expense**           |    15.00     |        | Actual shipping cost you incurred                                |
| 13  | **Freight Payable (Vendor)**  |              | 15.00  | Liability to freight vendor                                      |
| 14  | **Foreign Exchange Loss**     |    20.00     |        | Realized FX loss on settlement                                   |
| 15  | **Accounts Receivable**       |              | 20.00  | Reduce AR for FX adjustment                                      |

- **Lines 1–6**: drive your top-line and tax calculation
- **Lines 7–8**: move cost out of inventory into COGS
- **Lines 9–11**: commission goes on P\&L, net of TDS
- **Lines 12–13**: freight expense vs freight income
- **Lines 14–15**: adjust AR for any currency gain/loss

---

### Drill-down & traceability

Every voucher line would carry metadata like:

```js
{
  srcType: "SO",
  srcId: "<salesOrderId>",
  srcLine: 1   // or 1–2 for summary lines covering both items
}
```

so you can from your General Ledger query right back to the exact SO line(s) that generated it.

Once you’re happy with the accounting flows above, we can jump into:

1. **Mongoose schemas** for `Voucher` + `VoucherLine`
2. **Services** that, during your `changeSalesOrderStatus → Invoiced`,

   - bulk-insert your `InventoryTransaction` lines
   - compute & insert these GL entries into a `Voucher` document

Let me know if you’d like to tweak any rates or add another element before we code it up!

===

### Worked Example – Header Discount ₹30 & Header Freight Income ₹40 (Freight-Expense ₹35 handled separately)

| #   | Component                 | Formula               | Amount (₹) | Note                        |
| --- | ------------------------- | --------------------- | ---------- | --------------------------- |
| 1   | **Line-1 Net**            | 5 qty × 80 – 10 disc  | **390**    | GST 10 % → 39               |
| 2   | **Line-2 Net**            | 10 qty × 50 – 20 disc | **480**    | GST 5 % → 24                |
| 3   | **Header Freight Income** | given                 | **40**     | service line on invoice     |
| 4   | **Header Discount**       | given                 | **-30**    | reduces consideration       |
| 5   | **Taxable Base**          | 390 + 480 + 40 – 30   | **880**    | used for TDS                |
| 6   | **TDS @ 1 %**             | 1 % × 880             | **8.80**   | receivable from Govt.       |
| 7   | **GST on items**          | 39 + 24               | **63.00**  | sum of line GST             |
| 8   | **GST on Freight**        | 18 % × 40             | **7.20**   | assume 18 % service GST     |
| 9   | **Total GST**             | 63 + 7.2              | **70.20**  | payable                     |
| 10  | **Gross Customer Charge** | 390 + 480 + 40        | **910.00** | before header disc / GST    |
| 11  | **Less Header Disc**      | 910 – 30              | **880.00** | net supply value            |
| 12  | **Add GST**               | 880 + 70.2            | **950.20** | tax on net value            |
| 13  | **Less TDS**              | 950.2 – 8.8           | **941.40** | net **Accounts Receivable** |

> **TaxableBase = (NetLine1 + NetLine2 + FreightIncome) – HeaderDiscount
> \= (390 + 480 + 40) – 30 = 880** > **TDS = 1 % × 880 = 8.80** > **GST = ItemGST (63) + GST_on_Freight (7.20) = 70.20**

---

### Journal-Entry Blueprint (Functional = INR)

| Dr (₹)     | Cr (₹)     | GL Account                                     |
| ---------- | ---------- | ---------------------------------------------- |
| 900        |            | **COGS** (350 + 550)                           |
|            | 900        | **Inventory**                                  |
| 30         |            | **Sales Discount – Lines**                     |
|            | 870        | **Sales Revenue – Lines**                      |
| 30         |            | **Sales Discount – Header**                    |
|            | 40         | **Freight Income – Header**                    |
| 35         |            | **Freight Expense – Header** (paid to carrier) |
|            | 35         | **Cash / A-P (Carrier)**                       |
| 70.20      |            | **Accounts Receivable** (GST component)        |
|            | 70.20      | **GST Payable**                                |
| 8.80       |            | **TDS Receivable**                             |
|            | 8.80       | **Accounts Receivable**                        |
| **941.40** |            | **Accounts Receivable** (net supply)           |
|            | **941.40** | **Sales Clearing** (or leave balance in AR)    |

_(Lines balance; adjust exact account codes to your chart.)_

---

### Foreign-Currency Settlement (example)

- Invoice in **USD = \$10.46** (₹ = 941.4 at ₹90/USD).
- Payment arrives when **spot = ₹92/USD**.

| Dr   | Cr          | Account | Amt (₹)        |
| ---- | ----------- | ------- | -------------- |
| Bank |             | ₹962.32 | \$10.46 × 92   |
|      | AR          | ₹941.40 | clear invoice  |
|      | **FX Gain** | ₹20.92  | balancing gain |

If spot were ₹88/USD the posting would be a **Dr FX Loss** instead.

---

Use this table as a template to implement your posting engine or to validate journal vouchers in your ERP.
