import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import path from 'path';
import { config } from './config';
import { initializeWebSocketServer, closeWebSocketServer } from './websocket/server';
import { connectDB, disconnectDB } from './config/mongoose';

// Import routes
import authRoutes from './routes/auth';
import sitesRoutes from './routes/sites';
import siteRecordsRoutes from './routes/siteRecords';
import mainStockRoutes from './routes/mainStock';
import viewsRoutes from './routes/views';
import materialsRoutes from './routes/materials';
import actionLogsRoutes from './routes/actionLogs';
import notificationsRoutes from './routes/notifications';
import companiesRoutes from './routes/companies';
import purchaseOrderRoutes from './routes/purchaseOrders';

const app = express();

// Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));
// Allow cross-origin requests with credentials (cookies)
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Parse cookies for authentication
app.use(cookieParser());

// Serve frontend static files
app.use(express.static(path.join(__dirname, '../frontend')));

// Health check
app.get('/health', async (_req, res) => {
  try {
    // Check database connection
    const mongoose = (await import('./config/mongoose')).default;
    if (mongoose.connection.readyState === 1) {
      res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        database: 'connected',
        environment: config.NODE_ENV,
      });
    } else {
      throw new Error('Database not connected');
    }
  } catch (error) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      database: 'disconnected',
      error: 'Database connection failed',
    });
  }
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/sites', sitesRoutes);
app.use('/api/site-records', siteRecordsRoutes);
app.use('/api/main-stock', mainStockRoutes);
app.use('/api/views', viewsRoutes);
app.use('/api/materials', materialsRoutes);
app.use('/api/action-logs', actionLogsRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/companies', companiesRoutes);
app.use('/api/purchase-orders', purchaseOrderRoutes);
console.log('Action logs route registered at /api/action-logs');

// Error handling middleware
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    error: config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
  });
});

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// Connect to database and start server
async function startServer() {
  try {
    await connectDB();

    const server = app.listen(config.PORT, () => {
      console.log(`API server running on port ${config.PORT}`);
    });

    // Initialize WebSocket server
    initializeWebSocketServer();

    // Graceful shutdown
    process.on('SIGTERM', async () => {
      console.log('SIGTERM received, shutting down gracefully');
      closeWebSocketServer();
      server.close(() => {
        console.log('HTTP server closed');
      });
      await disconnectDB();
      process.exit(0);
    });

    process.on('SIGINT', async () => {
      console.log('SIGINT received, shutting down gracefully');
      closeWebSocketServer();
      server.close(() => {
        console.log('HTTP server closed');
      });
      await disconnectDB();
      process.exit(0);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

export default app;
