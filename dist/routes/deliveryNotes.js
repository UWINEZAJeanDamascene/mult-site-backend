"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const models_1 = require("../models");
const types_1 = require("../types");
const router = (0, express_1.Router)();
// Validation schemas
const deliveryNoteItemSchema = zod_1.z.object({
    materialName: zod_1.z.string().min(1, 'Material name is required'),
    material_id: zod_1.z.string().optional(),
    quantityOrdered: zod_1.z.number().min(0, 'Quantity ordered must be >= 0'),
    quantityDelivered: zod_1.z.number().min(0, 'Quantity delivered must be >= 0'),
    unit: zod_1.z.string().min(1, 'Unit is required'),
    unitPrice: zod_1.z.number().min(0, 'Unit price must be >= 0'),
    condition: zod_1.z.enum(['good', 'damaged', 'partial']).optional(),
    notes: zod_1.z.string().optional(),
});
const deliveryNoteSchema = zod_1.z.object({
    poId: zod_1.z.string().min(1, 'PO ID is required'),
    items: zod_1.z.array(deliveryNoteItemSchema).min(1, 'At least one item is required'),
    deliveryDate: zod_1.z.string().min(1, 'Delivery date is required'),
    carrier: zod_1.z.string().optional(),
    trackingNumber: zod_1.z.string().optional(),
    condition: zod_1.z.enum(['good', 'damaged', 'partial'], {
        required_error: 'Overall condition is required',
    }),
    notes: zod_1.z.string().optional(),
    attachments: zod_1.z.array(zod_1.z.string()).optional(),
});
// Generate DN number
async function generateDNNumber(company_id) {
    const year = new Date().getFullYear();
    const count = await models_1.DeliveryNote.countDocuments({
        company_id,
        createdAt: {
            $gte: new Date(year, 0, 1),
            $lt: new Date(year + 1, 0, 1),
        },
    });
    return `DN-${year}-${String(count + 1).padStart(4, '0')}`;
}
// Get all delivery notes for company
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const { page = '1', limit = '10', poId, search } = req.query;
        const query = { company_id };
        if (poId)
            query.poId = poId;
        if (search) {
            query.$or = [
                { dnNumber: { $regex: search, $options: 'i' } },
                { poNumber: { $regex: search, $options: 'i' } },
                { 'supplier.name': { $regex: search, $options: 'i' } },
            ];
        }
        const pageNum = parseInt(page);
        const limitNum = parseInt(limit);
        const skip = (pageNum - 1) * limitNum;
        const [deliveryNotes, total] = await Promise.all([
            models_1.DeliveryNote.find(query).sort({ createdAt: -1 }).skip(skip).limit(limitNum).lean(),
            models_1.DeliveryNote.countDocuments(query),
        ]);
        res.json({
            records: deliveryNotes.map((dn) => ({
                id: dn._id,
                dnNumber: dn.dnNumber,
                poId: dn.poId,
                poNumber: dn.poNumber,
                supplier: dn.supplier,
                site: dn.site,
                items: dn.items,
                deliveryDate: dn.deliveryDate,
                receivedBy: dn.receivedBy,
                receivedByName: dn.receivedByName,
                carrier: dn.carrier,
                trackingNumber: dn.trackingNumber,
                condition: dn.condition,
                notes: dn.notes,
                attachments: dn.attachments,
                company_id: dn.company_id,
                createdAt: dn.createdAt,
                updatedAt: dn.updatedAt,
            })),
            total,
            page: pageNum,
            totalPages: Math.ceil(total / limitNum),
        });
    }
    catch (error) {
        console.error('Error fetching delivery notes:', error);
        res.status(500).json({ message: 'Failed to fetch delivery notes' });
    }
});
// Get delivery note by ID
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const deliveryNote = await models_1.DeliveryNote.findOne({ _id: id, company_id }).lean();
        if (!deliveryNote) {
            res.status(404).json({ message: 'Delivery note not found' });
            return;
        }
        res.json({
            id: deliveryNote._id,
            dnNumber: deliveryNote.dnNumber,
            poId: deliveryNote.poId,
            poNumber: deliveryNote.poNumber,
            supplier: deliveryNote.supplier,
            site: deliveryNote.site,
            items: deliveryNote.items,
            deliveryDate: deliveryNote.deliveryDate,
            receivedBy: deliveryNote.receivedBy,
            receivedByName: deliveryNote.receivedByName,
            carrier: deliveryNote.carrier,
            trackingNumber: deliveryNote.trackingNumber,
            condition: deliveryNote.condition,
            notes: deliveryNote.notes,
            attachments: deliveryNote.attachments,
            company_id: deliveryNote.company_id,
            createdAt: deliveryNote.createdAt,
            updatedAt: deliveryNote.updatedAt,
        });
    }
    catch (error) {
        console.error('Error fetching delivery note:', error);
        res.status(500).json({ message: 'Failed to fetch delivery note' });
    }
});
// Create delivery note
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER, types_1.UserRole.SITE_MANAGER]), async (req, res) => {
    try {
        const { company_id, id: userId, name: userName } = req.user;
        const validation = deliveryNoteSchema.safeParse(req.body);
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
        // Check if PO status allows delivery
        if (po.status === 'draft' || po.status === 'cancelled') {
            res.status(400).json({
                message: `Cannot create delivery note for PO with status: ${po.status}`,
            });
            return;
        }
        // Get site info
        const site = await models_1.Site.findById(po.site_id).lean();
        if (!site) {
            res.status(404).json({ message: 'Site not found' });
            return;
        }
        // Generate DN number
        const dnNumber = await generateDNNumber(company_id);
        // Calculate totals with tax from PO
        const itemsWithTotals = data.items.map((item) => ({
            ...item,
            totalPrice: item.quantityDelivered * item.unitPrice,
        }));
        const subTotal = itemsWithTotals.reduce((sum, item) => sum + item.totalPrice, 0);
        const taxRate = po.taxRate || 0;
        const taxAmount = subTotal * (taxRate / 100);
        const totalAmount = subTotal + taxAmount;
        const deliveryNote = await models_1.DeliveryNote.create({
            dnNumber,
            poId: data.poId,
            poNumber: po.poNumber,
            supplier: po.supplier,
            site_id: po.site_id,
            site: {
                _id: site._id.toString(),
                name: site.name,
                location: site.location,
            },
            items: itemsWithTotals,
            deliveryDate: new Date(data.deliveryDate),
            receivedBy: userId,
            receivedByName: userName,
            carrier: data.carrier,
            trackingNumber: data.trackingNumber,
            condition: data.condition,
            notes: data.notes,
            attachments: data.attachments,
            subTotal,
            taxRate,
            taxAmount,
            totalAmount,
            company_id,
        });
        const savedDN = deliveryNote.toObject();
        // Update PO with received quantities
        const updatedItems = po.items.map((poItem) => {
            const deliveredItem = data.items.find((dItem) => dItem.materialName === poItem.materialName);
            if (deliveredItem) {
                return {
                    ...poItem,
                    quantityReceived: (poItem.quantityReceived || 0) + deliveredItem.quantityDelivered,
                };
            }
            return poItem;
        });
        // Determine new PO status
        const allReceived = updatedItems.every((item) => item.quantityReceived >= item.quantityOrdered);
        const someReceived = updatedItems.some((item) => item.quantityReceived > 0);
        let newStatus = po.status;
        if (allReceived) {
            newStatus = 'received';
        }
        else if (someReceived) {
            newStatus = 'partial';
        }
        await models_1.PurchaseOrder.updateOne({ _id: data.poId }, {
            $set: {
                items: updatedItems,
                status: newStatus,
            },
        });
        // Create SiteRecord entries for delivered items (auto-syncs to MainStock)
        const siteRecordPromises = data.items
            .filter((item) => item.quantityDelivered > 0)
            .map((item) => models_1.SiteRecord.create({
            site_id: po.site_id,
            material_id: item.material_id || undefined,
            materialName: item.materialName,
            quantityReceived: item.quantityDelivered,
            quantityUsed: 0,
            date: new Date(data.deliveryDate),
            notes: `Delivered via ${savedDN.dnNumber}. ${item.notes || ''}`,
            recordedBy: userId,
            company_id,
            syncedToMainStock: false,
        }));
        await Promise.all(siteRecordPromises);
        res.status(201).json({
            id: savedDN._id,
            dnNumber: savedDN.dnNumber,
            poId: savedDN.poId,
            poNumber: savedDN.poNumber,
            supplier: savedDN.supplier,
            site: savedDN.site,
            items: savedDN.items,
            deliveryDate: savedDN.deliveryDate,
            receivedBy: savedDN.receivedBy,
            receivedByName: savedDN.receivedByName,
            carrier: savedDN.carrier,
            trackingNumber: savedDN.trackingNumber,
            condition: savedDN.condition,
            notes: savedDN.notes,
            attachments: savedDN.attachments,
            company_id: savedDN.company_id,
            createdAt: savedDN.createdAt,
            updatedAt: savedDN.updatedAt,
        });
    }
    catch (error) {
        console.error('Error creating delivery note:', error);
        res.status(500).json({ message: 'Failed to create delivery note' });
    }
});
// Get delivery notes for a specific PO
router.get('/po/:poId', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const { poId } = req.params;
        const deliveryNotes = await models_1.DeliveryNote.find({ poId, company_id })
            .sort({ createdAt: -1 })
            .lean();
        res.json(deliveryNotes.map((dn) => ({
            id: dn._id,
            dnNumber: dn.dnNumber,
            poId: dn.poId,
            poNumber: dn.poNumber,
            supplier: dn.supplier,
            site: dn.site,
            items: dn.items,
            deliveryDate: dn.deliveryDate,
            receivedBy: dn.receivedBy,
            receivedByName: dn.receivedByName,
            carrier: dn.carrier,
            trackingNumber: dn.trackingNumber,
            condition: dn.condition,
            notes: dn.notes,
            attachments: dn.attachments,
            company_id: dn.company_id,
            createdAt: dn.createdAt,
            updatedAt: dn.updatedAt,
        })));
    }
    catch (error) {
        console.error('Error fetching PO delivery notes:', error);
        res.status(500).json({ message: 'Failed to fetch delivery notes' });
    }
});
// Delete delivery note
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const deliveryNote = await models_1.DeliveryNote.findOne({
            _id: id,
            company_id,
        }).lean();
        if (!deliveryNote) {
            res.status(404).json({ message: 'Delivery note not found' });
            return;
        }
        // Revert PO received quantities
        const po = await models_1.PurchaseOrder.findOne({
            _id: deliveryNote.poId,
            company_id,
        }).lean();
        if (po) {
            const updatedItems = po.items.map((poItem) => {
                const deliveredItem = deliveryNote.items.find((dItem) => dItem.materialName === poItem.materialName);
                if (deliveredItem) {
                    return {
                        ...poItem,
                        quantityReceived: Math.max(0, (poItem.quantityReceived || 0) - deliveredItem.quantityDelivered),
                    };
                }
                return poItem;
            });
            // Recalculate PO status
            const someReceived = updatedItems.some((item) => (item.quantityReceived || 0) > 0);
            const newStatus = someReceived ? 'partial' : 'sent';
            await models_1.PurchaseOrder.updateOne({ _id: po._id }, {
                $set: {
                    items: updatedItems,
                    status: newStatus,
                },
            });
        }
        // Delete associated site records created from this delivery note
        await models_1.SiteRecord.deleteMany({
            site_id: deliveryNote.site_id,
            company_id,
            notes: { $regex: `Delivered via ${deliveryNote.dnNumber}` },
        });
        // Delete the delivery note
        await models_1.DeliveryNote.deleteOne({ _id: id, company_id });
        res.json({ message: 'Delivery note deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting delivery note:', error);
        res.status(500).json({ message: 'Failed to delete delivery note' });
    }
});
exports.default = router;
//# sourceMappingURL=deliveryNotes.js.map