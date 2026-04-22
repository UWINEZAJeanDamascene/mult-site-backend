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
Object.defineProperty(exports, "__esModule", { value: true });
exports.authenticateToken = authenticateToken;
exports.requirePermission = requirePermission;
exports.requireRole = requireRole;
exports.requireMainStockManager = requireMainStockManager;
exports.requireSiteAccess = requireSiteAccess;
exports.requireSiteRecordOwnership = requireSiteRecordOwnership;
const auth_1 = require("../utils/auth");
const models_1 = require("../models");
const types_1 = require("../types");
async function authenticateToken(req, res, next) {
    try {
        const authHeader = req.headers['authorization'];
        // Support token from Authorization header or httpOnly cookie named access_token
        const tokenFromHeader = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
        const token = tokenFromHeader || (req.cookies && req.cookies.access_token);
        if (!token) {
            res.status(401).json({ error: 'Access token required' });
            return;
        }
        const decoded = (0, auth_1.verifyToken)(token);
        // Support both 'id' and 'userId' in token for backwards compatibility
        const userId = decoded.userId || decoded.id;
        // Verify user still exists and is active
        const user = await models_1.User.findById(userId).select('-password');
        if (!user || !user.isActive) {
            res.status(401).json({ error: 'User not found or inactive' });
            return;
        }
        // For site managers, get their assigned sites
        let assignedSiteIds = [];
        if (user.role === types_1.UserRole.SITE_MANAGER && user.assignedSites) {
            assignedSiteIds = user.assignedSites.map((id) => id.toString());
        }
        req.user = {
            id: user._id.toString(),
            email: user.email,
            name: user.name,
            role: user.role, // Cast to UserType's UserRole
            company_id: user.company_id,
            isActive: user.isActive,
        };
        req.assignedSiteIds = assignedSiteIds;
        next();
    }
    catch (error) {
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
    }
}
function requirePermission(action, resource) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!(0, auth_1.hasPermission)(req.user.role, action, resource)) {
            res.status(403).json({ error: 'Permission denied' });
            return;
        }
        next();
    };
}
function requireRole(allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        if (!allowedRoles.includes(req.user.role)) {
            res.status(403).json({ error: 'Insufficient permissions' });
            return;
        }
        next();
    };
}
function requireMainStockManager(req, res, next) {
    if (!req.user) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    const { method } = req;
    const isRead = ['GET', 'HEAD'].includes(method);
    const canAccess = [types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role);
    if (!canAccess) {
        res.status(403).json({ error: 'Access denied' });
        return;
    }
    next();
}
function requireSiteAccess(siteIdParam = 'siteId') {
    return async (req, res, next) => {
        if (!req.user || !req.assignedSiteIds) {
            res.status(401).json({ error: 'Authentication required' });
            return;
        }
        // Management roles can access all sites
        if ([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role)) {
            next();
            return;
        }
        const siteId = req.params[siteIdParam] || req.body.siteId || req.query.siteId;
        if (!siteId) {
            res.status(400).json({ error: 'Site ID required' });
            return;
        }
        if (!(0, auth_1.canAccessSite)(req.user, siteId, req.assignedSiteIds)) {
            res.status(403).json({ error: 'Access denied to this site' });
            return;
        }
        next();
    };
}
async function requireSiteRecordOwnership(req, res, next) {
    if (!req.user || !req.assignedSiteIds) {
        res.status(401).json({ error: 'Authentication required' });
        return;
    }
    // Management roles can modify any record
    if ([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role)) {
        next();
        return;
    }
    const recordId = req.params.id;
    if (!recordId) {
        res.status(400).json({ error: 'Record ID required' });
        return;
    }
    // Import SiteRecord model dynamically to avoid circular dependency
    const { SiteRecord } = await Promise.resolve().then(() => __importStar(require('../models/SiteRecord')));
    const record = await SiteRecord.findById(recordId).select('recordedBy site_id');
    if (!record) {
        res.status(404).json({ error: 'Record not found' });
        return;
    }
    // Site manager can only modify their own records on their assigned sites
    const recordedById = record.recordedBy?.toString();
    const siteId = record.site_id?.toString();
    if (recordedById !== req.user.id ||
        !req.assignedSiteIds.includes(siteId || '')) {
        res.status(403).json({ error: 'Can only modify your own records' });
        return;
    }
    next();
}
//# sourceMappingURL=auth.js.map