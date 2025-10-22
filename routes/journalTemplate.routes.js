import express from 'express';
import * as T from '../controllers/journalTemplate.controller.js';

// middleware/authenticate.js
import jwt from 'jsonwebtoken';
import { UserGlobalModel } from '../models/userGlobal.model.js';
import { loadJournalTemplateOwner } from '../middleware/rbacLoadOwner.js';
import authorize from '../middleware/rbacAuthorize.js';

export async function authenticate(req, res, next) {
  const auth = req.headers.authorization?.split(' ');
  if (!auth || auth[0] !== 'Bearer' || !auth[1]) {
    return res
      .status(401)
      .json({ status: 'failure', message: 'Missing token' });
  }
  try {
    const payload = jwt.verify(auth[1], process.env.JWT_SECRET);
    const user = await UserGlobalModel.findById(payload.sub)
      .select('userRoles _id')
      .lean();
    if (!user) {
      return res
        .status(401)
        .json({ status: 'failure', message: 'Invalid token' });
    }
    // we'll refer to user.id and user.userRoles in downstream middleware
    req.user = { id: user._id.toString(), userRoles: user.userRoles };
    next();
  } catch (err) {
    return res.status(401).json({ status: 'failure', message: 'Unauthorized' });
  }
}

const glJournalTemplateRouter = express.Router();

// // POST   /templates
glJournalTemplateRouter.post('/', T.createTemplate);

// // GET    /templates
glJournalTemplateRouter.get('/', T.listTemplates);

// // GET    /templates/:id
// router.get("/:id", T.getTemplateById);

// // PATCH  /templates/:id
// router.patch("/:id", T.updateTemplate);

// // DELETE /templates/:id
// router.delete("/:id", T.deleteTemplate);

// all routes require authentication first
// glJournalTemplateRouter.use(authenticate);

// LIST
//glJournalTemplateRouter.get("/", authorize("TEMPLATE_VIEW"), T.listTemplates);

// VIEW ONE
// glJournalTemplateRouter.get(
//   "/:id",
//   loadJournalTemplateOwner,
//   authorize("TEMPLATE_VIEW_OWN"), // if you only have VIEW_OWN, we assume own‐only
//   T.getTemplate
// );

// CREATE
//router.post("/", authorize("TEMPLATE_CREATE"), T.createTemplate);

// UPDATE
// glJournalTemplateRouter.patch(
//   "/:id",
//   loadJournalTemplateOwner,
//   authorize("TEMPLATE_UPDATE_OWN"), // could be TEMPLATE_UPDATE for global
//   T.updateTemplate
// );

// DELETE
// glJournalTemplateRouter.delete(
//   "/:id",
//   loadJournalTemplateOwner,
//   authorize("TEMPLATE_DELETE_OWN"),
//   T.deleteTemplate
// );

export default glJournalTemplateRouter;
