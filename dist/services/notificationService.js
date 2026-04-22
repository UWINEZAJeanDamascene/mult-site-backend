"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationService = void 0;
const Notification_1 = require("../models/Notification");
class NotificationService {
    // Create notification for material received
    static async notifyMaterialReceived(userId, materialName, quantity, siteName) {
        return (0, Notification_1.createNotification)({
            userId,
            type: Notification_1.NotificationType.MATERIAL_RECEIVED,
            title: 'Material Received',
            message: `${materialName} - ${quantity} units received${siteName ? ` at ${siteName}` : ''}`,
            priority: Notification_1.NotificationPriority.MEDIUM,
            data: { materialName, quantity, siteName },
        });
    }
    // Create notification for material used
    static async notifyMaterialUsed(userId, materialName, quantity, siteName) {
        return (0, Notification_1.createNotification)({
            userId,
            type: Notification_1.NotificationType.MATERIAL_USED,
            title: 'Material Used',
            message: `${materialName} - ${quantity} units used${siteName ? ` at ${siteName}` : ''}`,
            priority: Notification_1.NotificationPriority.MEDIUM,
            data: { materialName, quantity, siteName },
        });
    }
    // Create notification for low stock
    static async notifyLowStock(userId, materialName, remainingQuantity, threshold) {
        return (0, Notification_1.createNotification)({
            userId,
            type: Notification_1.NotificationType.MATERIAL_LOW_STOCK,
            title: 'Low Stock Alert',
            message: `${materialName} has only ${remainingQuantity} units remaining${threshold ? ` (below threshold of ${threshold})` : ''}`,
            priority: Notification_1.NotificationPriority.HIGH,
            data: { materialName, remainingQuantity, threshold },
        });
    }
    // Create notification for site created
    static async notifySiteCreated(userId, siteName, location) {
        return (0, Notification_1.createNotification)({
            userId,
            type: Notification_1.NotificationType.SITE_CREATED,
            title: 'New Site Created',
            message: `${siteName} has been created in ${location}`,
            priority: Notification_1.NotificationPriority.LOW,
            data: { siteName, location },
        });
    }
    // Create notification for price updated
    static async notifyPriceUpdated(userId, materialName, oldPrice, newPrice) {
        return (0, Notification_1.createNotification)({
            userId,
            type: Notification_1.NotificationType.PRICE_UPDATED,
            title: 'Price Updated',
            message: `${materialName} price changed from $${oldPrice} to $${newPrice}`,
            priority: Notification_1.NotificationPriority.MEDIUM,
            data: { materialName, oldPrice, newPrice },
        });
    }
    // Create notification for record marked as received
    static async notifyRecordReceived(userId, materialName, status) {
        return (0, Notification_1.createNotification)({
            userId,
            type: Notification_1.NotificationType.RECORD_RECEIVED,
            title: 'Record Status Updated',
            message: `${materialName} has been marked as ${status}`,
            priority: Notification_1.NotificationPriority.LOW,
            data: { materialName, status },
        });
    }
    // Create generic system notification
    static async notifySystem(userId, title, message) {
        return (0, Notification_1.createNotification)({
            userId,
            type: Notification_1.NotificationType.SYSTEM,
            title,
            message,
            priority: Notification_1.NotificationPriority.MEDIUM,
        });
    }
}
exports.NotificationService = NotificationService;
exports.default = NotificationService;
//# sourceMappingURL=notificationService.js.map