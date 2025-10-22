import express from 'express';
import * as ctl from '../controllers/bb3SalesOrder.controller.js';
import queryParser from '../middleware/bb3QueryParser.js';
import statusGuard from '../middleware/bb3StatusGuard.js';
import { upload } from '../../middleware/uploadConfig.js';
import multer from 'multer';

const router = express.Router();

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, 'uploads/'),
  filename: (req, file, cb) => {
    // const unique = Date.now() + "-" + Math.round(Math.random() * 1e9);
    // cb(null, unique + path.extname(file.originalname));
    const now = new Date();
    const readableDate = now.toISOString().slice(0, 10).replace(/-/g, '');
    const time = now.toTimeString().split(' ')[0].replace(/:/g, '');
    //const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const uniqueSuffix = `${readableDate}-${time}-${Math.round(
      Math.random() * 1e9
    )}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

const uploadDirect = multer({ storage });

const importUpload = multer({ storage: multer.memoryStorage() });

router.get('/export', ctl.exportAll);
router.post('/import', importUpload.single('file'), ctl.importBulk);

// param loader
router.param('id', ctl.loadById);

/* ---------- GET list ---------- */
router.get('/', queryParser, ctl.list);

/* ---------- CREATE ---------- */
router.post('/', ctl.create);

router.get('/:id', ctl.read);

/* ---------- UPDATE ---------- */
router.put('/:id', statusGuard, ctl.update);

/* ---------- DELETE ---------- */
router.delete('/:id', ctl.remove);

/* ---------- ARCHIVE toggle ---------- */
router.patch('/:id/archive', ctl.toggleArchive);

/* ---------- ACTIONS (process‑flow) ---------- */
router.patch('/:id/actions/:actionName', ctl.triggerAction);

/* ---------- ACTIONS with data (partial qty) ---------- */
router.patch('/:id/actions/:actionName/data', ctl.triggerActionWithData);

router.patch('/:id/movements/:col/:rid/post', ctl.postMovement);
router.patch('/:id/movements/:col/:rid/cancel', ctl.cancelMovement);

/* payments */
router.post('/:id/payments', ctl.addPayment);

router.post('/:id/upload', upload.array('files', 10), ctl.uploadFiles);

// router.post("/import", uploadSingle, ctl.importFile);

// router.get("/stats", ctl.stats);
router.post('/:id/duplicate', ctl.duplicateOne);

export default router;
