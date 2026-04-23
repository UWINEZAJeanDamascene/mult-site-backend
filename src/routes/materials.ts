import { Router } from 'express';
import { authenticateToken, requireMainStockManager } from '../middleware/auth';
import { Material, ActionType, ResourceType } from '../models';
import { ActionLogService } from '../services/actionLogService';
import mongoose from 'mongoose';

const router = Router();

// Search materials
router.get('/search', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { q } = req.query;
    const company_id = req.user!.company_id;

    if (!q || typeof q !== 'string' || q.length < 2) {
      res.json([]);
      return;
    }

    const materials = await Material.find({
      company_id,
      name: { $regex: q, $options: 'i' },
    }).limit(20);

    res.json(materials.map(material => ({
      _id: material._id.toString(),
      name: material.name,
      unit: material.unit,
    })));
  } catch (error) {
    console.error('Search materials error:', error);
    res.status(500).json({ error: 'Failed to search materials' });
  }
});

// Get all materials
router.get('/', authenticateToken, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;
    const materials = await Material.find({ company_id }).sort({ name: 1 });

    res.json(materials.map(material => ({
      _id: material._id.toString(),
      name: material.name,
      unit: material.unit,
      description: material.description,
      company_id: material.company_id,
      isActive: material.isActive,
      createdAt: material.createdAt,
    })));
  } catch (error) {
    console.error('Get materials error:', error);
    res.status(500).json({ error: 'Failed to fetch materials' });
  }
});

// Get single material
router.get('/:id', authenticateToken, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const company_id = req.user!.company_id;
    const idStr = Array.isArray(id) ? id[0] : id;

    const material = await Material.findOne({
      _id: new mongoose.Types.ObjectId(idStr),
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
  } catch (error) {
    console.error('Get material error:', error);
    res.status(500).json({ error: 'Failed to fetch material' });
  }
});

// Create material (main manager only)
router.post('/', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { name, unit, description } = req.body;
    const company_id = req.user!.company_id;

    if (!name || !unit) {
      res.status(400).json({ error: 'Name and unit are required' });
      return;
    }

    // Check if material already exists
    const existingMaterial = await Material.findOne({
      name: { $regex: new RegExp(`^${name}$`, 'i') },
      company_id,
    });

    if (existingMaterial) {
      res.status(409).json({ error: 'Material with this name already exists' });
      return;
    }

    const material = await Material.create({
      name,
      unit,
      description,
      company_id,
      isActive: true,
    });

    // Log material creation
    await ActionLogService.logMaterialCreate(req, material._id.toString(), material.name);

    res.status(201).json({
      _id: material._id.toString(),
      name: material.name,
      unit: material.unit,
      description: material.description,
      company_id: material.company_id,
      isActive: material.isActive,
      createdAt: material.createdAt,
    });
  } catch (error) {
    console.error('Create material error:', error);
    res.status(500).json({ error: 'Failed to create material' });
  }
});

// Update material (main manager only)
router.put('/:id', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, unit, description } = req.body;
    const company_id = req.user!.company_id;
    const idStr = Array.isArray(id) ? id[0] : id;

    const updateData: any = {};
    if (name) updateData.name = name;
    if (unit) updateData.unit = unit;
    if (description !== undefined) updateData.description = description;

    const material = await Material.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(idStr), company_id },
      { $set: updateData },
      { returnDocument: 'after' }
    );

    if (!material) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    // Log material update
    await ActionLogService.logMaterialUpdate(req, material._id.toString(), material.name);

    res.json({
      _id: material._id.toString(),
      name: material.name,
      unit: material.unit,
      description: material.description,
      company_id: material.company_id,
      isActive: material.isActive,
      createdAt: material.createdAt,
    });
  } catch (error) {
    console.error('Update material error:', error);
    res.status(500).json({ error: 'Failed to update material' });
  }
});

// Toggle material active status (main manager only)
router.patch('/:id/active', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { isActive } = req.body;
    const company_id = req.user!.company_id;
    const idStr = Array.isArray(id) ? id[0] : id;

    const material = await Material.findOneAndUpdate(
      { _id: new mongoose.Types.ObjectId(idStr), company_id },
      { $set: { isActive } },
      { returnDocument: 'after' }
    );

    if (!material) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    // Log material status change (update)
    await ActionLogService.logMaterialUpdate(req, material._id.toString(), material.name);

    res.json({
      _id: material._id.toString(),
      name: material.name,
      unit: material.unit,
      description: material.description,
      company_id: material.company_id,
      isActive: material.isActive,
      createdAt: material.createdAt,
    });
  } catch (error) {
    console.error('Toggle material active error:', error);
    res.status(500).json({ error: 'Failed to update material status' });
  }
});

// Delete material (main manager only)
router.delete('/:id', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const company_id = req.user!.company_id;
    const idStr = Array.isArray(id) ? id[0] : id;

    const material = await Material.findOneAndDelete({
      _id: new mongoose.Types.ObjectId(idStr),
      company_id,
    });

    if (!material) {
      res.status(404).json({ error: 'Material not found' });
      return;
    }

    // Log material deletion
    await ActionLogService.logFromRequest(
      req,
      ActionType.DELETE,
      ResourceType.MATERIAL,
      `Deleted material: ${material.name}`,
      {
        resourceId: material._id.toString(),
        resourceName: material.name,
      }
    );

    res.json({ message: 'Material deleted successfully' });
  } catch (error) {
    console.error('Delete material error:', error);
    res.status(500).json({ error: 'Failed to delete material' });
  }
});

export default router;
