// node scripts/seedRoles.js

// scripts/seedJournalTemplateRoles.js
import mongoose from 'mongoose';

import dotenv from 'dotenv';
import { PermissionModel } from '../role_based_access_control_service/models/permission.model';
import { UserRoleModel } from '../role_based_access_control_service/models/userRole.model';
dotenv.config();

async function seedJournalTemplateRoles() {
  await mongoose.connect(process.env.ATLAS_URI || process.env.ATLAS_URI_DEV || process.env.LOCAL_MONGODB_URI);

  // 1. Define the permission keys we care about
  const KEYS = [
    'TEMPLATE_VIEW',
    'TEMPLATE_VIEW_OWN',
    'TEMPLATE_CREATE',
    'TEMPLATE_UPDATE',
    'TEMPLATE_UPDATE_OWN',
    'TEMPLATE_DELETE',
    'TEMPLATE_DELETE_OWN',
  ];

  // 2. Fetch those Permission docs
  const perms = await PermissionModel.find({ key: { $in: KEYS } }).lean();
  const byKey = perms.reduce((m, p) => {
    m[p.key] = p._id;
    return m;
  }, {});

  // 3. Define roles → their permission‐key lists
  const ROLES = [
    {
      name: 'JournalTemplateViewer',
      keys: ['TEMPLATE_VIEW', 'TEMPLATE_VIEW_OWN'],
    },
    {
      name: 'JournalTemplateCreator',
      keys: ['TEMPLATE_CREATE'],
    },
    {
      name: 'JournalTemplateEditor',
      keys: ['TEMPLATE_UPDATE', 'TEMPLATE_UPDATE_OWN'],
    },
    {
      name: 'JournalTemplateDeleter',
      keys: ['TEMPLATE_DELETE', 'TEMPLATE_DELETE_OWN'],
    },
    {
      name: 'JournalTemplateAdmin',
      keys: KEYS, // all of them
    },
  ];

  // 4. Upsert each role with the matching permission _ids
  for (let { name, keys } of ROLES) {
    const permIds = keys.map((k) => byKey[k]).filter(Boolean);

    await UserRoleModel.updateOne(
      { name },
      { $set: { permissions: permIds } },
      { upsert: true }
    );
    console.log(`✅ Role '${name}' seeded (${permIds.length} perms)`);
  }

  console.log('✅ All JournalTemplate roles seeded.');
  process.exit(0);
}

seedJournalTemplateRoles().catch((err) => {
  console.error(err);
  process.exit(1);
});
