// routes/subledger.routes.js
import express from 'express';
import {
  createArTxn,
  createApTxn,
  createWhtTxn,
  createTaxTxn,
  createChargeTxn,
  createDiscountTxn,
  createBankTxn,
  listSubledgers,
} from '../controllers/subledgerTxn.controller.js';

const router = express.Router();

router.post('/ar', createArTxn);
router.post('/ap', createApTxn);
router.post('/wht', createWhtTxn);
router.post('/tax', createTaxTxn);
router.post('/charges', createChargeTxn);
router.post('/discount', createDiscountTxn);
router.post('/bank', createBankTxn);

router.get('/', listSubledgers);

export default router;
