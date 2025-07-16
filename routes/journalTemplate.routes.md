Below is a self-contained example of how you might wire up:

1. **Authentication** (populates `req.user`)
2. **`authorize`** middleware (checks a single permission key)
3. **`loadTemplateOwner`** middleware (pulls `createdBy` → `req.resourceOwnerId`)

---

### 1) `middleware/authenticate.js`

```js
// middleware/authenticate.js
import jwt from "jsonwebtoken";
import { UserGlobalModel } from "../models/User.js";

export default async function authenticate(req, res, next) {
  const auth = req.headers.authorization?.split(" ");
  if (!auth || auth[0] !== "Bearer" || !auth[1]) {
    return res
      .status(401)
      .json({ status: "failure", message: "Missing token" });
  }
  try {
    const payload = jwt.verify(auth[1], process.env.JWT_SECRET);
    const user = await UserGlobalModel.findById(payload.sub)
      .select("userRoles _id")
      .lean();
    if (!user) {
      return res
        .status(401)
        .json({ status: "failure", message: "Invalid token" });
    }
    // we'll refer to user.id and user.userRoles in downstream middleware
    req.user = { id: user._id.toString(), userRoles: user.userRoles };
    next();
  } catch (err) {
    return res.status(401).json({ status: "failure", message: "Unauthorized" });
  }
}
```

---

### 2) `middleware/authorize.js`

```js
// middleware/authorize.js
import { UserRoleModel } from "../models/userRole.model.js";
import { PermissionModel } from "../models/permission.model.js";

/**
 * require a permission key (e.g. "TEMPLATE_CREATE")
 */
export default function authorize(requiredPermKey) {
  return async (req, res, next) => {
    if (!req.user) {
      return res
        .status(401)
        .json({ status: "failure", message: "Unauthenticated" });
    }

    // 1) load all roles for this user
    const roles = await UserRoleModel.find({
      _id: { $in: req.user.userRoles },
    })
      .select("permissions")
      .lean();

    // 2) collect all permission _ids
    const allPermIds = roles.flatMap((r) => r.permissions);

    // 3) check that one of those _ids corresponds to our required key
    const has = await PermissionModel.exists({
      _id: { $in: allPermIds },
      key: requiredPermKey,
    });

    if (!has) {
      return res
        .status(403)
        .json({
          status: "failure",
          message: "Forbidden: insufficient permissions",
        });
    }

    next();
  };
}
```

---

### 3) `middleware/loadTemplateOwner.js`

```js
// middleware/loadTemplateOwner.js
import { JournalTemplateModel } from "../models/journalTemplate.model.js";

export async function loadTemplateOwner(req, res, next) {
  const { id } = req.params;
  if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) return next();

  const tpl = await JournalTemplateModel.findById(id)
    .select("createdBy")
    .lean();
  if (tpl) {
    // so downstream you could check req.resourceOwnerId === req.user.id
    req.resourceOwnerId = tpl.createdBy.toString();
  }
  next();
}
```

---

### 4) Applying to your **journal‐template** routes

```js
// routes/journalTemplate.routes.js
import express from "express";
import authenticate from "../middleware/authenticate.js";
import authorize from "../middleware/authorize.js";
import { loadTemplateOwner } from "../middleware/loadTemplateOwner.js";
import * as C from "../controllers/journalTemplate.controller.js";

const router = express.Router();

// all routes require authentication first
router.use(authenticate);

// LIST
router.get("/", authorize("TEMPLATE_VIEW"), C.listTemplates);

// VIEW ONE
router.get(
  "/:id",
  loadTemplateOwner,
  authorize("TEMPLATE_VIEW_OWN"), // if you only have VIEW_OWN, we assume own‐only
  C.getTemplate
);

// CREATE
router.post("/", authorize("TEMPLATE_CREATE"), C.createTemplate);

// UPDATE
router.patch(
  "/:id",
  loadTemplateOwner,
  authorize("TEMPLATE_UPDATE_OWN"), // could be TEMPLATE_UPDATE for global
  C.updateTemplate
);

// DELETE
router.delete(
  "/:id",
  loadTemplateOwner,
  authorize("TEMPLATE_DELETE_OWN"),
  C.deleteTemplate
);

export default router;
```

---

### 5) Bootstrapping (seed) your permissions & roles

```js
// scripts/seedRolesPermissions.js
import mongoose from "mongoose";
import { PermissionModel } from "../models/permission.model.js";
import { UserRoleModel } from "../models/userRole.model.js";

const TEMPLATE_PERMS = [
  { key: "TEMPLATE_VIEW", module: "GL_TEMPLATE" },
  { key: "TEMPLATE_VIEW_OWN", module: "GL_TEMPLATE" },
  { key: "TEMPLATE_CREATE", module: "GL_TEMPLATE" },
  { key: "TEMPLATE_UPDATE", module: "GL_TEMPLATE" },
  { key: "TEMPLATE_UPDATE_OWN", module: "GL_TEMPLATE" },
  { key: "TEMPLATE_DELETE", module: "GL_TEMPLATE" },
  { key: "TEMPLATE_DELETE_OWN", module: "GL_TEMPLATE" },
];

async function seed() {
  await mongoose.connect(process.env.MONGODB_URI);

  // 1) ensure all permission docs exist
  for (let p of TEMPLATE_PERMS) {
    await PermissionModel.updateOne(
      { key: p.key },
      { $set: p },
      { upsert: true }
    );
  }

  // 2) grab them
  const perms = await PermissionModel.find({
    key: { $in: TEMPLATE_PERMS.map((p) => p.key) },
  });

  // 3) create a role that gets them all
  await UserRoleModel.updateOne(
    { name: "JournalTemplateAdmin" },
    { permissions: perms.map((p) => p._id) },
    { upsert: true }
  );

  console.log("✅ Seeded TEMPLATE perms & JournalTemplateAdmin role");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

Run it:

```bash
node scripts/seedRolesPermissions.js
```

---

### How it all ties together

1. **Log in** → you get a JWT with your `sub = user._id`.
2. **`authenticate`** reads that, loads `user.userRoles` into `req.user`.
3. **`authorize("TEMPLATE_CREATE")`** checks your roles’ permission IDs against the `Permissions` collection for key `"TEMPLATE_CREATE"`.
4. **`loadTemplateOwner`** (on routes that need it) fetches the template’s `createdBy` so you could switch to an `OWN` check if you prefer (“only the creator may…”).

You can apply the **exact same pattern** to your **GL Journals**, **Accounts**, **Vouchers**, etc., simply by:

- Defining the six or seven permission keys for each resource
- Seeding them
- Protecting each route with `authenticate` + `authorize(...)` (+ `loadOwner` if you support an `_OWN` variant)

This gives you fine-grained, declarative RBAC that works at the **method** (endpoint) level, and can easily be extended to **row-level** (“\_OWN”) checks.
