"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const helmet_1 = __importDefault(require("helmet"));
const path_1 = __importDefault(require("path"));
const config_1 = require("./config");
const server_1 = require("./websocket/server");
const mongoose_1 = require("./config/mongoose");
// Import routes
const auth_1 = __importDefault(require("./routes/auth"));
const sites_1 = __importDefault(require("./routes/sites"));
const siteRecords_1 = __importDefault(require("./routes/siteRecords"));
const mainStock_1 = __importDefault(require("./routes/mainStock"));
const views_1 = __importDefault(require("./routes/views"));
const materials_1 = __importDefault(require("./routes/materials"));
const actionLogs_1 = __importDefault(require("./routes/actionLogs"));
const notifications_1 = __importDefault(require("./routes/notifications"));
const companies_1 = __importDefault(require("./routes/companies"));
const purchaseOrders_1 = __importDefault(require("./routes/purchaseOrders"));
const app = (0, express_1.default)();
// Middleware
app.use((0, helmet_1.default)({
    contentSecurityPolicy: false,
}));
// Allow cross-origin requests with credentials (cookies)
app.use((0, cors_1.default)({ origin: true, credentials: true }));
app.use(express_1.default.json({ limit: '10mb' }));
app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
// Parse cookies for authentication
app.use((0, cookie_parser_1.default)());
// Serve frontend static files
app.use(express_1.default.static(path_1.default.join(__dirname, '../frontend')));
// Health check
app.get('/health', async (_req, res) => {
    try {
        // Check database connection
        const mongoose = (await Promise.resolve().then(() => __importStar(require('./config/mongoose')))).default;
        if (mongoose.connection.readyState === 1) {
            res.json({
                status: 'healthy',
                timestamp: new Date().toISOString(),
                database: 'connected',
                environment: config_1.config.NODE_ENV,
            });
        }
        else {
            throw new Error('Database not connected');
        }
    }
    catch (error) {
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            database: 'disconnected',
            error: 'Database connection failed',
        });
    }
});
// API routes
app.use('/auth', auth_1.default);
app.use('/sites', sites_1.default);
app.use('/site-records', siteRecords_1.default);
app.use('/main-stock', mainStock_1.default);
app.use('/views', views_1.default);
app.use('/materials', materials_1.default);
app.use('/action-logs', actionLogs_1.default);
app.use('/notifications', notifications_1.default);
app.use('/companies', companies_1.default);
app.use('/purchase-orders', purchaseOrders_1.default);
console.log('Action logs route registered at /api/action-logs');
// Error handling middleware
app.use((err, _req, res, _next) => {
    console.error('Error:', err);
    res.status(500).json({
        error: config_1.config.NODE_ENV === 'production' ? 'Internal server error' : err.message,
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
        await (0, mongoose_1.connectDB)();
        console.log('Database connected successfully');
        const server = app.listen(config_1.config.PORT, () => {
            console.log(`API server running on port ${config_1.config.PORT}`);
            console.log(`Health check available at http://localhost:${config_1.config.PORT}/health`);
        });
        // Initialize WebSocket server
        (0, server_1.initializeWebSocketServer)();
        // Graceful shutdown
        process.on('SIGTERM', async () => {
            console.log('SIGTERM received, shutting down gracefully');
            (0, server_1.closeWebSocketServer)();
            server.close(() => {
                console.log('HTTP server closed');
            });
            await (0, mongoose_1.disconnectDB)();
            process.exit(0);
        });
        process.on('SIGINT', async () => {
            console.log('SIGINT received, shutting down gracefully');
            (0, server_1.closeWebSocketServer)();
            server.close(() => {
                console.log('HTTP server closed');
            });
            await (0, mongoose_1.disconnectDB)();
            process.exit(0);
        });
    }
    catch (error) {
        console.error('Failed to start server:', error);
        process.exit(1);
    }
}
startServer();
exports.default = app;
//# sourceMappingURL=index.js.map