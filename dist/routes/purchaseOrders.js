"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const models_1 = require("../models");
const auth_1 = require("../middleware/auth");
const actionLogService_1 = require("../services/actionLogService");
const ActionLog_1 = require("../models/ActionLog");
const mongoose_1 = __importDefault(require("mongoose"));
const types_1 = require("../types");
const router = (0, express_1.Router)();
// Generate unique PO number
async function generatePONumber(company_id) {
    const year = new Date().getFullYear();
    const prefix = `PO-${year}-`;
    // Find the last PO number for this company
    const lastPO = await models_1.PurchaseOrder.findOne({ company_id, poNumber: { $regex: `^${prefix}` } }, { poNumber: 1 }).sort({ poNumber: -1 });
    let sequence = 1;
    if (lastPO) {
        const lastNumber = parseInt(lastPO.poNumber.split('-')[2], 10);
        if (!isNaN(lastNumber)) {
            sequence = lastNumber + 1;
        }
    }
    return `${prefix}${sequence.toString().padStart(4, '0')}`;
}
// Calculate totals from items
function calculateTotals(items) {
    const subTotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
    const taxRate = 0; // Default tax rate, can be customized
    const taxAmount = subTotal * (taxRate / 100);
    const totalAmount = subTotal + taxAmount;
    return { subTotal, taxRate, taxAmount, totalAmount };
}
// Get all purchase orders
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const { status, siteId, supplier, startDate, endDate, page = '1', limit = '20' } = req.query;
        let where = { company_id };
        // Site managers only see POs for their assigned sites
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json({ records: [], total: 0, page: 1, totalPages: 0 });
                return;
            }
            const assignedIds = req.assignedSiteIds
                .filter(id => mongoose_1.default.Types.ObjectId.isValid(id))
                .map(id => new mongoose_1.default.Types.ObjectId(id));
            where.site_id = { $in: assignedIds };
        }
        if (status && status !== 'all')
            where.status = status;
        if (siteId && mongoose_1.default.Types.ObjectId.isValid(siteId)) {
            where.site_id = new mongoose_1.default.Types.ObjectId(siteId);
        }
        if (supplier) {
            where['supplier.name'] = { $regex: supplier, $options: 'i' };
        }
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.$gte = new Date(startDate);
            if (endDate)
                where.createdAt.$lte = new Date(endDate);
        }
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;
        const skip = (pageNum - 1) * limitNum;
        const [records, total] = await Promise.all([
            models_1.PurchaseOrder.find(where)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limitNum)
                .populate('site_id', 'name location')
                .populate('createdBy', 'name'),
            models_1.PurchaseOrder.countDocuments(where),
        ]);
        res.json({
            records: records.map((po) => ({
                id: po._id.toString(),
                poNumber: po.poNumber,
                supplier: po.supplier,
                site: po.site_id,
                status: po.status,
                items: po.items,
                subTotal: po.subTotal,
                taxRate: po.taxRate,
                taxAmount: po.taxAmount,
                totalAmount: po.totalAmount,
                notes: po.notes,
                terms: po.terms,
                sentDate: po.sentDate,
                expectedDeliveryDate: po.expectedDeliveryDate,
                createdBy: po.createdBy?.name || po.createdBy,
                createdAt: po.createdAt,
                updatedAt: po.updatedAt,
            })),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        console.error('Get purchase orders error:', error);
        res.status(500).json({ error: 'Failed to fetch purchase orders' });
    }
});
// Get single purchase order
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await models_1.PurchaseOrder.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        })
            .populate('site_id', 'name location')
            .populate('createdBy', 'name');
        if (!po) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Check site access for site managers
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            const siteIdStr = po.site_id._id?.toString() || po.site_id.toString();
            if (!req.assignedSiteIds?.includes(siteIdStr)) {
                res.status(403).json({ error: 'Access denied to this purchase order' });
                return;
            }
        }
        res.json({
            id: po._id.toString(),
            poNumber: po.poNumber,
            supplier: po.supplier,
            site: po.site_id,
            status: po.status,
            items: po.items,
            subTotal: po.subTotal,
            taxRate: po.taxRate,
            taxAmount: po.taxAmount,
            totalAmount: po.totalAmount,
            notes: po.notes,
            terms: po.terms,
            sentDate: po.sentDate,
            expectedDeliveryDate: po.expectedDeliveryDate,
            createdBy: po.createdBy?.name || po.createdBy,
            createdAt: po.createdAt,
            updatedAt: po.updatedAt,
        });
    }
    catch (error) {
        console.error('Get purchase order error:', error);
        res.status(500).json({ error: 'Failed to fetch purchase order' });
    }
});
// Create purchase order
router.post('/', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const { supplier, site_id, items, taxRate = 0, notes, terms, expectedDeliveryDate, } = req.body;
        // Validate required fields
        if (!supplier?.name || !site_id || !items || items.length === 0) {
            res.status(400).json({ error: 'Supplier name, site, and items are required' });
            return;
        }
        // Validate site belongs to company
        const site = await models_1.Site.findOne({ _id: new mongoose_1.default.Types.ObjectId(site_id), company_id });
        if (!site) {
            res.status(404).json({ error: 'Site not found' });
            return;
        }
        // Process items and calculate totals
        const processedItems = items.map((item) => ({
            materialName: item.materialName,
            material_id: item.material_id || null,
            description: item.description || '',
            quantityOrdered: item.quantityOrdered || 0,
            quantityReceived: 0,
            unitPrice: item.unitPrice || 0,
            totalPrice: (item.quantityOrdered || 0) * (item.unitPrice || 0),
            unit: item.unit || 'pcs',
            notes: item.notes || '',
        }));
        const totals = calculateTotals(processedItems);
        // Generate PO number
        const poNumber = await generatePONumber(company_id);
        const po = await models_1.PurchaseOrder.create({
            poNumber,
            supplier,
            site_id: new mongoose_1.default.Types.ObjectId(site_id),
            status: 'draft',
            items: processedItems,
            ...totals,
            taxRate,
            notes,
            terms,
            expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined,
            createdBy: new mongoose_1.default.Types.ObjectId(req.user.id),
            company_id,
        });
        // Log action
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.CREATE, ActionLog_1.ResourceType.PURCHASE_ORDER, `Created purchase order ${poNumber} for ${supplier.name}`, { resourceId: po._id.toString(), resourceName: poNumber });
        res.status(201).json({
            id: po._id.toString(),
            poNumber: po.poNumber,
            supplier: po.supplier,
            site_id: po.site_id,
            status: po.status,
            items: po.items,
            totalAmount: po.totalAmount,
            message: 'Purchase order created successfully',
        });
    }
    catch (error) {
        console.error('Create purchase order error:', error);
        res.status(500).json({ error: 'Failed to create purchase order' });
    }
});
// Update purchase order (only draft status)
router.put('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await models_1.PurchaseOrder.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        });
        if (!po) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Only draft POs can be edited
        if (po.status !== 'draft') {
            res.status(400).json({ error: 'Only draft purchase orders can be edited' });
            return;
        }
        const { supplier, site_id, items, taxRate, notes, terms, expectedDeliveryDate } = req.body;
        // Update fields if provided
        if (supplier)
            po.supplier = { ...po.supplier, ...supplier };
        if (site_id)
            po.site_id = new mongoose_1.default.Types.ObjectId(site_id);
        if (items && items.length > 0) {
            po.items = items.map((item) => ({
                materialName: item.materialName,
                material_id: item.material_id || null,
                description: item.description || '',
                quantityOrdered: item.quantityOrdered || 0,
                quantityReceived: item.quantityReceived || 0,
                unitPrice: item.unitPrice || 0,
                totalPrice: (item.quantityOrdered || 0) * (item.unitPrice || 0),
                unit: item.unit || 'pcs',
                notes: item.notes || '',
            }));
            const totals = calculateTotals(po.items);
            po.subTotal = totals.subTotal;
            po.taxAmount = totals.taxAmount;
            po.totalAmount = totals.totalAmount;
        }
        if (taxRate !== undefined)
            po.taxRate = taxRate;
        if (notes !== undefined)
            po.notes = notes;
        if (terms !== undefined)
            po.terms = terms;
        if (expectedDeliveryDate !== undefined) {
            po.expectedDeliveryDate = expectedDeliveryDate ? new Date(expectedDeliveryDate) : undefined;
        }
        await po.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.PURCHASE_ORDER, `Updated purchase order ${po.poNumber}`, { resourceId: po._id.toString(), resourceName: po.poNumber });
        res.json({
            id: po._id.toString(),
            poNumber: po.poNumber,
            message: 'Purchase order updated successfully',
        });
    }
    catch (error) {
        console.error('Update purchase order error:', error);
        res.status(500).json({ error: 'Failed to update purchase order' });
    }
});
// Delete purchase order (only draft status)
router.delete('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await models_1.PurchaseOrder.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        });
        if (!po) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Only draft POs can be deleted
        if (po.status !== 'draft') {
            res.status(400).json({ error: 'Only draft purchase orders can be deleted' });
            return;
        }
        await models_1.PurchaseOrder.deleteOne({ _id: new mongoose_1.default.Types.ObjectId(idStr) });
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.DELETE, ActionLog_1.ResourceType.PURCHASE_ORDER, `Deleted purchase order ${po.poNumber}`, { resourceId: idStr, resourceName: po.poNumber });
        res.json({ message: 'Purchase order deleted successfully' });
    }
    catch (error) {
        console.error('Delete purchase order error:', error);
        res.status(500).json({ error: 'Failed to delete purchase order' });
    }
});
// Send PO to supplier (mark as sent)
router.patch('/:id/send', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await models_1.PurchaseOrder.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        });
        if (!po) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Can only send draft POs
        if (po.status !== 'draft') {
            res.status(400).json({ error: 'Only draft purchase orders can be sent' });
            return;
        }
        po.status = 'sent';
        po.sentDate = new Date();
        await po.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.PURCHASE_ORDER, `Sent purchase order ${po.poNumber} to ${po.supplier.name}`, { resourceId: po._id.toString(), resourceName: po.poNumber });
        res.json({
            id: po._id.toString(),
            poNumber: po.poNumber,
            status: po.status,
            sentDate: po.sentDate,
            message: 'Purchase order sent successfully',
        });
    }
    catch (error) {
        console.error('Send purchase order error:', error);
        res.status(500).json({ error: 'Failed to send purchase order' });
    }
});
// Receive items from PO (creates site records)
router.patch('/:id/receive', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const { receivedItems, date, notes } = req.body;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await models_1.PurchaseOrder.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        });
        if (!po) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Check site access for site managers
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            const siteIdStr = po.site_id.toString();
            if (!req.assignedSiteIds?.includes(siteIdStr)) {
                res.status(403).json({ error: 'Access denied to this purchase order' });
                return;
            }
        }
        // Can receive from sent or partial POs
        if (!['sent', 'partial'].includes(po.status)) {
            res.status(400).json({ error: 'Can only receive items from sent or partially received POs' });
            return;
        }
        // Process received items
        const siteRecords = [];
        let allItemsFullyReceived = true;
        for (const received of receivedItems) {
            const itemIndex = po.items.findIndex((item) => item._id?.toString() === received.itemId);
            if (itemIndex === -1)
                continue;
            const item = po.items[itemIndex];
            const receiveQty = received.quantity;
            // Update received quantity
            item.quantityReceived += receiveQty;
            if (item.quantityReceived < item.quantityOrdered) {
                allItemsFullyReceived = false;
            }
            // Create site record for this receipt
            const siteRecord = await models_1.SiteRecord.create({
                site_id: po.site_id,
                materialName: item.materialName,
                material_id: item.material_id,
                quantityReceived: receiveQty,
                quantityUsed: 0,
                date: date ? new Date(date) : new Date(),
                notes: notes || `Received from PO ${po.poNumber}`,
                recordedBy: new mongoose_1.default.Types.ObjectId(req.user.id),
                company_id,
                syncedToMainStock: false,
            });
            siteRecords.push(siteRecord);
        }
        // Update PO status
        po.status = allItemsFullyReceived ? 'received' : 'partial';
        await po.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.PURCHASE_ORDER, `Received items from purchase order ${po.poNumber}`, {
            resourceId: po._id.toString(),
            resourceName: po.poNumber,
            details: { receivedItems: receivedItems.length, siteRecords: siteRecords.length },
        });
        res.json({
            id: po._id.toString(),
            poNumber: po.poNumber,
            status: po.status,
            siteRecords: siteRecords.map((sr) => sr._id.toString()),
            message: 'Items received successfully',
        });
    }
    catch (error) {
        console.error('Receive items error:', error);
        res.status(500).json({ error: 'Failed to receive items' });
    }
});
// Mark PO as completed
router.patch('/:id/complete', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await models_1.PurchaseOrder.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        });
        if (!po) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Can only complete received or partial POs
        if (!['received', 'partial'].includes(po.status)) {
            res.status(400).json({ error: 'Can only complete received or partially received POs' });
            return;
        }
        po.status = 'completed';
        await po.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.PURCHASE_ORDER, `Completed purchase order ${po.poNumber}`, { resourceId: po._id.toString(), resourceName: po.poNumber });
        res.json({
            id: po._id.toString(),
            poNumber: po.poNumber,
            status: po.status,
            message: 'Purchase order marked as completed',
        });
    }
    catch (error) {
        console.error('Complete purchase order error:', error);
        res.status(500).json({ error: 'Failed to complete purchase order' });
    }
});
// Cancel PO
router.patch('/:id/cancel', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await models_1.PurchaseOrder.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        });
        if (!po) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Cannot cancel completed POs
        if (po.status === 'completed') {
            res.status(400).json({ error: 'Cannot cancel completed purchase orders' });
            return;
        }
        po.status = 'cancelled';
        await po.save();
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.UPDATE, ActionLog_1.ResourceType.PURCHASE_ORDER, `Cancelled purchase order ${po.poNumber}`, { resourceId: po._id.toString(), resourceName: po.poNumber });
        res.json({
            id: po._id.toString(),
            poNumber: po.poNumber,
            status: po.status,
            message: 'Purchase order cancelled successfully',
        });
    }
    catch (error) {
        console.error('Cancel purchase order error:', error);
        res.status(500).json({ error: 'Failed to cancel purchase order' });
    }
});
// Duplicate PO
router.post('/:id/duplicate', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const originalPO = await models_1.PurchaseOrder.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        });
        if (!originalPO) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Generate new PO number
        const poNumber = await generatePONumber(company_id);
        // Create new PO with same data
        const newPO = await models_1.PurchaseOrder.create({
            poNumber,
            supplier: originalPO.supplier,
            site_id: originalPO.site_id,
            status: 'draft',
            items: originalPO.items.map(item => ({
                materialName: item.materialName,
                material_id: item.material_id,
                description: item.description,
                quantityOrdered: item.quantityOrdered,
                quantityReceived: 0,
                unitPrice: item.unitPrice,
                totalPrice: item.totalPrice,
                unit: item.unit,
                notes: item.notes,
            })),
            subTotal: originalPO.subTotal,
            taxRate: originalPO.taxRate,
            taxAmount: originalPO.taxAmount,
            totalAmount: originalPO.totalAmount,
            notes: `Duplicated from ${originalPO.poNumber}. ${originalPO.notes || ''}`,
            terms: originalPO.terms,
            expectedDeliveryDate: originalPO.expectedDeliveryDate,
            createdBy: new mongoose_1.default.Types.ObjectId(req.user.id),
            company_id,
        });
        await actionLogService_1.ActionLogService.logFromRequest(req, ActionLog_1.ActionType.CREATE, ActionLog_1.ResourceType.PURCHASE_ORDER, `Duplicated purchase order ${originalPO.poNumber} to ${poNumber}`, { resourceId: newPO._id.toString(), resourceName: poNumber });
        res.status(201).json({
            id: newPO._id.toString(),
            poNumber: newPO.poNumber,
            message: `Purchase order duplicated successfully as ${poNumber}`,
        });
    }
    catch (error) {
        console.error('Duplicate purchase order error:', error);
        res.status(500).json({ error: 'Failed to duplicate purchase order' });
    }
});
// Export POs to Excel
router.get('/export/excel', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const { status, startDate, endDate } = req.query;
        let where = { company_id };
        if (status && status !== 'all')
            where.status = status;
        if (startDate || endDate) {
            where.createdAt = {};
            if (startDate)
                where.createdAt.$gte = new Date(startDate);
            if (endDate)
                where.createdAt.$lte = new Date(endDate);
        }
        const pos = await models_1.PurchaseOrder.find(where)
            .sort({ createdAt: -1 })
            .populate('site_id', 'name')
            .lean();
        // Format data for Excel
        const data = pos.map((po) => ({
            'PO Number': po.poNumber,
            'Status': po.status,
            'Supplier': po.supplier.name,
            'Contact': po.supplier.contactPerson,
            'Email': po.supplier.email,
            'Phone': po.supplier.phone,
            'Site': po.site_id?.name || '',
            'Items Count': po.items.length,
            'Subtotal': po.subTotal,
            'Tax Rate (%)': po.taxRate,
            'Tax Amount': po.taxAmount,
            'Total': po.totalAmount,
            'Notes': po.notes,
            'Sent Date': po.sentDate ? new Date(po.sentDate).toLocaleDateString() : '',
            'Expected Delivery': po.expectedDeliveryDate ? new Date(po.expectedDeliveryDate).toLocaleDateString() : '',
            'Created': new Date(po.createdAt).toLocaleDateString(),
        }));
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Content-Disposition', 'attachment; filename=purchase-orders.json');
        res.json({
            filename: `purchase-orders-${new Date().toISOString().split('T')[0]}.json`,
            data,
        });
    }
    catch (error) {
        console.error('Export POs error:', error);
        res.status(500).json({ error: 'Failed to export purchase orders' });
    }
});
// Get PO statistics
router.get('/stats/overview', auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        // Site filter for site managers
        let siteFilter = {};
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json({
                    total: 0,
                    byStatus: {},
                    totalValue: 0,
                    pendingValue: 0,
                });
                return;
            }
            const assignedIds = req.assignedSiteIds
                .filter(id => mongoose_1.default.Types.ObjectId.isValid(id))
                .map(id => new mongoose_1.default.Types.ObjectId(id));
            siteFilter = { site_id: { $in: assignedIds } };
        }
        const stats = await models_1.PurchaseOrder.aggregate([
            { $match: { company_id, ...siteFilter } },
            {
                $group: {
                    _id: null,
                    total: { $sum: 1 },
                    byStatus: {
                        $push: {
                            status: '$status',
                            count: { $sum: 1 },
                            value: '$totalAmount',
                        },
                    },
                    totalValue: { $sum: '$totalAmount' },
                },
            },
        ]);
        // Count by status
        const byStatus = {};
        const statusCounts = await models_1.PurchaseOrder.aggregate([
            { $match: { company_id, ...siteFilter } },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    value: { $sum: '$totalAmount' },
                },
            },
        ]);
        statusCounts.forEach((stat) => {
            byStatus[stat._id] = { count: stat.count, value: stat.value };
        });
        // Pending value (sent + partial)
        const pendingValue = (byStatus.sent?.value || 0) + (byStatus.partial?.value || 0);
        res.json({
            total: stats[0]?.total || 0,
            byStatus,
            totalValue: stats[0]?.totalValue || 0,
            pendingValue,
        });
    }
    catch (error) {
        console.error('Get PO stats error:', error);
        res.status(500).json({ error: 'Failed to fetch PO statistics' });
    }
});
// PO Aging Report
router.get('/reports/aging', auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        // Site filter for site managers
        let siteFilter = {};
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json({ overdue: [], approaching: [] });
                return;
            }
            const assignedIds = req.assignedSiteIds
                .filter(id => mongoose_1.default.Types.ObjectId.isValid(id))
                .map(id => new mongoose_1.default.Types.ObjectId(id));
            siteFilter = { site_id: { $in: assignedIds } };
        }
        const now = new Date();
        const threeDaysFromNow = new Date(now);
        threeDaysFromNow.setDate(now.getDate() + 3);
        // Overdue POs (expected delivery passed, not received/completed)
        const overdue = await models_1.PurchaseOrder.find({
            company_id,
            ...siteFilter,
            expectedDeliveryDate: { $lt: now },
            status: { $in: ['sent', 'partial'] },
        }).populate('site_id', 'name');
        // Approaching delivery (within 3 days)
        const approaching = await models_1.PurchaseOrder.find({
            company_id,
            ...siteFilter,
            expectedDeliveryDate: { $gte: now, $lte: threeDaysFromNow },
            status: { $in: ['sent', 'partial'] },
        }).populate('site_id', 'name');
        res.json({
            overdue: overdue.map(po => ({
                id: po._id.toString(),
                poNumber: po.poNumber,
                supplier: po.supplier,
                site: po.site_id?.name,
                expectedDeliveryDate: po.expectedDeliveryDate,
                daysOverdue: Math.floor((now.getTime() - (po.expectedDeliveryDate?.getTime() || now.getTime())) / (1000 * 60 * 60 * 24)),
            })),
            approaching: approaching.map(po => ({
                id: po._id.toString(),
                poNumber: po.poNumber,
                supplier: po.supplier,
                site: po.site_id?.name,
                expectedDeliveryDate: po.expectedDeliveryDate,
                daysRemaining: Math.ceil(((po.expectedDeliveryDate?.getTime() || now.getTime()) - now.getTime()) / (1000 * 60 * 60 * 24)),
            })),
        });
    }
    catch (error) {
        console.error('Get PO aging error:', error);
        res.status(500).json({ error: 'Failed to fetch PO aging report' });
    }
});
// Supplier Performance Report
router.get('/reports/suppliers', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const supplierStats = await models_1.PurchaseOrder.aggregate([
            { $match: { company_id } },
            {
                $group: {
                    _id: '$supplier.name',
                    totalPOs: { $sum: 1 },
                    totalValue: { $sum: '$totalAmount' },
                    completedPOs: {
                        $sum: { $cond: [{ $eq: ['$status', 'completed'] }, 1, 0] },
                    },
                    cancelledPOs: {
                        $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] },
                    },
                    avgDeliveryDays: {
                        $avg: {
                            $cond: [
                                { $and: ['$sentDate', '$expectedDeliveryDate'] },
                                { $divide: [{ $subtract: ['$expectedDeliveryDate', '$sentDate'] }, 1000 * 60 * 60 * 24] },
                                null,
                            ],
                        },
                    },
                },
            },
            { $sort: { totalValue: -1 } },
        ]);
        res.json(supplierStats.map(stat => ({
            supplierName: stat._id,
            totalPOs: stat.totalPOs,
            totalValue: stat.totalValue,
            completedPOs: stat.completedPOs,
            cancelledPOs: stat.cancelledPOs,
            completionRate: stat.totalPOs > 0 ? (stat.completedPOs / stat.totalPOs * 100).toFixed(1) : '0',
            avgDeliveryDays: stat.avgDeliveryDays ? stat.avgDeliveryDays.toFixed(1) : null,
        })));
    }
    catch (error) {
        console.error('Get supplier report error:', error);
        res.status(500).json({ error: 'Failed to fetch supplier report' });
    }
});
// Generate PDF for PO
router.get('/:id/pdf', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const po = await models_1.PurchaseOrder.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        }).populate('site_id', 'name location');
        if (!po) {
            res.status(404).json({ error: 'Purchase order not found' });
            return;
        }
        // Check site access for site managers
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            const siteIdStr = po.site_id?._id?.toString() || po.site_id.toString();
            if (!req.assignedSiteIds?.includes(siteIdStr)) {
                res.status(403).json({ error: 'Access denied to this purchase order' });
                return;
            }
        }
        // Generate HTML for PDF
        const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Purchase Order ${po.poNumber}</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 40px; color: #333; }
    .header { text-align: center; margin-bottom: 30px; }
    .header h1 { margin: 0; font-size: 24px; }
    .header p { margin: 5px 0; color: #666; }
    .section { margin-bottom: 25px; }
    .section-title { font-size: 14px; font-weight: bold; margin-bottom: 10px; color: #555; text-transform: uppercase; }
    .info-grid { display: flex; gap: 40px; }
    .info-block { flex: 1; }
    .info-block p { margin: 5px 0; }
    .label { color: #666; font-size: 12px; }
    .value { font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th { background: #f5f5f5; text-align: left; padding: 10px; font-size: 12px; text-transform: uppercase; }
    td { padding: 10px; border-bottom: 1px solid #eee; }
    .text-right { text-align: right; }
    .totals { margin-top: 20px; text-align: right; }
    .totals-row { display: flex; justify-content: flex-end; gap: 20px; margin: 5px 0; }
    .total-amount { font-size: 18px; font-weight: bold; margin-top: 10px; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #eee; text-align: center; color: #666; font-size: 12px; }
    .status { display: inline-block; padding: 5px 15px; border-radius: 20px; font-size: 12px; font-weight: bold; }
    .status-draft { background: #e5e7eb; }
    .status-sent { background: #dbeafe; color: #1e40af; }
    .status-partial { background: #fef3c7; color: #92400e; }
    .status-received { background: #d1fae5; color: #065f46; }
    .status-completed { background: #e0e7ff; color: #3730a3; }
    .status-cancelled { background: #fee2e2; color: #991b1b; }
    @media print {
      body { margin: 20px; }
      .no-print { display: none; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>PURCHASE ORDER</h1>
    <p style="font-size: 20px; margin-top: 10px;">${po.poNumber}</p>
    <span class="status status-${po.status}">${po.status.toUpperCase()}</span>
  </div>

  <div class="section">
    <div class="info-grid">
      <div class="info-block">
        <div class="section-title">Supplier</div>
        <p><span class="value">${po.supplier.name}</span></p>
        ${po.supplier.contactPerson ? `<p>${po.supplier.contactPerson}</p>` : ''}
        ${po.supplier.email ? `<p>${po.supplier.email}</p>` : ''}
        ${po.supplier.phone ? `<p>${po.supplier.phone}</p>` : ''}
        ${po.supplier.address ? `<p>${po.supplier.address}</p>` : ''}
      </div>
      <div class="info-block">
        <div class="section-title">Delivery Information</div>
        <p><span class="label">Site:</span> <span class="value">${po.site_id?.name || 'Unknown'}</span></p>
        ${po.site_id?.location ? `<p><span class="label">Location:</span> ${po.site_id.location}</p>` : ''}
        ${po.sentDate ? `<p><span class="label">Sent Date:</span> ${new Date(po.sentDate).toLocaleDateString()}</p>` : ''}
        ${po.expectedDeliveryDate ? `<p><span class="label">Expected Delivery:</span> ${new Date(po.expectedDeliveryDate).toLocaleDateString()}</p>` : ''}
      </div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">Items</div>
    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Material</th>
          <th>Description</th>
          <th class="text-right">Qty</th>
          <th class="text-right">Unit</th>
          <th class="text-right">Unit Price</th>
          <th class="text-right">Total</th>
        </tr>
      </thead>
      <tbody>
        ${po.items.map((item, index) => `
        <tr>
          <td>${index + 1}</td>
          <td><strong>${item.materialName}</strong></td>
          <td>${item.description || '-'}</td>
          <td class="text-right">${item.quantityOrdered}</td>
          <td class="text-right">${item.unit}</td>
          <td class="text-right">$${item.unitPrice.toFixed(2)}</td>
          <td class="text-right">$${item.totalPrice.toFixed(2)}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>

    <div class="totals">
      <div class="totals-row">
        <span>Subtotal:</span>
        <span>$${po.subTotal.toFixed(2)}</span>
      </div>
      <div class="totals-row">
        <span>Tax (${po.taxRate}%):</span>
        <span>$${po.taxAmount.toFixed(2)}</span>
      </div>
      <div class="totals-row total-amount">
        <span>TOTAL:</span>
        <span>$${po.totalAmount.toFixed(2)}</span>
      </div>
    </div>
  </div>

  ${po.notes ? `
  <div class="section">
    <div class="section-title">Notes</div>
    <p>${po.notes}</p>
  </div>
  ` : ''}

  ${po.terms ? `
  <div class="section">
    <div class="section-title">Terms & Conditions</div>
    <p>${po.terms}</p>
  </div>
  ` : ''}

  <div class="footer">
    <p>Generated on ${new Date().toLocaleString()}</p>
    <p>Multi-Site Stock Management System</p>
  </div>

  <div class="no-print" style="margin-top: 30px; text-align: center;">
    <button onclick="window.print()" style="padding: 10px 30px; font-size: 16px; cursor: pointer;">
      Print / Save as PDF
    </button>
  </div>
</body>
</html>`;
        res.setHeader('Content-Type', 'text/html');
        res.send(html);
    }
    catch (error) {
        console.error('Generate PDF error:', error);
        res.status(500).json({ error: 'Failed to generate PDF' });
    }
});
// Pending Deliveries Report
router.get('/reports/pending', auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        // Site filter for site managers
        let siteFilter = {};
        if (req.user.role === types_1.UserRole.SITE_MANAGER) {
            if (!req.assignedSiteIds || req.assignedSiteIds.length === 0) {
                res.json([]);
                return;
            }
            const assignedIds = req.assignedSiteIds
                .filter(id => mongoose_1.default.Types.ObjectId.isValid(id))
                .map(id => new mongoose_1.default.Types.ObjectId(id));
            siteFilter = { site_id: { $in: assignedIds } };
        }
        const pending = await models_1.PurchaseOrder.find({
            company_id,
            ...siteFilter,
            status: { $in: ['sent', 'partial'] },
        })
            .sort({ expectedDeliveryDate: 1 })
            .populate('site_id', 'name');
        res.json(pending.map(po => ({
            id: po._id.toString(),
            poNumber: po.poNumber,
            supplier: po.supplier,
            site: po.site_id?.name,
            status: po.status,
            totalAmount: po.totalAmount,
            itemsPending: po.items.reduce((sum, item) => sum + (item.quantityOrdered - item.quantityReceived), 0),
            totalItems: po.items.reduce((sum, item) => sum + item.quantityOrdered, 0),
            sentDate: po.sentDate,
            expectedDeliveryDate: po.expectedDeliveryDate,
        })));
    }
    catch (error) {
        console.error('Get pending report error:', error);
        res.status(500).json({ error: 'Failed to fetch pending deliveries report' });
    }
});
exports.default = router;
//# sourceMappingURL=purchaseOrders.js.map