"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ActionLogService = void 0;
const ActionLog_1 = require("../models/ActionLog");
class ActionLogService {
    /**
     * Log a user action
     */
    static async logAction(data) {
        try {
            await ActionLog_1.ActionLog.create({
                ...data,
                timestamp: new Date(),
            });
        }
        catch (error) {
            console.error('Failed to log action:', error);
            // Don't throw - logging should not break main functionality
        }
    }
    /**
     * Log action from Express request
     */
    static async logFromRequest(req, action, resource, description, options = {}) {
        try {
            // Use passed user data or fall back to req.user
            const userId = options.userId || req.user?.id;
            const userName = options.userName || req.user?.name;
            const userEmail = options.userEmail || req.user?.email;
            const userRole = options.userRole || req.user?.role;
            const companyId = options.companyId || req.user?.company_id;
            if (!userId || !userName) {
                console.log('ActionLogService: Missing user data, skipping log');
                return;
            }
            const { resourceId, resourceName, details } = options;
            await ActionLog_1.ActionLog.create({
                userId,
                userName,
                userEmail: userEmail || 'unknown',
                userRole: userRole || 'unknown',
                companyId: companyId || 'unknown',
                action,
                resource,
                resourceId,
                resourceName,
                description,
                details,
                ipAddress: req.ip || req.socket.remoteAddress,
                userAgent: req.headers['user-agent'],
            });
            console.log(`Action logged: ${action} - ${description}`);
        }
        catch (error) {
            // Silently fail - don't break the main operation
            console.error('Failed to log action:', error);
        }
    }
    /**
     * Log site creation
     */
    static async logSiteCreate(req, siteId, siteName) {
        await this.logFromRequest(req, ActionLog_1.ActionType.CREATE, ActionLog_1.ResourceType.SITE, `Created site: ${siteName}`, {
            resourceId: siteId,
            resourceName: siteName,
            details: {
                name: req.body.name,
                location: req.body.location,
                description: req.body.description,
            },
        });
    }
    /**
     * Log site update
     */
    static async logSiteUpdate(req, siteId, siteName) {
        await this.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.SITE, `Updated site: ${siteName}`, {
            resourceId: siteId,
            resourceName: siteName,
            details: {
                name: req.body.name,
                location: req.body.location,
                description: req.body.description,
                isActive: req.body.isActive,
            },
        });
    }
    /**
     * Log site deletion
     */
    static async logSiteDelete(req, siteId, siteName) {
        await this.logFromRequest(req, ActionLog_1.ActionType.DELETE, ActionLog_1.ResourceType.SITE, `Deleted site: ${siteName}`, {
            resourceId: siteId,
            resourceName: siteName,
        });
    }
    /**
     * Log site record creation
     */
    static async logSiteRecordCreate(req, recordId, materialName, details) {
        await this.logFromRequest(req, ActionLog_1.ActionType.CREATE, ActionLog_1.ResourceType.SITE_RECORD, `Recorded material: ${materialName}`, {
            resourceId: recordId,
            resourceName: materialName,
            details,
        });
    }
    /**
     * Log main stock record creation
     */
    static async logMainStockCreate(req, recordId, materialName, details) {
        await this.logFromRequest(req, ActionLog_1.ActionType.CREATE, ActionLog_1.ResourceType.MAIN_STOCK, `Created main stock record: ${materialName}`, {
            resourceId: recordId,
            resourceName: materialName,
            details,
        });
    }
    /**
     * Log price update
     */
    static async logPriceUpdate(req, recordId, materialName, oldPrice, newPrice) {
        await this.logFromRequest(req, ActionLog_1.ActionType.PRICE_UPDATE, ActionLog_1.ResourceType.MAIN_STOCK, `Updated price for ${materialName}: ${oldPrice || '-'} → ${newPrice}`, {
            resourceId: recordId,
            resourceName: materialName,
            details: { oldPrice, newPrice },
        });
    }
    /**
     * Log material creation
     */
    static async logMaterialCreate(req, materialId, materialName) {
        await this.logFromRequest(req, ActionLog_1.ActionType.CREATE, ActionLog_1.ResourceType.MATERIAL, `Created material: ${materialName}`, {
            resourceId: materialId,
            resourceName: materialName,
            details: {
                name: req.body.name,
                unit: req.body.unit,
                description: req.body.description,
            },
        });
    }
    /**
     * Log material update
     */
    static async logMaterialUpdate(req, materialId, materialName) {
        await this.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.MATERIAL, `Updated material: ${materialName}`, {
            resourceId: materialId,
            resourceName: materialName,
            details: {
                name: req.body.name,
                unit: req.body.unit,
                description: req.body.description,
            },
        });
    }
    /**
     * Log user creation
     */
    static async logUserCreate(req, userId, userName, userEmail) {
        await this.logFromRequest(req, ActionLog_1.ActionType.CREATE, ActionLog_1.ResourceType.USER, `Created user: ${userName} (${userEmail})`, {
            resourceId: userId,
            resourceName: userName,
            details: { email: userEmail, role: req.body.role },
        });
    }
    /**
     * Log user update
     */
    static async logUserUpdate(req, userId, userName) {
        await this.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.USER, `Updated user: ${userName}`, {
            userId,
            userName,
            details: {
                name: req.body.name,
                email: req.body.email,
                role: req.body.role,
                assignedSites: req.body.assignedSiteIds,
                isActive: req.body.isActive,
            },
        });
    }
    /**
     * Log user deletion
     */
    static async logUserDelete(req, userId, userName) {
        await this.logFromRequest(req, ActionLog_1.ActionType.DELETE, ActionLog_1.ResourceType.USER, `Deleted user: ${userName}`, {
            resourceId: userId,
            resourceName: userName,
        });
    }
    /**
     * Log manager assignment to site
     */
    static async logManagerAssign(req, siteId, siteName, managerId, managerName) {
        await this.logFromRequest(req, ActionLog_1.ActionType.ASSIGN, ActionLog_1.ResourceType.SITE, `Assigned manager ${managerName} to site ${siteName}`, {
            resourceId: siteId,
            resourceName: siteName,
            details: { managerId, managerName },
        });
    }
    /**
     * Log manager unassignment from site
     */
    static async logManagerUnassign(req, siteId, siteName, managerId, managerName) {
        await this.logFromRequest(req, ActionLog_1.ActionType.UNASSIGN, ActionLog_1.ResourceType.SITE, `Removed manager ${managerName} from site ${siteName}`, {
            resourceId: siteId,
            resourceName: siteName,
            details: { managerId, managerName },
        });
    }
    /**
     * Log sync to main stock
     */
    static async logSyncToMainStock(req, siteRecordId, materialName, syncedQuantity) {
        await this.logFromRequest(req, ActionLog_1.ActionType.SYNC, ActionLog_1.ResourceType.MAIN_STOCK, `Synced ${materialName} to main stock (${syncedQuantity} units)`, {
            resourceId: siteRecordId,
            resourceName: materialName,
            details: { syncedQuantity },
        });
    }
    /**
     * Log login
     */
    static async logLogin(req, userId, userName, userEmail, userRole, companyId) {
        await this.logFromRequest(req, ActionLog_1.ActionType.LOGIN, ActionLog_1.ResourceType.SYSTEM, `User logged in: ${userName}`, {
            userId,
            userName,
            userEmail,
            userRole,
            resourceId: userId,
            resourceName: userName,
            companyId,
        });
    }
    /**
     * Log logout
     */
    static async logLogout(req, userId, userName) {
        await this.logFromRequest(req, ActionLog_1.ActionType.LOGOUT, ActionLog_1.ResourceType.SYSTEM, `User logged out: ${userName}`, {
            resourceId: userId,
            resourceName: userName,
        });
    }
}
exports.ActionLogService = ActionLogService;
exports.default = ActionLogService;
//# sourceMappingURL=actionLogService.js.map