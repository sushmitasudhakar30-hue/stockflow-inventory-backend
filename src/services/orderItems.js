import mongoose from 'mongoose';
import Product from '../models/Product.js';
import { HttpError } from '../utils/errors.js';

export const today = () => new Date().toISOString().slice(0, 10);

export function checkDate(date) {
  const value = date || today();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
    throw new HttpError(400, 'Date must be in YYYY-MM-DD format');
  }
  return value;
}

// Validates the lines and prices them from the PRODUCT TABLE, never from the request, so a client
// can't send its own prices. Returns { items, total }.
export async function buildItems(rawItems) {
  if (!Array.isArray(rawItems) || rawItems.length === 0) throw new HttpError(400, 'Add at least one item');
  const ids = rawItems.map((i) => i.productId);
  if (ids.some((id) => !mongoose.isValidObjectId(id))) throw new HttpError(400, 'Invalid product id');
  if (new Set(ids.map(String)).size !== ids.length) throw new HttpError(400, 'Each product can only be added once');
  if (rawItems.some((i) => !Number.isInteger(i.qty) || i.qty < 1)) {
    throw new HttpError(400, 'Quantity must be a positive whole number');
  }
  const products = await Product.find({ _id: { $in: ids } });
  const byId = Object.fromEntries(products.map((p) => [String(p._id), p]));
  const items = rawItems.map((i) => {
    const product = byId[String(i.productId)];
    if (!product) throw new HttpError(404, 'Product not found');
    return { productId: product._id, qty: i.qty, price: product.price };
  });
  return { items, total: items.reduce((sum, i) => sum + i.qty * i.price, 0) };
}
