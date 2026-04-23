"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const models_1 = require("../models");
const actionLogService_1 = require("../services/actionLogService");
const mongoose_1 = __importDefault(require("mongoose"));
const router = (0, express_1.Router)();
// Search materials
router.get('/search', auth_1.authenticateToken, async (req, res) => {
    try {
        const { q } = req.query;
        const company_id = req.user.company_id;
        if (!q || typeof q !== 'string' || q.length < 2) {
            res.json([]);
            return;
        }
        const materials = await models_1.Material.find({
            company_id,
            name: { $regex: q, $options: 'i' },
        }).limit(20);
        res.json(materials.map(material => ({
            _id: material._id.toString(),
            name: material.name,
            unit: material.unit,
        })));
    }
    catch (error) {
        console.error('Search materials error:', error);
        res.status(500).json({ error: 'Failed to search materials' });
    }
});
// Get all materials
router.get('/', auth_1.authenticateToken, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const materials = await models_1.Material.find({ company_id }).sort({ name: 1 });
        res.json(materials.map(material => ({
            _id: material._id.toString(),
            name: material.name,
            unit: material.unit,
            description: material.description,
            company_id: material.company_id,
            isActive: material.isActive,
            createdAt: material.createdAt,
        })));
    }
    catch (error) {
        console.error('Get materials error:', error);
        res.status(500).json({ error: 'Failed to fetch materials' });
    }
});
// Get single material
router.get('/:id', auth_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const material = await models_1.Material.findOne({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        });
        if (!material) {
            res.status(404).json({ error: 'Material not found' });
            return;
        }
        res.json({
            _id: material._id.toString(),
            name: material.name,
            unit: material.unit,
            description: material.description,
            company_id: material.company_id,
            isActive: material.isActive,
            createdAt: material.createdAt,
        });
    }
    catch (error) {
        console.error('Get material error:', error);
        res.status(500).json({ error: 'Failed to fetch material' });
    }
});
// Create material (main manager only)
router.post('/', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { name, unit, description } = req.body;
        const company_id = req.user.company_id;
        if (!name || !unit) {
            res.status(400).json({ error: 'Name and unit are required' });
            return;
        }
        // Check if material already exists
        const existingMaterial = await models_1.Material.findOne({
            name: { $regex: new RegExp(`^${name}$`, 'i') },
            company_id,
        });
        if (existingMaterial) {
            res.status(409).json({ error: 'Material with this name already exists' });
            return;
        }
        const material = await models_1.Material.create({
            name,
            unit,
            description,
            company_id,
            isActive: true,
        });
        // Log material creation
        await actionLogService_1.ActionLogService.logMaterialCreate(req, material._id.toString(), material.name);
        res.status(201).json({
            _id: material._id.toString(),
            name: material.name,
            unit: material.unit,
            description: material.description,
            company_id: material.company_id,
            isActive: material.isActive,
            createdAt: material.createdAt,
        });
    }
    catch (error) {
        console.error('Create material error:', error);
        res.status(500).json({ error: 'Failed to create material' });
    }
});
// Update material (main manager only)
router.put('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, unit, description } = req.body;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const updateData = {};
        if (name)
            updateData.name = name;
        if (unit)
            updateData.unit = unit;
        if (description !== undefined)
            updateData.description = description;
        const material = await models_1.Material.findOneAndUpdate({ _id: new mongoose_1.default.Types.ObjectId(idStr), company_id }, { $set: updateData }, { returnDocument: 'after' });
        if (!material) {
            res.status(404).json({ error: 'Material not found' });
            return;
        }
        // Log material update
        await actionLogService_1.ActionLogService.logMaterialUpdate(req, material._id.toString(), material.name);
        res.json({
            _id: material._id.toString(),
            name: material.name,
            unit: material.unit,
            description: material.description,
            company_id: material.company_id,
            isActive: material.isActive,
            createdAt: material.createdAt,
        });
    }
    catch (error) {
        console.error('Update material error:', error);
        res.status(500).json({ error: 'Failed to update material' });
    }
});
// Toggle material active status (main manager only)
router.patch('/:id/active', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const { isActive } = req.body;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const material = await models_1.Material.findOneAndUpdate({ _id: new mongoose_1.default.Types.ObjectId(idStr), company_id }, { $set: { isActive } }, { returnDocument: 'after' });
        if (!material) {
            res.status(404).json({ error: 'Material not found' });
            return;
        }
        // Log material status change (update)
        await actionLogService_1.ActionLogService.logMaterialUpdate(req, material._id.toString(), material.name);
        res.json({
            _id: material._id.toString(),
            name: material.name,
            unit: material.unit,
            description: material.description,
            company_id: material.company_id,
            isActive: material.isActive,
            createdAt: material.createdAt,
        });
    }
    catch (error) {
        console.error('Toggle material active error:', error);
        res.status(500).json({ error: 'Failed to update material status' });
    }
});
// Delete material (main manager only)
router.delete('/:id', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { id } = req.params;
        const company_id = req.user.company_id;
        const idStr = Array.isArray(id) ? id[0] : id;
        const material = await models_1.Material.findOneAndDelete({
            _id: new mongoose_1.default.Types.ObjectId(idStr),
            company_id,
        });
        if (!material) {
            res.status(404).json({ error: 'Material not found' });
            return;
        }
        // Log material deletion
        await actionLogService_1.ActionLogService.logFromRequest(req, models_1.ActionType.DELETE, models_1.ResourceType.MATERIAL, `Deleted material: ${material.name}`, {
            resourceId: material._id.toString(),
            resourceName: material.name,
        });
        res.json({ message: 'Material deleted successfully' });
    }
    catch (error) {
        console.error('Delete material error:', error);
        res.status(500).json({ error: 'Failed to delete material' });
    }
});
exports.default = router;
//# sourceMappingURL=materials.js.map