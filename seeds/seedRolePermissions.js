// scripts/seedRolesPermissions.js
import mongoose from "mongoose";
import { PermissionModel } from "../role_based_access_control_service/models/permission.model";
import { UserRoleModel } from "../role_based_access_control_service/models/userRole.model";

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

// node scripts/seedRolesPermissions.js
