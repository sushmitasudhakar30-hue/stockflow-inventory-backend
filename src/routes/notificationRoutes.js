import { Router } from 'express';
import { getNotifications, createNotification, markRead, markAllRead } from '../controllers/notificationController.js';
import { authenticate } from '../middleware/auth.js';
const router = Router();
router.use(authenticate);
router.get('/', getNotifications);
router.post('/', createNotification);
router.patch('/read-all', markAllRead); // must be declared before '/:id/read'
router.patch('/:id/read', markRead);
export default router;
