"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const zod_1 = require("zod");
const Supplier_1 = require("../models/Supplier");
const types_1 = require("../types");
const router = (0, express_1.Router)();
// Validation schemas
const supplierSchema = zod_1.z.object({
    name: zod_1.z.string().min(1, 'Supplier name is required'),
    contactPerson: zod_1.z.string().optional(),
    email: zod_1.z.string().email('Invalid email').optional().or(zod_1.z.literal('')),
    phone: zod_1.z.string().optional(),
    address: zod_1.z.string().optional(),
});
// Get all suppliers for company
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const suppliers = await Supplier_1.Supplier.find({ company_id }).sort({ name: 1 }).lean();
        res.json(suppliers.map((s) => ({
            id: s._id,
            name: s.name,
            contactPerson: s.contactPerson,
            email: s.email,
            phone: s.phone,
            address: s.address,
            company_id: s.company_id,
            isActive: s.isActive,
            createdAt: s.createdAt,
            updatedAt: s.updatedAt,
        })));
    }
    catch (error) {
        console.error('Error fetching suppliers:', error);
        res.status(500).json({ message: 'Failed to fetch suppliers' });
    }
});
// Get supplier by ID
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const supplier = await Supplier_1.Supplier.findOne({ _id: id, company_id }).lean();
        if (!supplier) {
            res.status(404).json({ message: 'Supplier not found' });
            return;
        }
        res.json({
            id: supplier._id,
            name: supplier.name,
            contactPerson: supplier.contactPerson,
            email: supplier.email,
            phone: supplier.phone,
            address: supplier.address,
            company_id: supplier.company_id,
            isActive: supplier.isActive,
            createdAt: supplier.createdAt,
            updatedAt: supplier.updatedAt,
        });
    }
    catch (error) {
        console.error('Error fetching supplier:', error);
        res.status(500).json({ message: 'Failed to fetch supplier' });
    }
});
// Create supplier
router.post('/', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { company_id } = req.user;
        const validation = supplierSchema.safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                message: 'Invalid data',
                errors: validation.error.flatten().fieldErrors,
            });
            return;
        }
        const data = validation.data;
        // Check for duplicate name
        const existing = await Supplier_1.Supplier.findOne({
            name: data.name,
            company_id,
        });
        if (existing) {
            res.status(400).json({
                message: 'A supplier with this name already exists',
            });
            return;
        }
        const supplier = await Supplier_1.Supplier.create({
            ...data,
            company_id,
            isActive: true,
        });
        res.status(201).json({
            id: supplier._id,
            name: supplier.name,
            contactPerson: supplier.contactPerson,
            email: supplier.email,
            phone: supplier.phone,
            address: supplier.address,
            company_id: supplier.company_id,
            isActive: supplier.isActive,
            createdAt: supplier.createdAt,
            updatedAt: supplier.updatedAt,
        });
    }
    catch (error) {
        console.error('Error creating supplier:', error);
        res.status(500).json({ message: 'Failed to create supplier' });
    }
});
// Update supplier
router.put('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const validation = supplierSchema.partial().safeParse(req.body);
        if (!validation.success) {
            res.status(400).json({
                message: 'Invalid data',
                errors: validation.error.flatten().fieldErrors,
            });
            return;
        }
        const data = validation.data;
        // Check for duplicate name if name is being updated
        if (data.name) {
            const existing = await Supplier_1.Supplier.findOne({
                name: data.name,
                company_id,
                _id: { $ne: id },
            });
            if (existing) {
                res.status(400).json({
                    message: 'A supplier with this name already exists',
                });
                return;
            }
        }
        const supplier = await Supplier_1.Supplier.findOneAndUpdate({ _id: id, company_id }, { $set: data }, { new: true }).lean();
        if (!supplier) {
            res.status(404).json({ message: 'Supplier not found' });
            return;
        }
        res.json({
            id: supplier._id,
            name: supplier.name,
            contactPerson: supplier.contactPerson,
            email: supplier.email,
            phone: supplier.phone,
            address: supplier.address,
            company_id: supplier.company_id,
            isActive: supplier.isActive,
            createdAt: supplier.createdAt,
            updatedAt: supplier.updatedAt,
        });
    }
    catch (error) {
        console.error('Error updating supplier:', error);
        res.status(500).json({ message: 'Failed to update supplier' });
    }
});
// Delete supplier
router.delete('/:id', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const supplier = await Supplier_1.Supplier.findOneAndDelete({
            _id: id,
            company_id,
        }).lean();
        if (!supplier) {
            res.status(404).json({ message: 'Supplier not found' });
            return;
        }
        res.json({ message: 'Supplier deleted successfully' });
    }
    catch (error) {
        console.error('Error deleting supplier:', error);
        res.status(500).json({ message: 'Failed to delete supplier' });
    }
});
// Toggle supplier active status
router.patch('/:id/active', auth_1.authenticateToken, (0, auth_1.requireRole)([types_1.UserRole.MAIN_MANAGER, types_1.UserRole.MANAGER]), async (req, res) => {
    try {
        const { company_id } = req.user;
        const { id } = req.params;
        const { isActive } = req.body;
        if (typeof isActive !== 'boolean') {
            res.status(400).json({ message: 'isActive must be a boolean' });
            return;
        }
        const supplier = await Supplier_1.Supplier.findOneAndUpdate({ _id: id, company_id }, { $set: { isActive } }, { new: true }).lean();
        if (!supplier) {
            res.status(404).json({ message: 'Supplier not found' });
            return;
        }
        res.json({
            id: supplier._id,
            name: supplier.name,
            contactPerson: supplier.contactPerson,
            email: supplier.email,
            phone: supplier.phone,
            address: supplier.address,
            company_id: supplier.company_id,
            isActive: supplier.isActive,
            createdAt: supplier.createdAt,
            updatedAt: supplier.updatedAt,
        });
    }
    catch (error) {
        console.error('Error toggling supplier status:', error);
        res.status(500).json({ message: 'Failed to update supplier status' });
    }
});
exports.default = router;
//# sourceMappingURL=suppliers.js.map