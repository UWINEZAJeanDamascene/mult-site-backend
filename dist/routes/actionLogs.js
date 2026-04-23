"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const ActionLog_1 = require("../models/ActionLog");
const User_1 = require("../models/User");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
console.log('Action logs routes loaded');
// Get all action logs (main managers only)
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        // Only main managers can view action logs
        if (req.user.role !== User_1.UserRole.MAIN_MANAGER) {
            res.status(403).json({ error: 'Access denied. Main manager role required.' });
            return;
        }
        const companyId = req.user.company_id;
        const { page = '1', limit = '20', action, resource, userId, startDate, endDate, search, } = req.query;
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        // Build query
        let query = { companyId };
        if (action && Object.values(ActionLog_1.ActionType).includes(action)) {
            query.action = action;
        }
        if (resource && Object.values(ActionLog_1.ResourceType).includes(resource)) {
            query.resource = resource;
        }
        if (userId && mongoose_1.default.Types.ObjectId.isValid(userId)) {
            query.userId = new mongoose_1.default.Types.ObjectId(userId);
        }
        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate)
                query.timestamp.$gte = new Date(startDate);
            if (endDate)
                query.timestamp.$lte = new Date(endDate);
        }
        if (search) {
            query.$or = [
                { description: { $regex: search, $options: 'i' } },
                { userName: { $regex: search, $options: 'i' } },
                { userEmail: { $regex: search, $options: 'i' } },
                { resourceName: { $regex: search, $options: 'i' } },
            ];
        }
        const [logs, total] = await Promise.all([
            ActionLog_1.ActionLog.find(query)
                .sort({ timestamp: -1 })
                .skip(skip)
                .limit(limitNum)
                .lean(),
            ActionLog_1.ActionLog.countDocuments(query),
        ]);
        res.json({
            logs: logs.map((log) => ({
                id: log._id.toString(),
                userId: log.userId.toString(),
                userName: log.userName,
                userEmail: log.userEmail,
                userRole: log.userRole,
                action: log.action,
                resource: log.resource,
                resourceId: log.resourceId,
                resourceName: log.resourceName,
                description: log.description,
                details: log.details,
                ipAddress: log.ipAddress,
                timestamp: log.timestamp,
            })),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        console.error('Get action logs error:', error);
        res.status(500).json({ error: 'Failed to fetch action logs' });
    }
});
// Get action log statistics (main managers only)
router.get('/stats', auth_1.authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== User_1.UserRole.MAIN_MANAGER) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const companyId = req.user.company_id;
        const { startDate, endDate } = req.query;
        let dateFilter = {};
        if (startDate || endDate) {
            dateFilter.timestamp = {};
            if (startDate)
                dateFilter.timestamp.$gte = new Date(startDate);
            if (endDate)
                dateFilter.timestamp.$lte = new Date(endDate);
        }
        const [actionStats, resourceStats, recentActivity, totalCount] = await Promise.all([
            // Actions by type
            ActionLog_1.ActionLog.aggregate([
                { $match: { companyId, ...dateFilter } },
                { $group: { _id: '$action', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            // Actions by resource
            ActionLog_1.ActionLog.aggregate([
                { $match: { companyId, ...dateFilter } },
                { $group: { _id: '$resource', count: { $sum: 1 } } },
                { $sort: { count: -1 } },
            ]),
            // Recent activity (top users)
            ActionLog_1.ActionLog.aggregate([
                { $match: { companyId, ...dateFilter } },
                {
                    $group: {
                        _id: '$userId',
                        userName: { $first: '$userName' },
                        userEmail: { $first: '$userEmail' },
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
                { $limit: 5 },
            ]),
            // Total count
            ActionLog_1.ActionLog.countDocuments({ companyId, ...dateFilter }),
        ]);
        res.json({
            actionStats: actionStats.map((s) => ({ action: s._id, count: s.count })),
            resourceStats: resourceStats.map((s) => ({ resource: s._id, count: s.count })),
            topUsers: recentActivity.map((u) => ({
                userId: u._id.toString(),
                userName: u.userName,
                userEmail: u.userEmail,
                actionCount: u.count,
            })),
            totalActions: totalCount,
        });
    }
    catch (error) {
        console.error('Get action log stats error:', error);
        res.status(500).json({ error: 'Failed to fetch statistics' });
    }
});
// Get single action log details (main managers only)
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        if (req.user.role !== User_1.UserRole.MAIN_MANAGER) {
            res.status(403).json({ error: 'Access denied' });
            return;
        }
        const { id } = req.params;
        const companyId = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        if (!mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            res.status(400).json({ error: 'Invalid log ID' });
            return;
        }
        const log = await ActionLog_1.ActionLog.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            companyId,
        }).lean();
        if (!log) {
            res.status(404).json({ error: 'Log not found' });
            return;
        }
        res.json({
            id: log._id.toString(),
            userId: log.userId.toString(),
            userName: log.userName,
            userEmail: log.userEmail,
            userRole: log.userRole,
            action: log.action,
            resource: log.resource,
            resourceId: log.resourceId,
            resourceName: log.resourceName,
            description: log.description,
            details: log.details,
            ipAddress: log.ipAddress,
            userAgent: log.userAgent,
            timestamp: log.timestamp,
        });
    }
    catch (error) {
        console.error('Get action log details error:', error);
        res.status(500).json({ error: 'Failed to fetch log details' });
    }
});
exports.default = router;
//# sourceMappingURL=actionLogs.js.map