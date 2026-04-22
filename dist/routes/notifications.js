"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const auth_1 = require("../middleware/auth");
const Notification_1 = require("../models/Notification");
const router = express_1.default.Router();
// Get all notifications for current user
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        const query = { userId: req.user.id };
        if (unreadOnly === 'true') {
            query.isRead = false;
        }
        const notifications = await Notification_1.Notification.find(query)
            .sort({ createdAt: -1 })
            .limit(Number(limit) * 1)
            .skip((Number(page) - 1) * Number(limit));
        const total = await Notification_1.Notification.countDocuments(query);
        const unreadCount = await Notification_1.Notification.countDocuments({
            userId: req.user.id,
            isRead: false,
        });
        res.json({
            notifications,
            total,
            unreadCount,
            hasMore: total > Number(page) * Number(limit),
        });
    }
    catch (error) {
        console.error('Get notifications error:', error);
        res.status(500).json({ error: 'Failed to get notifications' });
    }
});
// Get unread count
router.get('/unread-count', auth_1.authenticateToken, async (req, res) => {
    try {
        const count = await Notification_1.Notification.countDocuments({
            userId: req.user.id,
            isRead: false,
        });
        res.json({ count });
    }
    catch (error) {
        console.error('Get unread count error:', error);
        res.status(500).json({ error: 'Failed to get unread count' });
    }
});
// Mark notification as read
router.patch('/:id/read', auth_1.authenticateToken, async (req, res) => {
    try {
        const notification = await Notification_1.Notification.findOneAndUpdate({ _id: req.params.id, userId: req.user.id }, { isRead: true }, { new: true });
        if (!notification) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }
        res.json(notification);
        return;
    }
    catch (error) {
        console.error('Mark read error:', error);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});
// Mark all as read
router.patch('/mark-all-read', auth_1.authenticateToken, async (req, res) => {
    try {
        await Notification_1.Notification.updateMany({ userId: req.user.id, isRead: false }, { isRead: true });
        res.json({ success: true });
    }
    catch (error) {
        console.error('Mark all read error:', error);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});
// Delete notification
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const notification = await Notification_1.Notification.findOneAndDelete({
            _id: req.params.id,
            userId: req.user.id,
        });
        if (!notification) {
            res.status(404).json({ error: 'Notification not found' });
            return;
        }
        res.json({ success: true });
        return;
    }
    catch (error) {
        console.error('Delete notification error:', error);
        res.status(500).json({ error: 'Failed to delete notification' });
    }
});
exports.default = router;
//# sourceMappingURL=notifications.js.map