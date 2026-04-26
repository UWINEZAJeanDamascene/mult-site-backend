"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const autoAdjustment_1 = require("../services/autoAdjustment");
const server_1 = require("../websocket/server");
const actionLogService_1 = require("../services/actionLogService");
const types_1 = require("../types");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
// Get all site records (scoped by user access)
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { siteId, startDate, endDate, materialName } = req.query;
        const company_id = req.user.company_id;
        let where = { company_id };
        // Site managers can only see their assigned sites' records
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            // Check if site manager has any assigned sites
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.status(200).json([]); // Return empty array if no sites assigned
                return;
            }
            const assignedIds = req.assignedSiteIds
                .filter(id => mongoose_1.default.Types.ObjectId.isValid(id))
                .map(id => new mongoose_1.default.Types.ObjectId(id));
            if (assignedIds.length === 0) {
                res.status(200).json([]);
                return;
            }
            // Further filter if specific site requested
            if (siteId && typeof siteId === 'string' && mongoose_1.default.Types.ObjectId.isValid(siteId)) {
                if (req.assignedSiteIds?.includes(siteId)) {
                    where.site_id = new mongoose_1.default.Types.ObjectId(siteId);
                }
                else {
                    res.status(403).json({ error: 'Access denied to this site' });
                    return;
                }
            }
            else {
                where.site_id = { $in: assignedIds };
            }
        }
        else if (siteId && typeof siteId === 'string' && mongoose_1.default.Types.ObjectId.isValid(siteId)) {
            // Main stock manager can filter by any site
            where.site_id = new mongoose_1.default.Types.ObjectId(siteId);
        }
        // Date range filter
        if (startDate || endDate) {
            where.date = {};
            if (startDate)
                where.date.$gte = new Date(startDate);
            if (endDate)
                where.date.$lte = new Date(endDate);
        }
        // Material name filter
        if (materialName) {
            where.materialName = { $regex: materialName, $options: 'i' };
        }
        const records = await models_1.SiteRecord.find(where)
            .sort({ createdAt: -1 })
            .populate('site_id', 'name location')
            .populate('recordedBy', 'name');
        res.json(records.map(r => ({
            id: r._id.toString(),
            site_id: r.site_id?._id?.toString() || r.site_id?.toString(),
            siteName: r.site_id?.name,
            materialName: r.materialName,
            quantityReceived: r.quantityReceived,
            quantityUsed: r.quantityUsed,
            date: r.date,
            notes: r.notes,
            syncedToMainStock: r.syncedToMainStock,
            mainStockEntryId: r.mainStockEntryId?.toString(),
            recordedBy: r.recordedBy?._id?.toString() || r.recordedBy?.toString() || r.recordedBy,
            recordedByName: r.recordedBy?.name,
            createdAt: r.createdAt,
            updatedAt: r.updatedAt,
        })));
    }
    catch (error) {
        console.error('Get site records error:', error?.message || error);
        res.status(500).json({ error: 'Failed to fetch site records', details: error?.message });
    }
});
// Get my site records (for site managers - returns records from all assigned sites)
router.get('/my', auth_1.authenticateToken, async (req, res) => {
    try {
        const { startDate, endDate, materialName, page = 1, limit = 10, quantityUsed } = req.query;
        const company_id = req.user.company_id;
        let where = { company_id };
        // Site managers can only see their assigned sites' records
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json({ records: [], total: 0, page: 1, totalPages: 0 });
                return;
            }
            const assignedIds = req.assignedSiteIds
                .filter(id => mongoose_1.default.Types.ObjectId.isValid(id))
                .map(id => new mongoose_1.default.Types.ObjectId(id));
            if (assignedIds.length === 0) {
                res.json({ records: [], total: 0, page: 1, totalPages: 0 });
                return;
            }
            where.site_id = { $in: assignedIds };
        }
        // Date range filter
        if (startDate || endDate) {
            where.date = {};
            if (startDate)
                where.date.$gte = new Date(startDate);
            if (endDate)
                where.date.$lte = new Date(endDate);
        }
        // Material name filter
        if (materialName) {
            where.materialName = { $regex: materialName, $options: 'i' };
        }
        // Filter by quantityUsed > 0 if requested
        if (quantityUsed === 'true') {
            where.quantityUsed = { $gt: 0 };
        }
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 10;
        const skip = (pageNum - 1) * limitNum;
        const [records, total] = await Promise.all([
            models_1.SiteRecord.find(where)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .populate('site_id', 'name location')
                .populate('recordedBy', 'name'),
            models_1.SiteRecord.countDocuments(where),
        ]);
        res.json({
            records: records.map(r => ({
                id: r._id.toString(),
                site_id: r.site_id?._id?.toString() || r.site_id?.toString(),
                siteName: r.site_id?.name,
                materialName: r.materialName,
                quantityReceived: r.quantityReceived,
                quantityUsed: r.quantityUsed,
                date: r.date,
                notes: r.notes,
                syncedToMainStock: r.syncedToMainStock,
                mainStockEntryId: r.mainStockEntryId?.toString(),
                recordedBy: r.recordedBy?._id?.toString() || r.recordedBy?.toString() || r.recordedBy,
                recordedByName: r.recordedBy?.name,
                createdAt: r.createdAt,
                updatedAt: r.updatedAt,
            })),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        console.error('Get my site records error:', error?.message || error);
        res.status(500).json({ error: 'Failed to fetch site records', details: error?.message });
    }
});
// Dashboard stats for site managers (must be before /:id route)
router.get('/dashboard-stats', auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        // Get current month boundaries
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
        let siteIds = [];
        // Site managers only see their assigned sites
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json({
                    totalReceivedThisMonth: 0,
                    totalUsedThisMonth: 0,
                    pendingRecords: 0,
                    recentActivity: [],
                });
                return;
            }
            siteIds = req.assignedSiteIds;
        }
        const siteObjectIds = siteIds
            .filter(id => mongoose_1.default.Types.ObjectId.isValid(id))
            .map(id => new mongoose_1.default.Types.ObjectId(id));
        // Get records for this month
        const monthlyRecords = await models_1.SiteRecord.find({
            company_id,
            ...(siteObjectIds.length > 0 && { site_id: { $in: siteObjectIds } }),
            date: { $gte: startOfMonth, $lte: endOfMonth },
        });
        // Calculate stats
        const totalReceivedThisMonth = monthlyRecords.reduce((sum, r) => sum + (r.quantityReceived || 0), 0);
        const totalUsedThisMonth = monthlyRecords.reduce((sum, r) => sum + (r.quantityUsed || 0), 0);
        // Count pending records (not synced to main stock)
        const pendingRecords = await models_1.SiteRecord.countDocuments({
            company_id,
            ...(siteObjectIds.length > 0 && { site_id: { $in: siteObjectIds } }),
            syncedToMainStock: false,
        });
        // Get recent activity (last 5 records)
        const recentActivity = await models_1.SiteRecord.find({
            company_id,
            ...(siteObjectIds.length > 0 && { site_id: { $in: siteObjectIds } }),
        })
            .sort({ createdAt: -1 })
            .limit(5)
            .populate('recordedBy', 'name');
        res.json({
            totalReceivedThisMonth,
            totalUsedThisMonth,
            pendingRecords,
            recentActivity: recentActivity.map(r => ({
                _id: r._id.toString(),
                site_id: r.site_id?.toString(),
                siteName: r.site_id?.name,
                materialName: r.materialName,
                quantityReceived: r.quantityReceived,
                quantityUsed: r.quantityUsed,
                date: r.date,
                notes: r.notes,
                syncedToMainStock: r.syncedToMainStock,
                recordedBy: r.recordedBy?.toString(),
                recordedByName: r.recordedBy?.name,
                createdAt: r.createdAt,
            })),
        });
    }
    catch (error) {
        console.error('Dashboard stats error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});
// Get single site record
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        // Validate ObjectId format
        if (!mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            res.status(400).json({ error: 'Invalid record ID format' });
            return;
        }
        const record = await models_1.SiteRecord.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        }).populate('site_id', 'name location');
        if (!record) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        // Check access for site managers
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            const siteIdStr = record.site_id?._id?.toString() || record.site_id?.toString();
            const hasAccess = req.assignedSiteIds?.includes(siteIdStr);
            if (!hasAccess) {
                res.status(403).json({ error: 'Access denied' });
                return;
            }
        }
        res.json({
            id: record._id.toString(),
            site_id: record.site_id?._id?.toString() || record.site_id?.toString(),
            siteName: record.site_id?.name,
            materialName: record.materialName,
            quantityReceived: record.quantityReceived,
            quantityUsed: record.quantityUsed,
            date: record.date,
            notes: record.notes,
            syncedToMainStock: record.syncedToMainStock,
            mainStockEntryId: record.mainStockEntryId?.toString(),
            createdAt: record.createdAt,
            updatedAt: record.updatedAt,
        });
    }
    catch (error) {
        console.error('Get site record error:', error);
        res.status(500).json({ error: 'Failed to fetch site record' });
    }
});
// Create site record (site managers for their sites only)
router.post('/', auth_1.authenticateToken, (0, auth_1.requireSiteAccess)('siteId'), async (req, res) => {
    try {
        const { materialName, quantityReceived, quantityUsed, date, notes, siteId } = req.body;
        const company_id = req.user.company_id;
        // Validate
        if (!materialName || !siteId || !date) {
            res.status(400).json({
                error: 'Material name, site ID, and date are required',
            });
            return;
        }
        // Ensure at least one quantity is provided
        if ((quantityReceived === undefined || quantityReceived === null) &&
            (quantityUsed === undefined || quantityUsed === null)) {
            res.status(400).json({
                error: 'Either quantity received or quantity used must be provided',
            });
            return;
        }
        // Create the site record
        const record = await models_1.SiteRecord.create({
            site_id: new mongoose_1.default.Types.ObjectId(siteId),
            materialName,
            quantityReceived: quantityReceived || 0,
            quantityUsed: quantityUsed || 0,
            date: new Date(date),
            notes,
            recordedBy: new mongoose_1.default.Types.ObjectId(req.user.id),
            company_id,
            syncedToMainStock: false,
        });
        const recordId = record._id.toString();
        // Auto-sync to main stock
        const mainStockRecord = await (0, autoAdjustment_1.syncSiteRecordToMainStock)(recordId);
        // Log site record creation (pass minimal details)
        await actionLogService_1.ActionLogService.logFromRequest(req, models_1.ActionType.CREATE, models_1.ResourceType.SITE_RECORD, `Recorded material: ${record.materialName}`, {
            resourceId: recordId,
            resourceName: record.materialName,
            details: {
                quantityReceived: record.quantityReceived,
                quantityUsed: record.quantityUsed,
                date: record.date,
                notes: record.notes,
                siteId: record.site_id,
            },
        });
        // Log sync to main stock
        await actionLogService_1.ActionLogService.logSyncToMainStock(req, record._id.toString(), record.materialName, record.quantityReceived);
        // Broadcast update to WebSocket clients
        (0, server_1.broadcastToClients)({
            type: 'SITE_RECORD_CREATED',
            payload: { siteRecord: { ...record.toObject(), id: recordId }, mainStockRecord },
            timestamp: new Date(),
        });
        res.status(201).json({
            id: recordId,
            site_id: siteId,
            materialName: record.materialName,
            quantityReceived: record.quantityReceived,
            quantityUsed: record.quantityUsed,
            date: record.date,
            notes: record.notes,
            syncedToMainStock: true,
            mainStockEntryId: mainStockRecord?._id?.toString(),
            createdAt: record.createdAt,
        });
    }
    catch (error) {
        console.error('Create site record error:', error);
        res.status(500).json({ error: 'Failed to create site record' });
    }
});
// Bulk create site records (site managers for their sites only)
router.post('/bulk', auth_1.authenticateToken, async (req, res) => {
    try {
        const records = req.body;
        const company_id = req.user.company_id;
        // Validate records array
        if (!Array.isArray(records) || records.length === 0) {
            res.status(400).json({ error: 'At least one record is required' });
            return;
        }
        // Validate each record
        for (const record of records) {
            if (!record.materialName || !record.siteId || !record.date) {
                res.status(400).json({
                    error: 'Each record must have materialName, siteId, and date',
                });
                return;
            }
        }
        // Check site access for site managers
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            const allowedSiteIds = req.assignedSiteIds || [];
            for (const record of records) {
                if (!allowedSiteIds.includes(record.siteId)) {
                    res.status(403).json({
                        error: `Access denied to site: ${record.siteId}`,
                    });
                    return;
                }
            }
        }
        // Create all records
        const createdRecords = [];
        for (const recordData of records) {
            const record = await models_1.SiteRecord.create({
                site_id: new mongoose_1.default.Types.ObjectId(recordData.siteId),
                materialName: recordData.materialName,
                quantityReceived: recordData.quantityReceived || 0,
                quantityUsed: recordData.quantityUsed || 0,
                date: new Date(recordData.date),
                notes: recordData.notes,
                recordedBy: new mongoose_1.default.Types.ObjectId(req.user.id),
                company_id,
                syncedToMainStock: false,
            });
            const recordId = record._id.toString();
            // Auto-sync to main stock
            const mainStockRecord = await (0, autoAdjustment_1.syncSiteRecordToMainStock)(recordId);
            // Log site record creation
            await actionLogService_1.ActionLogService.logFromRequest(req, models_1.ActionType.CREATE, models_1.ResourceType.SITE_RECORD, `Recorded material: ${record.materialName}`, {
                resourceId: recordId,
                resourceName: record.materialName,
                details: {
                    quantityReceived: record.quantityReceived,
                    quantityUsed: record.quantityUsed,
                    date: record.date,
                    notes: record.notes,
                    siteId: record.site_id,
                },
            });
            // Log sync to main stock
            await actionLogService_1.ActionLogService.logSyncToMainStock(req, record._id.toString(), record.materialName, record.quantityReceived);
            createdRecords.push({
                id: recordId,
                site_id: recordData.siteId,
                materialName: record.materialName,
                quantityReceived: record.quantityReceived,
                quantityUsed: record.quantityUsed,
                date: record.date,
                notes: record.notes,
                syncedToMainStock: true,
                mainStockEntryId: mainStockRecord?._id?.toString(),
                createdAt: record.createdAt,
            });
        }
        // Broadcast bulk update to WebSocket clients
        (0, server_1.broadcastToClients)({
            type: 'SITE_RECORDS_BULK_CREATED',
            payload: { count: createdRecords.length, records: createdRecords },
            timestamp: new Date(),
        });
        res.status(201).json({
            message: `${createdRecords.length} records created successfully`,
            records: createdRecords,
        });
    }
    catch (error) {
        console.error('Bulk create site records error:', error);
        res.status(500).json({ error: 'Failed to create records' });
    }
});
// Update site record
router.put('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { materialName, quantityReceived, quantityUsed, date, notes } = req.body;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        // Validate ObjectId format
        if (!mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            res.status(400).json({ error: 'Invalid record ID format' });
            return;
        }
        // Get existing record
        const existingRecord = await models_1.SiteRecord.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        });
        if (!existingRecord) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        // Check permissions
        const hasEditPermission = [types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role);
        const isOwner = existingRecord.recordedBy.toString() === req.user.id;
        const siteIdStr = existingRecord.site_id.toString();
        const hasSiteAccess = req.assignedSiteIds?.includes(siteIdStr);
        if (!hasEditPermission && !isOwner && !hasSiteAccess) {
            res.status(403).json({ error: 'Can only update your own records' });
            return;
        }
        // Check if price has been added by main stock manager
        const mainStockRecord = await models_1.MainStockRecord.findById(existingRecord.mainStockEntryId);
        const hasPrice = mainStockRecord && mainStockRecord.price != null;
        // Update the site record
        const updateData = {};
        if (materialName)
            updateData.materialName = materialName;
        if (quantityReceived !== undefined)
            updateData.quantityReceived = quantityReceived;
        if (quantityUsed !== undefined)
            updateData.quantityUsed = quantityUsed;
        if (date)
            updateData.date = new Date(date);
        if (notes !== undefined)
            updateData.notes = notes;
        const updatedRecord = await models_1.SiteRecord.findByIdAndUpdate(id, { $set: updateData }, { returnDocument: 'after' });
        if (!updatedRecord) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        // Re-sync to main stock
        const mainStock = await (0, autoAdjustment_1.syncSiteRecordToMainStock)(idStr);
        // Log site record update
        await actionLogService_1.ActionLogService.logFromRequest(req, models_1.ActionType.UPDATE, models_1.ResourceType.SITE_RECORD, `Updated site record: ${updatedRecord.materialName}`, {
            resourceId: updatedRecord._id.toString(),
            resourceName: updatedRecord.materialName,
            details: updateData,
        });
        // Log sync to main stock
        await actionLogService_1.ActionLogService.logSyncToMainStock(req, updatedRecord._id.toString(), updatedRecord.materialName, updatedRecord.quantityReceived);
        // Broadcast update
        (0, server_1.broadcastToClients)({
            type: 'SITE_RECORD_UPDATED',
            payload: { siteRecord: { ...updatedRecord.toObject(), id }, mainStockRecord: mainStock },
            timestamp: new Date(),
        });
        res.json({
            id,
            site_id: updatedRecord.site_id.toString(),
            materialName: updatedRecord.materialName,
            quantityReceived: updatedRecord.quantityReceived,
            quantityUsed: updatedRecord.quantityUsed,
            date: updatedRecord.date,
            notes: updatedRecord.notes,
            syncedToMainStock: updatedRecord.syncedToMainStock,
            mainStockEntryId: updatedRecord.mainStockEntryId?.toString(),
            priceAdded: hasPrice,
            createdAt: updatedRecord.createdAt,
            updatedAt: updatedRecord.updatedAt,
        });
    }
    catch (error) {
        console.error('Update site record error:', error);
        res.status(500).json({ error: 'Failed to update site record' });
    }
});
// Get site inventory - aggregated view of materials available at sites (from PO receipts)
router.get('/inventory/my', auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        // Site managers only see their assigned sites
        let siteIds = [];
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json({ inventory: [] });
                return;
            }
            siteIds = req.assignedSiteIds;
        }
        const siteObjectIds = siteIds
            .filter(id => mongoose_1.default.Types.ObjectId.isValid(id))
            .map(id => new mongoose_1.default.Types.ObjectId(id));
        // Aggregate pipeline to get inventory by material and site
        const pipeline = [
            {
                $match: {
                    company_id,
                    ...(siteObjectIds.length > 0 && { site_id: { $in: siteObjectIds } }),
                },
            },
            {
                $group: {
                    _id: { materialName: '$materialName', site_id: '$site_id' },
                    totalReceived: { $sum: '$quantityReceived' },
                    totalUsed: { $sum: '$quantityUsed' },
                    records: { $push: '$$ROOT' },
                },
            },
            {
                $project: {
                    _id: 0,
                    materialName: '$_id.materialName',
                    site_id: '$_id.site_id',
                    totalReceived: 1,
                    totalUsed: 1,
                    remainingQuantity: { $subtract: ['$totalReceived', '$totalUsed'] },
                    lastReceivedDate: { $max: '$records.date' },
                },
            },
            {
                $match: {
                    remainingQuantity: { $gt: 0 }, // Only show materials with remaining quantity
                },
            },
            {
                $sort: { materialName: 1 },
            },
        ];
        const inventory = await models_1.SiteRecord.aggregate(pipeline);
        // Populate site names
        const siteIdsFromInventory = inventory.map(item => item.site_id.toString());
        const sites = await models_1.Site.find({ _id: { $in: siteIdsFromInventory.map((id) => new mongoose_1.default.Types.ObjectId(id)) } });
        const siteMap = new Map(sites.map((s) => [s._id.toString(), s.name]));
        res.json({
            inventory: inventory.map(item => ({
                materialName: item.materialName,
                siteId: item.site_id.toString(),
                siteName: siteMap.get(item.site_id.toString()) || 'Unknown Site',
                totalReceived: item.totalReceived,
                totalUsed: item.totalUsed,
                remainingQuantity: item.remainingQuantity,
                lastReceivedDate: item.lastReceivedDate,
            })),
        });
    }
    catch (error) {
        console.error('Get site inventory error:', error);
        res.status(500).json({ error: 'Failed to fetch site inventory' });
    }
});
// Record usage against available materials at site
router.post('/usage', auth_1.authenticateToken, (0, auth_1.requireSiteAccess)('siteId'), async (req, res) => {
    try {
        const { siteId, materialName, quantityUsed, date, notes } = req.body;
        const company_id = req.user.company_id;
        // Validate
        if (!siteId || !materialName || !quantityUsed || !date) {
            res.status(400).json({
                error: 'Site ID, material name, quantity used, and date are required',
            });
            return;
        }
        if (quantityUsed <= 0) {
            res.status(400).json({ error: 'Quantity used must be greater than 0' });
            return;
        }
        // Check available quantity
        const availableRecords = await models_1.SiteRecord.find({
            site_id: new mongoose_1.default.Types.ObjectId(siteId),
            materialName,
            company_id,
        });
        const totalReceived = availableRecords.reduce((sum, r) => sum + (r.quantityReceived || 0), 0);
        const totalUsed = availableRecords.reduce((sum, r) => sum + (r.quantityUsed || 0), 0);
        const availableQty = totalReceived - totalUsed;
        if (quantityUsed > availableQty) {
            res.status(400).json({
                error: `Cannot use more than available quantity. Available: ${availableQty}, Requested: ${quantityUsed}`,
            });
            return;
        }
        // Create usage record (SiteRecord with quantityUsed only)
        const record = await models_1.SiteRecord.create({
            site_id: new mongoose_1.default.Types.ObjectId(siteId),
            materialName,
            quantityReceived: 0,
            quantityUsed,
            date: new Date(date),
            notes: notes || `Usage recorded for ${materialName}`,
            recordedBy: new mongoose_1.default.Types.ObjectId(req.user.id),
            company_id,
            syncedToMainStock: false,
        });
        // Log action
        await actionLogService_1.ActionLogService.logFromRequest(req, models_1.ActionType.CREATE, models_1.ResourceType.SITE_RECORD, `Recorded usage: ${materialName} - ${quantityUsed} units`, {
            resourceId: record._id.toString(),
            resourceName: materialName,
            details: {
                quantityUsed,
                date: record.date,
                notes: record.notes,
                siteId,
            },
        });
        // Broadcast update
        (0, server_1.broadcastToClients)({
            type: 'SITE_RECORD_CREATED',
            payload: { siteRecord: { ...record.toObject(), id: record._id.toString() }, isUsageRecord: true },
            timestamp: new Date(),
        });
        res.status(201).json({
            id: record._id.toString(),
            site_id: siteId,
            materialName: record.materialName,
            quantityUsed: record.quantityUsed,
            date: record.date,
            notes: record.notes,
            availableQuantity: availableQty - quantityUsed,
            createdAt: record.createdAt,
        });
    }
    catch (error) {
        console.error('Record usage error:', error);
        res.status(500).json({ error: 'Failed to record usage' });
    }
});
// Delete site record
router.delete('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        // Validate ObjectId format
        if (!mongoose_1.default.Types.ObjectId.isValid(idStr)) {
            res.status(400).json({ error: 'Invalid record ID format' });
            return;
        }
        const record = await models_1.SiteRecord.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        });
        if (!record) {
            res.status(404).json({ error: 'Record not found' });
            return;
        }
        // Check permissions
        const hasEditPermission = [types_1.UserRole.MAIN_MANAGER, types_1.UserRole.ACCOUNTANT, types_1.UserRole.MANAGER].includes(req.user.role);
        const isOwner = record.recordedBy.toString() === req.user.id;
        const siteIdStr = record.site_id.toString();
        const hasSiteAccess = req.assignedSiteIds?.includes(siteIdStr);
        if (!hasEditPermission && !isOwner && !hasSiteAccess) {
            res.status(403).json({ error: 'Can only delete your own records' });
            return;
        }
        // Log deletion of linked main stock record if exists
        if (record.mainStockEntryId) {
            await actionLogService_1.ActionLogService.logFromRequest(req, models_1.ActionType.DELETE, models_1.ResourceType.MAIN_STOCK, `Deleted main stock record (cascade from site record): ${record.materialName}`, {
                resourceId: record.mainStockEntryId.toString(),
                resourceName: record.materialName,
            });
            await models_1.MainStockRecord.findByIdAndDelete(record.mainStockEntryId);
        }
        // Log site record deletion
        await actionLogService_1.ActionLogService.logFromRequest(req, models_1.ActionType.DELETE, models_1.ResourceType.SITE_RECORD, `Deleted site record: ${record.materialName}`, {
            resourceId: record._id.toString(),
            resourceName: record.materialName,
        });
        // Delete site record
        await models_1.SiteRecord.findByIdAndDelete(id);
        // Broadcast update
        (0, server_1.broadcastToClients)({
            type: 'MAIN_STOCK_UPDATED',
            payload: { deletedSiteRecordId: id },
            timestamp: new Date(),
        });
        res.json({ message: 'Record deleted successfully' });
    }
    catch (error) {
        console.error('Delete site record error:', error);
        res.status(500).json({ error: 'Failed to delete site record' });
    }
});
exports.default = router;
//# sourceMappingURL=siteRecords.js.map