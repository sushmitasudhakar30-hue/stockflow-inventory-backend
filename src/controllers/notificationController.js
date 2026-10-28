import Notification from '../models/Notification.js';
import { HttpError, asyncHandler } from '../utils/errors.js';
import { notificationDTO } from '../utils/serializers.js';

export const getNotifications = asyncHandler(async (req, res) => {
  const list = await Notification.find().sort({ createdAt: -1 }).limit(100);
  res.json(list.map((n) => notificationDTO(n, req.user._id)));
});

export const createNotification = asyncHandler(async (req, res) => {
  const { type = 'info', title, message = '', date } = req.body;
  if (!title?.trim()) throw new HttpError(400, 'Title is required');
  const n = await Notification.create({ type, title, message, date: date || new Date().toISOString().slice(0, 10) });
  res.status(201).json(notificationDTO(n, req.user._id));
});

export const markRead = asyncHandler(async (req, res) => {
  const n = await Notification.findByIdAndUpdate(req.params.id, { $addToSet: { readBy: req.user._id } }, { new: true });
  if (!n) throw new HttpError(404, 'Notification not found');
  res.json(notificationDTO(n, req.user._id));
});

export const markAllRead = asyncHandler(async (req, res) => {
  await Notification.updateMany({ readBy: { $ne: req.user._id } }, { $addToSet: { readBy: req.user._id } });
  res.json({ message: 'All notifications marked as read' });
});
