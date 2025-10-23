Sure—let’s walk through each part of this pattern and see how it all fits together.

---

## 1. `postMovement` and `cancelMovement`

These two exported functions are your route handlers:

```js
/* POST /sales-orders/:id/movements/:col/:rid/post */
export const postMovement = async (req, res, next) => {
  mutateMovement(req, res, next, (row) => {
    // only flip a “Draft” row to “Posted”
    if (row.status === "Draft") row.status = "Posted";
  });
};

/* PATCH /sales-orders/:id/movements/:col/:rid/cancel */
export const cancelMovement = async (req, res, next) => {
  mutateMovement(req, res, next, (row) => {
    // unconditionally mark as cancelled
    row.status = "Cancelled";
  });
};
```

- **`postMovement`**  
  – Called when you want to “post” (finalize) a single movement row.  
  – It invokes the shared helper `mutateMovement`, passing in a **mutator callback** that only sets `row.status = "Posted"` if it was `"Draft"`.

- **`cancelMovement`**  
  – Called to cancel a movement row.  
  – It also calls `mutateMovement` but with a callback that always does `row.status = "Cancelled"`.

Both handlers defer the actual lookup, validation, save‑and‑respond logic to `mutateMovement`.

---

## 2. The `mutateMovement` helper

```js
const VALID_COL = { shippingQty: 1, deliveringQty: 1, invoicingQty: 1 };

async function mutateMovement(req, res, next, mutator) {
  try {
    const { id, col, rid } = req.params;

    // ── 1) Validate which sub‑array you’re touching
    if (!VALID_COL[col]) return next(createError(400, "bad collection"));

    // ── 2) Load the parent SalesOrder document
    const so = await SalesOrderModel.findById(id);

    // ── 3) Locate the exact sub‑document by its row id
    const row = so[col].id(rid);
    if (!row) return next(createError(404, "row not found"));

    // ── 4) Apply the custom mutation (post or cancel)
    mutator(row);

    // ── 5) Recompute the overall order status
    //     (e.g. “PartiallyShipped”, “Shipped”, etc.)
    //     based on updated totals in that array
    so.status = computeStatus(totals(so));

    // ── 6) Persist and return the updated SalesOrder
    await so.save();
    res.json(so);
  } catch (e) {
    next(e);
  }
}
```

### Step by step

1. **Extract route params**

   - `id` = the SalesOrder’s Mongo ObjectId
   - `col` = which movement array (`shippingQty`, `deliveringQty`, or `invoicingQty`)
   - `rid` = the sub‑document’s ObjectId within that array

2. **Validate `col`**

   - Uses a simple lookup map `VALID_COL` to reject any unexpected collection name.

3. **Load the order**

   - `SalesOrderModel.findById(id)` fetches the parent document.

4. **Find the movement row**

   - `so[col].id(rid)` leverages Mongoose’s ability to query an embedded sub‑document by its `_id`.
   - If missing, a 404 error is thrown.

5. **Mutate**

   - Calls the `mutator(row)` you passed in, which updates `row.status` in‑memory on that sub‑doc.

6. **Recompute header status**

   - `totals(so)` presumably tallies up the sums of all quantities across those arrays.
   - `computeStatus(...)` applies your business logic (similar to `deriveOrderStatus`) to yield a new top‑level `so.status`.

7. **Save & respond**
   - `await so.save()` writes both the sub‑doc change and the new top‑level status.
   - Finally, the updated SalesOrder is sent back as JSON.

---

### Why this pattern is nice

- **DRY**: You only write the lookup/validation/save logic once.
- **Flexible**: Each route simply provides a tiny `mutator` function describing _how_ the row should change.
- **Consistent**: After each mutation, the overall order status is recalculated in exactly the same place.

Let me know if you’d like to see how `totals()` and `computeStatus()` might be implemented, or if you want to add audit logging around these mutations!
