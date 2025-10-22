import { SalesOrderModel } from '../../bb3_sales_management_service/models/bb3SalesOrder.model.js';
import { CompanyModel } from '../../models/company.model.js';
import { ItemModel } from '../../models/item.model.js';

const MAP = {
  'sales-orders': SalesOrderModel,
  items: ItemModel,
  companies: CompanyModel,
};

export const uploadFiles = async (req, res, next) => {
  try {
    if (!req.files?.length)
      return res.status(400).json({ message: 'No files' });
    const { entity, entityId } = req.params;
    const Model = MAP[entity];
    if (!Model) return res.status(400).json({ message: 'Unknown entity' });

    const meta = req.files.map((f) => ({
      fileName: f.originalname,
      fileType: f.mimetype,
      fileUrl: `/${f.path.replace(/\\/g, '/')}`,
      // fileUrl: f.path.replace(/\\/g, "/").replace(/^uploads/, "uploads"),
      uploadedAt: new Date(),
    }));

    const doc = await Model.findByIdAndUpdate(
      entityId,
      { $push: { files: { $each: meta } } },
      { new: true }
    );
    if (!doc) return res.status(404).json({ message: 'Entity not found' });
    res.json({ status: 'success', data: doc.files });
  } catch (e) {
    next(e);
  }
};

export const deleteUploadedFile = async (req, res, next) => {
  try {
    const { entity, entityId, fileId } = req.params;
    const Model = MAP[entity];
    if (!Model) {
      return res
        .status(400)
        .json({ status: 'failure', message: 'Unknown entity' });
    }

    const doc = await Model.findById(entityId);
    if (!doc) {
      return res
        .status(404)
        .json({ status: 'failure', message: 'Entity not found' });
    }

    const file = doc.files.id(fileId);
    if (!file) {
      return res
        .status(404)
        .json({ status: 'failure', message: 'File not found' });
    }

    // Delete physical file
    const fullPath = path.join(process.cwd(), file.fileUrl);
    fs.unlink(fullPath, (err) => {
      if (err) console.error('Failed to delete file:', fullPath, err);
    });

    // Remove sub-doc and save
    file.remove();
    await doc.save();

    res.json({ status: 'success', data: doc.files });
  } catch (err) {
    next(err);
  }
};
