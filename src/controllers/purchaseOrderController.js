import mongoose from 'mongoose';
import PurchaseOrder from '../models/PurchaseOrder.js';
import Supplier from '../models/Supplier.js';
import { nextNumber } from '../models/Counter.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { movementDTO, purchaseOrderDTO, stockRow } from '../utils/serializers.js';
import { addLines, defaultWarehouse, recordMovements, removeLines } from '../services/stockService.js';
import { buildItems, checkDate } from '../services/orderItems.js';

export const getPurchaseOrders = asyncHandler(async (req, res) => {
  const orders = await PurchaseOrder.find().sort({ date: -1, createdAt: -1 });
  res.json(orders.map(purchaseOrderDTO));
});

export const createPurchaseOrder = asyncHandler(async (req, res) => {
  const { supplierId, date } = req.body;
  if (!mongoose.isValidObjectId(supplierId) || !(await Supplier.exists({ _id: supplierId }))) {
    throw new HttpError(400, 'Supplier not found');
  }
  const { items, total } = await buildItems(req.body.items);
  const order = await PurchaseOrder.create({
    poNumber: await nextNumber('PO'),
    supplierId,
    date: checkDate(date),
    items,
    total,
  });
  res.status(201).json(purchaseOrderDTO(order));
});

// Pending -> Received: adds every line to the default warehouse exactly once.
export const receivePurchaseOrder = asyncHandler(async (req, res) => {
  const warehouse = await defaultWarehouse();
  const order = await PurchaseOrder.findOneAndUpdate(
    { _id: req.params.id, status: 'Pending' },
    { status: 'Received' },
    { new: true }
  );
  if (!order) {
    if (!(await PurchaseOrder.exists({ _id: req.params.id }))) throw new HttpError(404, 'Purchase order not found');
    throw new HttpError(409, 'This purchase order has already been received');
  }
  const lines = order.items.map((i) => ({ productId: i.productId, qty: i.qty }));
  const revert = () => PurchaseOrder.updateOne({ _id: order._id }, { status: 'Pending' });
  try {
    const rows = await addLines(lines, warehouse._id);
    const movements = await recordMovements(
      order.items.map((i) => ({
        type: 'Stock In',
        product: i.productId,
        warehouse: warehouse._id,
        qty: i.qty,
        user: req.user.name,
        note: `Purchase order ${order.poNumber}`,
      })),
      async () => {
        await removeLines(lines, warehouse._id);
        await revert();
      }
    );
    res.json({ order: purchaseOrderDTO(order), movements: movements.map(movementDTO), stock: rows.map(stockRow) });
  } catch (error) {
    await revert();
    throw error;
  }
});
