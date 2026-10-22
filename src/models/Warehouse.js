import mongoose from 'mongoose';

const warehouseSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    location: { type: String, required: true, trim: true },
    capacity: { type: Number, min: 0, default: 0 },
    active: { type: Boolean, default: true },
    locations: [
      {
        rack: { type: String, default: '' },
        bin: { type: String, default: '' },
        productSku: { type: String, default: '' },
        quantity: { type: Number, min: 0, default: 0 },
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model('Warehouse', warehouseSchema);
