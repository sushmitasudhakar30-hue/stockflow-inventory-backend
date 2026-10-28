import Supplier from '../models/Supplier.js';
import PurchaseOrder from '../models/PurchaseOrder.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { supplierDTO } from '../utils/serializers.js';

const fields = ['name', 'contactPerson', 'email', 'phone', 'address'];
const pick = (body) => Object.fromEntries(fields.filter((f) => body[f] !== undefined).map((f) => [f, body[f]]));

export const getSuppliers = asyncHandler(async (req, res) => {
  const suppliers = await Supplier.find().sort({ name: 1 });
  res.json(suppliers.map(supplierDTO));
});

export const createSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.create(pick(req.body));
  res.status(201).json(supplierDTO(supplier));
});

export const updateSupplier = asyncHandler(async (req, res) => {
  const supplier = await Supplier.findByIdAndUpdate(req.params.id, pick(req.body), { new: true, runValidators: true });
  if (!supplier) throw new HttpError(404, 'Supplier not found');
  res.json(supplierDTO(supplier));
});

export const deleteSupplier = asyncHandler(async (req, res) => {
  if (await PurchaseOrder.exists({ supplierId: req.params.id })) {
    throw new HttpError(409, 'Cannot delete a supplier that has purchase orders');
  }
  const supplier = await Supplier.findByIdAndDelete(req.params.id);
  if (!supplier) throw new HttpError(404, 'Supplier not found');
  res.json({ message: 'Supplier deleted' });
});
