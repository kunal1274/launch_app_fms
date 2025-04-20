import express from "express";
import * as ctl from "../controllers/salesOrder.controller.js";
import queryParser from "../middleware/queryParser.js";
import statusGuard from "../middleware/statusGuard.js";

const router = express.Router();

// param loader
router.param("id", ctl.loadById);

/* ---------- GET list ---------- */
router.get("/", queryParser, ctl.list);

/* ---------- CREATE ---------- */
router.post("/", ctl.create);

router.get("/:id", ctl.read);

/* ---------- UPDATE ---------- */
router.put("/:id", statusGuard, ctl.update);

/* ---------- DELETE ---------- */
router.delete("/:id", ctl.remove);

/* ---------- ARCHIVE toggle ---------- */
router.patch("/:id/archive", ctl.toggleArchive);

/* ---------- ACTIONS (process‑flow) ---------- */
router.patch("/:id/actions/:actionName", ctl.triggerAction);

/* ---------- ACTIONS with data (partial qty) ---------- */
router.patch("/:id/actions/:actionName/data", ctl.triggerActionWithData);

/* payments */
router.post("/:id/payments", ctl.addPayment);

// router.get("/export", queryParser, ctl.exportFile);

// router.post("/import", uploadSingle, ctl.importFile);

// router.get("/stats", ctl.stats);

export default router;
