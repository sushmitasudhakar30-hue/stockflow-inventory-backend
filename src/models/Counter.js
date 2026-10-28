import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({ _id: String, seq: { type: Number, default: 0 } });
const Counter = mongoose.model('Counter', counterSchema);

// Atomic, gap-tolerant document numbers such as SO-1001 / PO-1001.
export async function nextNumber(prefix, start = 1000) {
  const counter = await Counter.findOneAndUpdate({ _id: prefix }, { $inc: { seq: 1 } }, { upsert: true, new: true });
  return `${prefix}-${start + counter.seq}`;
}
