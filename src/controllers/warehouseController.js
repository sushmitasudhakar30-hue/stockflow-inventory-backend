import Warehouse from '../models/Warehouse.js';
import Stock from '../models/Stock.js';

export async function getWarehouses(req, res) {
  try {
    const warehouses = await Warehouse.find({ active: true }).sort({ name: 1 }).lean();
    res.json(warehouses.map((w) => ({ ...w, id: w._id, locations: w.locations || [] })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function getWarehouse(req, res) {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });
    const stocks = await Stock.find({ warehouse: warehouse._id }).populate('product', 'sku name').lean();
    res.json({ ...warehouse.toObject(), id: warehouse._id, locations: warehouse.locations || [], stocks });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
}

export async function createWarehouse(req, res) {
  try {
    const warehouse = await Warehouse.create(req.body);
    res.status(201).json({ ...warehouse.toObject(), id: warehouse._id, locations: warehouse.locations || [] });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}

export async function addLocation(req, res) {
  try {
    const warehouse = await Warehouse.findById(req.params.id);
    if (!warehouse) return res.status(404).json({ message: 'Warehouse not found' });
    warehouse.locations.push({
      rack: req.body.rack || '',
      bin: req.body.bin || '',
      productSku: req.body.productSku || '',
      quantity: Number(req.body.quantity || 0),
    });
    await warehouse.save();
    res.json({ ...warehouse.toObject(), id: warehouse._id });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
}
