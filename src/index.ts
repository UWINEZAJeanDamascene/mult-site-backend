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
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);

    // In development, allow localhost
    if (config.NODE_ENV !== 'production') {
      const devOrigins = ['http://localhost:3000', 'http://localhost:5173', 'http://127.0.0.1:3000', 'http://127.0.0.1:5173'];
      if (devOrigins.some(devOrigin => origin.startsWith(devOrigin.split(':')[1]))) {
        return callback(null, true);
      }
    }

    // In production, allow Vercel domains and your specific domain
    if (config.NODE_ENV === 'production') {
      const prodOrigins = [
        'https://mult-sitef-frontend.vercel.app',
        'https://mult-site-frontend.vercel.app',
        'https://mult-sitef-frontend.vercel.app',
        /\.vercel\.app$/
      ];

      const isAllowed = prodOrigins.some(allowed => {
        if (typeof allowed === 'string') {
          return origin === allowed;
        } else if (allowed instanceof RegExp) {
          return allowed.test(origin);
        }
        return false;
      });

      if (isAllowed) {
        return callback(null, true);
      }
    }

    console.log('CORS blocked origin:', origin);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
// Parse cookies for authentication
app.use(cookieParser());

// API info endpoint
app.get('/', (_req, res) => {
  res.json({
    message: 'Lilstock API Server',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      auth: '/auth/*',
      sites: '/sites/*',
      'main-stock': '/main-stock/*',
      'purchase-orders': '/purchase-orders/*',
      // Add other endpoints as needed
    }
  });
});

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
app.use('/auth', authRoutes);
app.use('/sites', sitesRoutes);
app.use('/site-records', siteRecordsRoutes);
app.use('/main-stock', mainStockRoutes);
app.use('/views', viewsRoutes);
app.use('/materials', materialsRoutes);
app.use('/action-logs', actionLogsRoutes);
app.use('/notifications', notificationsRoutes);
app.use('/companies', companiesRoutes);
app.use('/purchase-orders', purchaseOrderRoutes);
console.log('Routes registered successfully');

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
    console.log('Connecting to database...');
    await connectDB();
    console.log('Database connected successfully');

    const server = app.listen(config.PORT, () => {
      console.log(`API server running on port ${config.PORT}`);
      console.log(`Health check available at http://localhost:${config.PORT}/health`);
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
