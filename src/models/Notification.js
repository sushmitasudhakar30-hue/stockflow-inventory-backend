import mongoose from 'mongoose';

// Notifications are shared by everyone; each user's "read" state is tracked in readBy.
const notificationSchema = new mongoose.Schema(
  {
    type: { type: String, default: 'info' },
    title: { type: String, required: true, trim: true },
    message: { type: String, default: '' },
    date: { type: String, default: '' },
    readBy: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  { timestamps: true }
);

export default mongoose.model('Notification', notificationSchema);
