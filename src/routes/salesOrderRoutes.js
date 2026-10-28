import { Router } from 'express';
import {
  getSalesOrders,
  createSalesOrder,
  updateSalesOrder,
  confirmSalesOrder,
  updateSalesOrderStatus,
  cancelSalesOrder,
  returnSalesOrder,
  deleteSalesOrder,
} from '../controllers/salesOrderController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
const router = Router();
const sellers = requireRole('Admin', 'Warehouse Manager', 'Sales Staff');
const managers = requireRole('Admin', 'Warehouse Manager');
router.use(authenticate);
router.get('/', sellers, getSalesOrders);
router.post('/', sellers, createSalesOrder);
router.put('/:id', sellers, updateSalesOrder);
router.post('/:id/confirm', sellers, confirmSalesOrder);
router.patch('/:id/status', sellers, updateSalesOrderStatus);
router.post('/:id/cancel', managers, cancelSalesOrder);
router.post('/:id/return', managers, returnSalesOrder);
router.delete('/:id', managers, deleteSalesOrder);
export default router;
