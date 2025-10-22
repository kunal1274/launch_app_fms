// middleware/loadTemplateOwner.js

import { JournalTemplateModel } from '../models/journalTemplate.model.js';

export async function loadJournalTemplateOwner(req, res, next) {
  const { id } = req.params;
  if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) return next();

  const tpl = await JournalTemplateModel.findById(id)
    .select('createdBy')
    .lean();
  if (tpl) {
    // so downstream you could check req.resourceOwnerId === req.user.id
    req.resourceOwnerId = tpl.createdBy.toString();
  }
  next();
}
