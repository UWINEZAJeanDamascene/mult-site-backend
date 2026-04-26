"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const models_1 = require("../models");
const types_1 = require("../types");
const router = (0, express_1.Router)();
// Validation schemas
const purchaseReturnItemSchema = zod_1.z.object({
    materialName: zod_1.z.string().min(1, 'Material name is required'),
    material_id: zod_1.z.string().optional(),
    quantityReturned: zod_1.z.number().min(0, 'Quantity returned must be >= 0'),
    unit: zod_1.z.string().min(1, 'Unit is required'),
    unitPrice: zod_1.z.number().min(0, 'Unit price must be >= 0'),
    reason: zod_1.z.enum(['defective', 'wrong_item', 'overage', 'other'], {
        required_error: 'Return reason is required',
    }),
    notes: zod_1.z.string().optional(),
});
const purchaseReturnSchema = zod_1.z.object({
    poId: zod_1.z.string().min(1, 'PO ID is required'),
    items: zod_1.z.array(purchaseReturnItemSchema).min(1, 'At least one item is required'),
    returnDate: zod_1.z.string().min(1, 'Return date is required'),
    carrier: zod_1.z.string().optional(),
    trackingNumber: zod_1.z.string().optional(),
    condition: zod_1.z.enum(['good', 'damaged', 'partial'], {
        required_error: 'Overall condition is required',
    }),
    refundStatus: zod_1.z.enum(['pending', 'processed', 'refunded']).optional(),
    refundAmount: zod_1.z.number().min(0).optional(),
    notes: zod_1.z.string().optional(),
    attachments: zod_1.z.array(zod_1.z.string()).optional(),
});
// Generate Return number
async function generateReturnNumber(company_id) {
    const year = new Date().getFullYear();
    const count = await models_1.PurchaseReturn.countDocuments({
        company_id,
        createdAt: {
            $gte: new Date(year, 0, 1),
            $lt: new Date(year + 1, 0, 1),
        },
    });
    return `RET-${year}-${String(count + 1).padStart(4, '0')}`;
}
// Get all purchase returns for company
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const { page = '1', limit = '10', poId, search } = req.query;
        const query = { company_id };
        if (poId)
            query.poId = poId;
        if (search) {
            query.$or = [
                { returnNumber: { $regex: search, $options: 'i' } },
                { poNumber: { $regex: search, $options: 'i' } },
                { 'supplier.name': { $regex: search, $options: 'i' } },
            ];
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const [purchaseReturns, total] = await Promise.all([
            models_1.PurchaseReturn.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            models_1.PurchaseReturn.countDocuments(query),
        ]);
        res.json({
            records: purchaseReturns.map((ret) => ({
                id: ret._id,
                returnNumber: ret.returnNumber,
                poId: ret.poId,
                poNumber: ret.poNumber,
                supplier: ret.supplier,
                site: ret.site,
                items: ret.items,
                returnDate: ret.returnDate,
                returnedBy: ret.returnedBy,
                returnedByName: ret.returnedByName,
                carrier: ret.carrier,
                trackingNumber: ret.trackingNumber,
                condition: ret.condition,
                refundStatus: ret.refundStatus,
                refundAmount: ret.refundAmount,
                notes: ret.notes,
                attachments: ret.attachments,
                company_id: ret.company_id,
                createdAt: ret.createdAt,
                updatedAt: ret.updatedAt,
            })),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        console.error('Error fetching purchase returns:', error);
        res.status(500).json({ message: 'Failed to fetch purchase returns' });
    }
});
// Get purchase return by ID
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const purchaseReturn = await models_1.PurchaseReturn.findOne({ _id: id, company_id }).lean();
        if (!purchaseReturn) {
            res.status(404).json({ message: 'Purchase return not found' });
            return;
        }
        res.json({
            id: purchaseReturn._id,
            returnNumber: purchaseReturn.returnNumber,
            poId: purchaseReturn.poId,
            poNumber: purchaseReturn.poNumber,
            supplier: purchaseReturn.supplier,
            site: purchaseReturn.site,
            items: purchaseReturn.items,
            returnDate: purchaseReturn.returnDate,
            returnedBy: purchaseReturn.returnedBy,
            returnedByName: purchaseReturn.returnedByName,
            carrier: purchaseReturn.carrier,
            trackingNumber: purchaseReturn.trackingNumber,
            condition: purchaseReturn.condition,
            refundStatus: purchaseReturn.refundStatus,
            refundAmount: purchaseReturn.refundAmount,
            notes: purchaseReturn.notes,
            attachments: purchaseReturn.attachments,
            company_id: purchaseReturn.company_id,
            createdAt: purchaseReturn.createdAt,
            updatedAt: purchaseReturn.updatedAt,
        });
    }
    catch (error) {
        console.error('Error fetching purchase return:', error);
        res.status(500).json({ message: 'Failed to fetch purchase return' });
    }
});
// Create purchase return
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER, types_1.UserRole.SITE_MANAGER]), async (req, res) => {
    try {
        const { company_id, id: userId, name: userName } = req.user;
        const validation = purchaseReturnSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                message: 'Invalid data',
                errors: validation.error.flatten().fieldErrors,
            });
            return;
        }
        const data = validation.data;
        // Get the PO to copy supplier/site info
        const po = await models_1.PurchaseOrder.findOne({ _id: data.poId, company_id }).lean();
        if (!po) {
            res.status(404).json({ message: 'Purchase order not found' });
            return;
        }
        // Check if PO status allows returns
        if (po.status === 'draft' || po.status === 'cancelled') {
            res.status(400).json({
                message: `Cannot create return for PO with status: ${po.status}`,
            });
            return;
        }
        // Get site info
        const site = await models_1.Site.findById(po.site_id).lean();
        if (!site) {
            res.status(404).json({ message: 'Site not found' });
            return;
        }
        // Calculate refund amount
        const refundAmount = data.items.reduce((sum, item) => sum + item.quantityReturned * item.unitPrice, 0);
        // Generate Return number
        const returnNumber = await generateReturnNumber(company_id);
        const purchaseReturn = await models_1.PurchaseReturn.create({
            returnNumber,
            poId: data.poId,
            poNumber: po.poNumber,
            supplier: po.supplier,
            site_id: po.site_id,
            site: {
                _id: site._id.toString(),
                name: site.name,
                location: site.location,
            },
            items: data.items,
            returnDate: new Date(data.returnDate),
            returnedBy: userId,
            returnedByName: userName,
            carrier: data.carrier,
            trackingNumber: data.trackingNumber,
            condition: data.condition,
            refundStatus: data.refundStatus || 'pending',
            refundAmount,
            notes: data.notes,
            attachments: data.attachments,
            company_id,
        });
        const savedReturn = purchaseReturn.toObject();
        // Update PO with returned quantities
        const updatedItems = po.items.map((poItem) => {
            const returnedItem = data.items.find((rItem) => rItem.materialName === poItem.materialName);
            if (returnedItem) {
                return {
                    ...poItem,
                    quantityReceived: Math.max(0, (poItem.quantityReceived || 0) - returnedItem.quantityReturned),
                };
            }
            return poItem;
        });
        // Determine new PO status
        const allReturned = updatedItems.every((item) => (item.quantityReceived || 0) === 0);
        const someReturned = updatedItems.some((item) => (item.quantityReceived || 0) < item.quantityOrdered);
        let newStatus = po.status;
        if (allReturned && po.status === 'received') {
            newStatus = 'sent';
        }
        else if (someReturned && po.status === 'received') {
            newStatus = 'partial';
        }
        await models_1.PurchaseOrder.updateOne({ _id: data.poId }, {
            $set: {
                items: updatedItems,
                status: newStatus,
            },
        });
        res.status(201).json({
            id: savedReturn._id,
            returnNumber: savedReturn.returnNumber,
            poId: savedReturn.poId,
            poNumber: savedReturn.poNumber,
            supplier: savedReturn.supplier,
            site: savedReturn.site,
            items: savedReturn.items,
            returnDate: savedReturn.returnDate,
            returnedBy: savedReturn.returnedBy,
            returnedByName: savedReturn.returnedByName,
            carrier: savedReturn.carrier,
            trackingNumber: savedReturn.trackingNumber,
            condition: savedReturn.condition,
            refundStatus: savedReturn.refundStatus,
            refundAmount: savedReturn.refundAmount,
            notes: savedReturn.notes,
            attachments: savedReturn.attachments,
            company_id: savedReturn.company_id,
            createdAt: savedReturn.createdAt,
            updatedAt: savedReturn.updatedAt,
        });
    }
    catch (error) {
        console.error('Error creating purchase return:', error);
        res.status(500).json({ message: 'Failed to create purchase return' });
    }
});
// Get purchase returns for a specific PO
router.get('/po/:poId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const { poId } = req.params;
        const purchaseReturns = await models_1.PurchaseReturn.find({ poId, company_id })
            .sort({ createdAt: -1 })
            .lean();
        res.json(purchaseReturns.map((ret) => ({
            id: ret._id,
            returnNumber: ret.returnNumber,
            poId: ret.poId,
            poNumber: ret.poNumber,
            supplier: ret.supplier,
            site: ret.site,
            items: ret.items,
            returnDate: ret.returnDate,
            returnedBy: ret.returnedBy,
            returnedByName: ret.returnedByName,
            carrier: ret.carrier,
            trackingNumber: ret.trackingNumber,
            condition: ret.condition,
            refundStatus: ret.refundStatus,
            refundAmount: ret.refundAmount,
            notes: ret.notes,
            attachments: ret.attachments,
            company_id: ret.company_id,
            createdAt: ret.createdAt,
            updatedAt: ret.updatedAt,
        })));
    }
    catch (error) {
        console.error('Error fetching PO purchase returns:', error);
        res.status(500).json({ message: 'Failed to fetch purchase returns' });
    }
});
// Update refund status
router.patch('/:id/refund', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const { refundStatus, refundAmount } = req.body;
        const purchaseReturn = await models_1.PurchaseReturn.findOneAndUpdate({ _id: id, company_id }, {
            $set: {
                refundStatus,
                refundAmount,
                updatedAt: new Date(),
            },
        }, { new: true }).lean();
        if (!purchaseReturn) {
            res.status(404).json({ message: 'Purchase return not found' });
            return;
        }
        res.json({
            id: purchaseReturn._id,
            returnNumber: purchaseReturn.returnNumber,
            poId: purchaseReturn.poId,
            poNumber: purchaseReturn.poNumber,
            supplier: purchaseReturn.supplier,
            site: purchaseReturn.site,
            items: purchaseReturn.items,
            returnDate: purchaseReturn.returnDate,
            returnedBy: purchaseReturn.returnedBy,
            returnedByName: purchaseReturn.returnedByName,
            carrier: purchaseReturn.carrier,
            trackingNumber: purchaseReturn.trackingNumber,
            condition: purchaseReturn.condition,
            refundStatus: purchaseReturn.refundStatus,
            refundAmount: purchaseReturn.refundAmount,
            notes: purchaseReturn.notes,
            attachments: purchaseReturn.attachments,
            company_id: purchaseReturn.company_id,
            createdAt: purchaseReturn.createdAt,
            updatedAt: purchaseReturn.updatedAt,
        });
    }
    catch (error) {
        console.error('Error updating refund status:', error);
        res.status(500).json({ message: 'Failed to update refund status' });
    }
});
// Delete purchase return
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const purchaseReturn = await models_1.PurchaseReturn.findOneAndDelete({
            _id: id,
            company_id,
        }).lean();
        if (!purchaseReturn) {
            res.status(404).json({ message: 'Purchase return not found' });
            return;
        }
        res.json({ message: 'Purchase return deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting purchase return:', error);
        res.status(500).json({ message: 'Failed to delete purchase return' });
    }
});
exports.default = router;
//# sourceMappingURL=purchaseReturns.js.map