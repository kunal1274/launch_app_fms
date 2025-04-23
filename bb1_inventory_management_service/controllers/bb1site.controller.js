import createError from "http-errors";
import { SiteModel } from "../models/bb1site.model.js";

export const list = async (req, res, next) => {
  try {
    const rows = await SiteModel.find({ archived: false }).sort({
      createdAt: -1,
    });
    res.json({ data: rows });
  } catch (e) {
    next(e);
  }
};

export const create = async (req, res, next) => {
  try {
    const doc = await SiteModel.create(req.body);
    res.status(201).json(doc);
  } catch (e) {
    next(e);
  }
};

export const read = async (req, res) => res.json(req.site);

export const update = async (req, res, next) => {
  try {
    const doc = await SiteModel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

export const remove = async (req, res, next) => {
  try {
    await SiteModel.findByIdAndDelete(req.params.id);
    res.status(204).end();
  } catch (e) {
    next(e);
  }
};

export const toggleArchive = async (req, res, next) => {
  try {
    const doc = await SiteModel.findByIdAndUpdate(
      req.params.id,
      { archived: !!req.body.archived },
      { new: true }
    );
    res.json(doc);
  } catch (e) {
    next(e);
  }
};

/* param loader */
export const loadById = async (req, res, next, id) => {
  const doc = await SiteModel.findById(id);
  if (!doc) return next(createError(404, "Site not found"));
  req.site = doc;
  next();
};
