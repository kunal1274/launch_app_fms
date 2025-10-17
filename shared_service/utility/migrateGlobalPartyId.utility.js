// Pseudocode for a one-time migration script

import { UserGlobalModel } from "../../models/userGlobal.model.js";
import createGlobalPartyId from "./createGlobalParty.utility.js";

async function migrateMissingGlobalPartyIds() {
  // 1) Find all users who have a missing or undefined globalPartyId
  const usersWithoutPartyId = await UserGlobalModel.find({
    $or: [{ globalPartyId: { $exists: false } }, { globalPartyId: null }],
  });

  for (const user of usersWithoutPartyId) {
    // 2) Create a new global party or do whatever logic you want
    const partyIdForThisUser = await createGlobalPartyId(
      "User",
      null,
      user.email ? user.email : user.phoneNumber
    );

    // 3) Update the user doc with the newly created globalPartyId
    user.globalPartyId = partyIdForThisUser;
    await user.save();
  }

  console.log("Migration complete! All users have globalPartyId now.");
}

// Then call migrateMissingGlobalPartyIds() somewhere or run it as a script

export default migrateMissingGlobalPartyIds;
