import { Router } from 'express';
import {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  getCategories,
} from '../controllers/productController.js';
import { authenticate, requireRole } from '../middleware/auth.js';
const router = Router();
const managers = requireRole('Admin', 'Warehouse Manager');
router.use(authenticate);
router.get('/', getProducts);
router.get('/categories', getCategories);
router.get('/:id', getProduct);
router.post('/', managers, createProduct);
router.put('/:id', managers, updateProduct);
router.delete('/:id', managers, deleteProduct);
export default router;
