import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import { connectDB } from './config/db.js';
import productRoutes from './routes/productRoutes.js';
import warehouseRoutes from './routes/warehouseRoutes.js';
import movementRoutes from './routes/movementRoutes.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import supplierRoutes from './routes/supplierRoutes.js';
import salesOrderRoutes from './routes/salesOrderRoutes.js';
import purchaseOrderRoutes from './routes/purchaseOrderRoutes.js';
import notificationRoutes from './routes/notificationRoutes.js';
import { errorHandler, notFound } from './middleware/errorHandler.js';

if (!process.env.JWT_SECRET || process.env.JWT_SECRET.length < 16) {
  console.error('JWT_SECRET is missing or too short (min 16 chars). Set it in .env');
  process.exit(1);
}

const app = express();
const PORT = process.env.PORT || 5000;

// CLIENT_URL may hold several comma-separated origins, e.g. your local and deployed frontends.
const origins = (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((o) => o.trim());
app.use(cors({ origin: origins }));
app.use(express.json());
app.use(morgan('dev'));

app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'StockFlow Inventory API' }));
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/warehouses', warehouseRoutes);
app.use('/api/movements', movementRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/sales-orders', salesOrderRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
app.use('/api/notifications', notificationRoutes);

app.use(notFound);
app.use(errorHandler);

await connectDB();
app.listen(PORT, () => console.log(`API running at http://localhost:${PORT}`));
