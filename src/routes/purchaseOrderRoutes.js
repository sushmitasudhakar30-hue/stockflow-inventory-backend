import { Router } from 'express';
import {
  getPurchaseOrders,
  createPurchaseOrder,
  receivePurchaseOrder,
} from '../controllers/purchaseOrderController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
const router = Router();
router.use(authenticate);
router.get('/', requireRole('Admin', 'Warehouse Manager', 'Sales Staff'), getPurchaseOrders);
router.post('/', requireRole('Admin', 'Warehouse Manager'), createPurchaseOrder);
router.post('/:id/receive', requireRole('Admin', 'Warehouse Manager'), receivePurchaseOrder);
export default router;
