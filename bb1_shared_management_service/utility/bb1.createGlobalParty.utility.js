import { GlobalPartyModel } from "../models/globalParty.model.js";

async function createGlobalPartyId(partyTypeString, globalPartyId, name) {
  // 2) Prepare a variable to hold the final partyId
  let partyId = null;

  // 3) If no globalPartyId was passed, we create a new GlobalParty doc with partyType=["Customer"].
  if (!globalPartyId) {
    const newParty = await GlobalPartyModel.create({
      name, // or pass something else for .name
      partyType: [partyTypeString], // force the array to have "Customer"
    });
    partyId = newParty._id;
  } else {
    // 4) If globalPartyId is provided, we find that doc
    const existingParty = await GlobalPartyModel.findById(globalPartyId);
    if (!existingParty) {
      // Option A: Throw an error
      // return res.status(404).send({
      //   status: "failure",
      //   message: `GlobalParty with ID ${globalPartyId} does not exist.`,
      // });

      // Option B: Or create a new GlobalParty doc with that _id (rarely recommended)
      // But usually you'd want to fail if the globalPartyId doesn't exist
      throw new Error(
        `GlobalParty with ID ${globalPartyId} not found. Cannot create ${partyTypeString} referencing missing party.`
      );
      // return res.status(404).json({
      //   status: "failure",
      //   message: `GlobalParty ${globalPartyId} not found. (Cannot create ${partyTypeString} referencing missing party.)`,
      // });
    }

    // 5) If found, ensure "Customer" is in the partyType array
    if (!existingParty.partyType.includes(partyTypeString)) {
      existingParty.partyType.push(partyTypeString);
      await existingParty.save();
    }

    // We'll use the existingParty's _id
    partyId = existingParty._id;
  }

  return partyId;
}

export default createGlobalPartyId;
