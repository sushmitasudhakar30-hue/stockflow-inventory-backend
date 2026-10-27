import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const purchaseOrderSchema = new mongoose.Schema(
  {
    poNumber: { type: String, required: true, unique: true },
    supplierId: { type: mongoose.Schema.Types.ObjectId, ref: 'Supplier', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: ['Pending', 'Received'], default: 'Pending' },
  },
  { timestamps: true }
);

export default mongoose.model('PurchaseOrder', purchaseOrderSchema);
