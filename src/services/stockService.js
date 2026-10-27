import mongoose from 'mongoose';
import Product from '../models/Product.js';
import Warehouse from '../models/Warehouse.js';
import Stock from '../models/Stock.js';
import Movement from '../models/Movement.js';
import { HttpError } from '../utils/errors.js';

// Atomically adds stock. Upsert is safe because of the unique (product, warehouse) index;
// if two requests race to create the row, the loser retries as a plain increment.
export async function addStock(productId, warehouseId, qty) {
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
export async function removeStock(productId, warehouseId, qty, label = '') {
  const updated = await Stock.findOneAndUpdate(
    { product: productId, warehouse: warehouseId, quantity: { $gte: qty } },
    { $inc: { quantity: -qty } },
    { new: true }
  );
  if (!updated) {
    const current = await Stock.findOne({ product: productId, warehouse: warehouseId });
    throw new HttpError(400, `Insufficient stock${label ? ` for ${label}` : ''}. Available: ${current?.quantity || 0}`);
  }
  return updated;
}

// Records movements; if that fails, runs `undo` so stock and history never disagree.
export async function recordMovements(docs, undo) {
  try {
    return await Movement.insertMany(docs);
  } catch (error) {
    await undo().catch((e) => console.error('Rollback failed, manual stock check needed:', e));
    throw error;
  }
}

export const validQty = (qty) => Number.isInteger(qty) && qty > 0;

export async function ensureIds(productId, warehouseIds) {
  if (!mongoose.isValidObjectId(productId)) throw new HttpError(400, 'Invalid product id');
  if (!(await Product.exists({ _id: productId }))) throw new HttpError(404, 'Product not found');
  for (const id of warehouseIds) {
    if (!mongoose.isValidObjectId(id) || !(await Warehouse.exists({ _id: id }))) {
      throw new HttpError(404, 'Warehouse not found');
    }
  }
}

// The warehouse orders draw from / deliver to. Same ordering the warehouse list uses (A-Z), so
// the app's "first warehouse" and the server's choice always agree.
export async function defaultWarehouse() {
  const wh = await Warehouse.findOne({ active: true }).sort({ name: 1 });
  if (!wh) throw new HttpError(400, 'No warehouse available');
  return wh;
}

// Takes `lines` ([{ productId, qty }]) out of a warehouse as ONE all-or-nothing step.
// Returns the new stock rows. If any line is short, everything already taken is put back.
export async function removeLines(lines, warehouseId) {
  const names = Object.fromEntries(
    (await Product.find({ _id: { $in: lines.map((l) => l.productId) } }).select('name')).map((p) => [
      String(p._id),
      p.name,
    ])
  );
  const done = [];
  const rows = [];
  try {
    for (const l of lines) {
      rows.push(await removeStock(l.productId, warehouseId, l.qty, names[String(l.productId)]));
      done.push(l);
    }
    return rows;
  } catch (error) {
    for (const l of done) await addStock(l.productId, warehouseId, l.qty).catch(() => {});
    throw error;
  }
}

export async function addLines(lines, warehouseId) {
  const rows = [];
  for (const l of lines) rows.push(await addStock(l.productId, warehouseId, l.qty));
  return rows;
}
