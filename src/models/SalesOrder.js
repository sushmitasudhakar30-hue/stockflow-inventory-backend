import mongoose from 'mongoose';

const itemSchema = new mongoose.Schema(
  {
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    qty: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

export const SALES_STATUSES = ['Pending', 'Confirmed', 'Shipped', 'Delivered', 'Cancelled', 'Returned'];

const salesOrderSchema = new mongoose.Schema(
  {
    orderNumber: { type: String, required: true, unique: true },
    customer: { type: String, required: true, trim: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    items: { type: [itemSchema], validate: (v) => v.length > 0 },
    total: { type: Number, required: true, min: 0 },
    status: { type: String, enum: SALES_STATUSES, default: 'Pending' },
    // The warehouse stock was deducted from, so cancel / return / delete put it back in the same place.
    warehouse: { type: mongoose.Schema.Types.ObjectId, ref: 'Warehouse', default: null },
  },
  { timestamps: true }
);

export default mongoose.model('SalesOrder', salesOrderSchema);
