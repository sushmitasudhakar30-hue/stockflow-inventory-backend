import Product from '../models/Product.js';
import Stock from '../models/Stock.js';
import Movement from '../models/Movement.js';

export async function getProducts(req, res) {
  try {
    const products = await Product.find().sort({ name: 1 }).lean();
    const stocks = await Stock.find().lean();
    const byProduct = {};
    for (const stock of stocks) {
      const key = String(stock.product);
      if (!byProduct[key]) byProduct[key] = {};
      byProduct[key][String(stock.warehouse)] = stock.quantity;
    }
    res.json(products.map((p) => ({ ...p, id: p._id, warehouseStock: byProduct[String(p._id)] || {} })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function getProduct(req, res) {
  try {
    const product = await Product.findById(req.params.id).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    const stocks = await Stock.find({ product: product._id }).lean();
    const warehouseStock = Object.fromEntries(stocks.map((s) => [String(s.warehouse), s.quantity]));
    res.json({ ...product, id: product._id, warehouseStock });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function createProduct(req, res) {
  try {
    const product = await Product.create(req.body);
    res.status(201).json({ ...product.toObject(), id: product._id, warehouseStock: {} });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'SKU already exists' });
    res.status(400).json({ message: error.message });
  }
}

export async function updateProduct(req, res) {
  try {
    const allowed = [
      'sku',
      'name',
      'category',
      'price',
      'reorderLevel',
      'minStock',
      'maxStock',
      'brand',
      'description',
      'unit',
      'imageUrl',
      'barcode',
      'active',
    ];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));
    const product = await Product.findByIdAndUpdate(req.params.id, updates, { new: true, runValidators: true }).lean();
    if (!product) return res.status(404).json({ message: 'Product not found' });
    res.json({ ...product, id: product._id });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'SKU already exists' });
    res.status(400).json({ message: error.message });
  }
}

export async function deleteProduct(req, res) {
  try {
    const product = await Product.findByIdAndDelete(req.params.id);
    if (!product) return res.status(404).json({ message: 'Product not found' });
    await Stock.deleteMany({ product: product._id });
    // Preserve movements for audit history; product reference becomes null.
    await Movement.updateMany({ product: product._id }, { $set: { product: null } });
    res.json({ message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function getCategories(req, res) {
  try {
    const categories = await Product.distinct('category');
    res.json(categories.sort());
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}
