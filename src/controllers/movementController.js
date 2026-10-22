import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import Stock from '../models/Stock.js';
import Movement from '../models/Movement.js';

class StockError extends Error {}

// Atomically adds stock. Upsert is safe because of the unique (product, warehouse) index;
// if two requests race to create the row, the loser retries as a plain increment.
async function addStock(productId, warehouseId, qty) {
  const filter = { product: productId, warehouse: warehouseId };
  const update = { $inc: { quantity: qty } };
  try {
    return await Stock.findOneAndUpdate(filter, update, { upsert: true, new: true, setDefaultsOnInsert: true });
  } catch (error) {
    if (error.code === 11000) return Stock.findOneAndUpdate(filter, update, { new: true });
    throw error;
  }
}

// Atomically removes stock. The quantity check and the decrement happen in ONE database
// operation, so concurrent requests can never push the quantity below zero.
async function removeStock(productId, warehouseId, qty) {
  const updated = await Stock.findOneAndUpdate(
    { product: productId, warehouse: warehouseId, quantity: { $gte: qty } },
    { $inc: { quantity: -qty } },
    { new: true }
  );
  if (!updated) {
    const current = await Stock.findOne({ product: productId, warehouse: warehouseId });
    throw new StockError(`Insufficient stock. Available: ${current?.quantity || 0}`);
  }
  return updated;
}

// Records the movement; if that fails, runs `undo` so stock and history never disagree.
async function recordMovement(data, undo) {
  try {
    return await Movement.create(data);
  } catch (error) {
    await undo().catch((e) => console.error('Rollback failed, manual stock check needed:', e));
    throw error;
  }
}

function validQty(qty) {
  return Number.isInteger(qty) && qty > 0;
}

async function ensureIds(productId, warehouseIds) {
  if (!mongoose.isValidObjectId(productId)) throw new Error('Invalid product id');
  if (!(await Product.exists({ _id: productId }))) throw new Error('Product not found');
  for (const id of warehouseIds) {
    if (!mongoose.isValidObjectId(id) || !(await Warehouse.exists({ _id: id }))) throw new Error('Warehouse not found');
  }
}

export async function stockIn(req, res) {
  try {
    const { productId, warehouseId, qty, user = '', note = '' } = req.body;
    if (!validQty(qty)) return res.status(400).json({ message: 'Quantity must be a positive integer' });
    await ensureIds(productId, [warehouseId]);
    await addStock(productId, warehouseId, qty);
    const movement = await recordMovement(
      { type: 'Stock In', product: productId, warehouse: warehouseId, qty, user, note },
      () => removeStock(productId, warehouseId, qty)
    );
    res.status(201).json(movement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function stockOut(req, res) {
  try {
    const { productId, warehouseId, qty, user = '', note = '' } = req.body;
    if (!validQty(qty)) return res.status(400).json({ message: 'Quantity must be a positive integer' });
    await ensureIds(productId, [warehouseId]);
    await removeStock(productId, warehouseId, qty);
    const movement = await recordMovement(
      { type: 'Stock Out', product: productId, warehouse: warehouseId, qty, user, note },
      () => addStock(productId, warehouseId, qty)
    );
    res.status(201).json(movement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function transferStock(req, res) {
  try {
    const { productId, fromWarehouseId, toWarehouseId, qty, user = '', note = '' } = req.body;
    if (fromWarehouseId === toWarehouseId)
      return res.status(400).json({ message: 'Source and destination warehouses must be different' });
    if (!validQty(qty)) return res.status(400).json({ message: 'Quantity must be a positive integer' });
    await ensureIds(productId, [fromWarehouseId, toWarehouseId]);

    // Debit source first (fails cleanly if insufficient). If the credit fails, refund the source.
    await removeStock(productId, fromWarehouseId, qty);
    try {
      await addStock(productId, toWarehouseId, qty);
    } catch (error) {
      await addStock(productId, fromWarehouseId, qty);
      throw error;
    }
    const movement = await recordMovement(
      {
        type: 'Transfer',
        product: productId,
        fromWarehouse: fromWarehouseId,
        toWarehouse: toWarehouseId,
        qty,
        user,
        note,
      },
      async () => {
        await removeStock(productId, toWarehouseId, qty);
        await addStock(productId, fromWarehouseId, qty);
      }
    );
    res.status(201).json(movement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function reportDamaged(req, res) {
  try {
    const { productId, warehouseId, qty, reason = '', user = '' } = req.body;
    if (!validQty(qty)) return res.status(400).json({ message: 'Quantity must be a positive integer' });
    await ensureIds(productId, [warehouseId]);
    await removeStock(productId, warehouseId, qty);
    const movement = await recordMovement(
      { type: 'Damaged', product: productId, warehouse: warehouseId, qty, user, note: reason },
      () => addStock(productId, warehouseId, qty)
    );
    res.status(201).json(movement);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function getMovements(req, res) {
  try {
    const filter = {};
    if (req.query.type) filter.type = req.query.type;
    if (req.query.productId) filter.product = req.query.productId;
    if (req.query.warehouseId)
      filter.$or = [
        { warehouse: req.query.warehouseId },
        { fromWarehouse: req.query.warehouseId },
        { toWarehouse: req.query.warehouseId },
      ];
    const movements = await Movement.find(filter)
      .populate('product', 'sku name')
      .populate('warehouse', 'name')
      .populate('fromWarehouse', 'name')
      .populate('toWarehouse', 'name')
      .sort({ createdAt: -1 });
    res.json(movements);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
