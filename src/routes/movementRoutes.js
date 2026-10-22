import { Router } from 'express';
import { stockIn, stockOut, transferStock, reportDamaged, getMovements } from '../controllers/movementController.js';
const router = Router();
router.get('/', getMovements);
router.post('/stock-in', stockIn);
router.post('/stock-out', stockOut);
router.post('/transfer', transferStock);
router.post('/damaged', reportDamaged);
export default router;
