"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_1 = require("../middleware/auth");
const MainStockRecord_1 = __importDefault(require("../models/MainStockRecord"));
const router = (0, express_1.Router)();
// Get Used Materials View (aggregated consumption)
router.get('/used', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { material, startDate, endDate } = req.query;
        const company_id = req.user.company_id;
        let matchStage = { company_id, quantityUsed: { $gt: 0 } };
        if (material) {
            matchStage.materialName = { $regex: material, $options: 'i' };
        }
        if (startDate || endDate) {
            matchStage.date = {};
            if (startDate)
                matchStage.date.$gte = new Date(startDate);
            if (endDate)
                matchStage.date.$lte = new Date(endDate);
        }
        const usedMaterials = await MainStockRecord_1.default.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$materialName',
                    materialName: { $first: '$materialName' },
                    material_id: { $first: '$material_id' },
                    totalQuantityUsed: { $sum: '$quantityUsed' },
                    avgPrice: { $avg: '$price' },
                    totalValue: { $sum: { $multiply: ['$quantityUsed', { $ifNull: ['$price', 0] }] } },
                    recordCount: { $sum: 1 },
                    siteBreakdown: {
                        $push: {
                            site_id: '$site_id',
                            source: '$source',
                            quantityUsed: '$quantityUsed'
                        }
                    }
                }
            },
            { $project: { _id: 0 } },
            { $sort: { totalQuantityUsed: -1 } }
        ]);
        res.json(usedMaterials);
    }
    catch (error) {
        console.error('Get used materials view error:', error);
        res.status(500).json({ error: 'Failed to fetch used materials view' });
    }
});
// Get single material used view
router.get('/used/:material', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { material } = req.params;
        const company_id = req.user.company_id;
        const usedMaterial = await MainStockRecord_1.default.aggregate([
            {
                $match: {
                    company_id,
                    materialName: { $regex: new RegExp(`^${material}$`, 'i') },
                    quantityUsed: { $gt: 0 }
                }
            },
            {
                $group: {
                    _id: '$materialName',
                    materialName: { $first: '$materialName' },
                    material_id: { $first: '$material_id' },
                    totalQuantityUsed: { $sum: '$quantityUsed' },
                    avgPrice: { $avg: '$price' },
                    totalValue: { $sum: { $multiply: ['$quantityUsed', { $ifNull: ['$price', 0] }] } },
                    recordCount: { $sum: 1 },
                    siteBreakdown: {
                        $push: {
                            site_id: '$site_id',
                            source: '$source',
                            quantityUsed: '$quantityUsed'
                        }
                    }
                }
            },
            { $project: { _id: 0 } }
        ]);
        if (!usedMaterial || usedMaterial.length === 0) {
            res.status(404).json({ error: 'Material not found in used view' });
            return;
        }
        res.json(usedMaterial[0]);
    }
    catch (error) {
        console.error('Get used material error:', error);
        res.status(500).json({ error: 'Failed to fetch used material' });
    }
});
// Get Remaining Materials View (current balance)
router.get('/remaining', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { material, startDate, endDate } = req.query;
        const company_id = req.user.company_id;
        let matchStage = { company_id };
        if (material) {
            matchStage.materialName = { $regex: material, $options: 'i' };
        }
        if (startDate || endDate) {
            matchStage.date = {};
            if (startDate)
                matchStage.date.$gte = new Date(startDate);
            if (endDate)
                matchStage.date.$lte = new Date(endDate);
        }
        const remainingMaterials = await MainStockRecord_1.default.aggregate([
            { $match: matchStage },
            {
                $group: {
                    _id: '$materialName',
                    materialName: { $first: '$materialName' },
                    material_id: { $first: '$material_id' },
                    totalReceived: { $sum: '$quantityReceived' },
                    totalUsed: { $sum: '$quantityUsed' },
                    avgPrice: { $avg: '$price' },
                    siteBreakdown: {
                        $push: {
                            site_id: '$site_id',
                            source: '$source',
                            quantityReceived: '$quantityReceived',
                            quantityUsed: '$quantityUsed'
                        }
                    }
                }
            },
            {
                $addFields: {
                    remainingQuantity: { $subtract: ['$totalReceived', '$totalUsed'] },
                }
            },
            {
                $addFields: {
                    remainingValue: { $multiply: ['$remainingQuantity', { $ifNull: ['$avgPrice', 0] }] }
                }
            },
            { $project: { _id: 0 } },
            { $sort: { remainingQuantity: -1 } }
        ]);
        res.json(remainingMaterials);
    }
    catch (error) {
        console.error('Get remaining materials view error:', error);
        res.status(500).json({ error: 'Failed to fetch remaining materials view' });
    }
});
// Get single material remaining view
router.get('/remaining/:material', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const { material } = req.params;
        const company_id = req.user.company_id;
        const remainingMaterial = await MainStockRecord_1.default.aggregate([
            {
                $match: {
                    company_id,
                    materialName: { $regex: new RegExp(`^${material}$`, 'i') }
                }
            },
            {
                $group: {
                    _id: '$materialName',
                    materialName: { $first: '$materialName' },
                    material_id: { $first: '$material_id' },
                    totalReceived: { $sum: '$quantityReceived' },
                    totalUsed: { $sum: '$quantityUsed' },
                    avgPrice: { $avg: '$price' },
                    siteBreakdown: {
                        $push: {
                            site_id: '$site_id',
                            source: '$source',
                            quantityReceived: '$quantityReceived',
                            quantityUsed: '$quantityUsed'
                        }
                    }
                }
            },
            {
                $addFields: {
                    remainingQuantity: { $subtract: ['$totalReceived', '$totalUsed'] },
                    remainingValue: { $multiply: [{ $subtract: ['$totalReceived', '$totalUsed'] }, { $ifNull: ['$avgPrice', 0] }] }
                }
            },
            { $project: { _id: 0 } }
        ]);
        if (!remainingMaterial || remainingMaterial.length === 0) {
            res.status(404).json({ error: 'Material not found in remaining view' });
            return;
        }
        res.json(remainingMaterial[0]);
    }
    catch (error) {
        console.error('Get remaining material error:', error);
        res.status(500).json({ error: 'Failed to fetch remaining material' });
    }
});
// Get comprehensive stock summary (combines both views)
router.get('/summary', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        const [usedMaterials, remainingMaterials, totalRecords] = await Promise.all([
            MainStockRecord_1.default.aggregate([
                { $match: { company_id, quantityUsed: { $gt: 0 } } },
                {
                    $group: {
                        _id: '$materialName',
                        material: { $first: '$materialName' },
                        totalQuantityUsed: { $sum: '$quantityUsed' },
                        totalValue: { $sum: { $multiply: ['$quantityUsed', { $ifNull: ['$price', 0] }] } }
                    }
                }
            ]),
            MainStockRecord_1.default.aggregate([
                { $match: { company_id } },
                {
                    $group: {
                        _id: '$materialName',
                        material: { $first: '$materialName' },
                        remainingQuantity: { $sum: { $subtract: ['$quantityReceived', '$quantityUsed'] } },
                        remainingValue: { $sum: { $multiply: [{ $subtract: ['$quantityReceived', '$quantityUsed'] }, { $ifNull: ['$price', 0] }] } }
                    }
                }
            ]),
            MainStockRecord_1.default.countDocuments({ company_id }),
        ]);
        // Build summary
        const allMaterials = new Set([
            ...usedMaterials.map((um) => um.material),
            ...remainingMaterials.map((rm) => rm.material),
        ]);
        const summary = Array.from(allMaterials).map((material) => {
            const used = usedMaterials.find((u) => u.material === material);
            const remaining = remainingMaterials.find((r) => r.material === material);
            return {
                material,
                totalUsed: used?.totalQuantityUsed || 0,
                totalRemaining: remaining?.remainingQuantity || 0,
                totalValue: (used?.totalValue || 0) + (remaining?.remainingValue || 0),
            };
        });
        res.json({
            totalMaterials: allMaterials.size,
            totalRecords,
            summary,
        });
    }
    catch (error) {
        console.error('Get summary error:', error);
        res.status(500).json({ error: 'Failed to fetch summary' });
    }
});
// Trigger manual recalculation of views (for maintenance)
// Note: With Mongoose, views are computed on-the-fly via aggregations
// This endpoint now just returns a success message
router.post('/recalculate', auth_1.authenticateToken, auth_1.requireMainStockManager, async (req, res) => {
    try {
        const company_id = req.user.company_id;
        // Get count of materials in the system
        const materialsCount = await MainStockRecord_1.default.distinct('materialName', { company_id });
        res.json({
            message: 'Views are computed dynamically via aggregations. No recalculation needed.',
            uniqueMaterials: materialsCount.length,
        });
    }
    catch (error) {
        console.error('Recalculate views error:', error);
        res.status(500).json({ error: 'Failed to recalculate views' });
    }
});
exports.default = router;
//# sourceMappingURL=views.js.map