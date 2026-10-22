import mongoose from 'mongoose';

const movementSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['Stock In', 'Stock Out', 'Transfer', 'Damaged'], required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', default: null },
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    fromWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    toWarehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
    qty: { type: Number, required: true, min: 1 },
    user: { type: String, default: '' },
    note: { type: String, default: '' },
  },
  { timestamps: true }
);

export default mongoose.model('Movement', movementSchema);
