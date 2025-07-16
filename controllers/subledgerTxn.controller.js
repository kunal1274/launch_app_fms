import SubledgerService from "../services/subledgerTxn.service.js";

async function createBase(req, res, type) {
  try {
    const dto = {
      subledgerType: type,
      sourceType: req.body.sourceType,
      sourceId: req.body.sourceId,
      customer: req.body.customer,
      supplier: req.body.supplier,
      bankAccount: req.body.bankAccount,
      item: req.body.item,
      amount: req.body.amount,
      currency: req.body.currency,
      exchangeRate: req.body.exchangeRate,
      dims: req.body.dims,
      extras: req.body.extras,
    };
    const doc = await SubledgerService.create(dto);
    res.status(201).json({ status: "success", data: doc });
  } catch (err) {
    console.error(err);
    res.status(400).json({ status: "failure", message: err.message });
  }
}

export const createArTxn = (req, res) => createBase(req, res, "AR");
export const createApTxn = (req, res) => createBase(req, res, "AP");
export const createWhtTxn = (req, res) => createBase(req, res, "WHT");
export const createTaxTxn = (req, res) => createBase(req, res, "TAX");
export const createChargeTxn = (req, res) => createBase(req, res, "CHARGES");
export const createDiscountTxn = (req, res) => createBase(req, res, "DISCOUNT");
export const createBankTxn = (req, res) => createBase(req, res, "BANK");

/** Create Tax txn (example) */
export const createTaxTxn1 = async (req, res) => {
  try {
    const dto = {
      type: "TAX",
      sourceType: req.body.sourceType,
      sourceId: req.body.sourceId,
      sourceLine: req.body.sourceLine,
      amount: req.body.amount,
      currency: req.body.currency,
      exchangeRate: req.body.exchangeRate,
      dims: req.body.dims,
      extras: req.body.extras,
    };
    const doc = await SubledgerService.create(dto);
    res.status(201).json({ status: "success", data: doc });
  } catch (err) {
    console.error(err);
    res.status(400).json({ status: "failure", message: err.message });
  }
};

/** Generic list endpoint */
export const listSubledgers = async (req, res) => {
  try {
    const { page, limit, ...filters } = req.query;
    const result = await SubledgerService.list(filters, { page, limit });
    res.json({ status: "success", ...result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: "failure", message: err.message });
  }
};
