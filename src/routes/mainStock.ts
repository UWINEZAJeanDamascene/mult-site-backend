import { Router } from 'express';
import { authenticateToken, requireMainStockManager } from '../middleware/auth';
import { broadcastToClients } from '../websocket/server';
import MainStockRecord, { RecordSource, RecordStatus } from '../models/MainStockRecord';
import StockMovement from '../models/StockMovement';
import Site from '../models/Site';
import { ActionLogService } from '../services/actionLogService';
import { ActionType, ResourceType } from '../models/ActionLog';
import { NotificationService } from '../services/notificationService';
import mongoose from 'mongoose';

const router = Router();

// Get all main stock records (main stock manager only)
router.get('/', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { siteId, materialName, source, status, startDate, endDate, page = '1', limit = '10' } = req.query;
    const company_id = req.user!.company_id;

    let where: any = { company_id };

    if (siteId) where.site_id = new mongoose.Types.ObjectId(siteId as string);
    if (materialName) where.materialName = { $regex: materialName, $options: 'i' };
    if (source && source !== 'all') where.source = source;
    if (status && status !== 'all') where.status = status;

    if (startDate || endDate) {
      where.date = {};
      if (startDate) where.date.$gte = new Date(startDate as string);
      if (endDate) where.date.$lte = new Date(endDate as string);
    }

    const skip = (parseInt(page as string) - 1) * parseInt(limit as string);
    const recordsLimit = parseInt(limit as string);

    const records = await MainStockRecord.find(where)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(recordsLimit);

    const total = await MainStockRecord.countDocuments(where);
    const totalPages = Math.ceil(total / recordsLimit);

    res.json({
      records,
      total,
      page: parseInt(page as string),
      totalPages,
    });
  } catch (error) {
    console.error('Get main stock records error:', error);
    res.status(500).json({ error: 'Failed to fetch main stock records' });
  }
});

// Dashboard stats endpoint
router.get('/dashboard-stats', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;

    const [pendingCount, activeSites, directRecords, totalStockValue] = await Promise.all([
      MainStockRecord.countDocuments({ company_id, status: RecordStatus.PENDING_PRICE }),
      // Count active sites for this company
      Site.countDocuments({ company_id, isActive: true }),
      MainStockRecord.countDocuments({ 
        company_id, 
        source: RecordSource.DIRECT,
        date: { $gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) }
      }),
      MainStockRecord.aggregate([
        { $match: { company_id, totalValue: { $ne: null } } },
        { $group: { _id: null, total: { $sum: '$totalValue' } } }
      ]),
    ]);

    res.json({
      totalStockValue: totalStockValue[0]?.total || 0,
      pendingPricingCount: pendingCount,
      activeSitesCount: activeSites,
      directRecordsThisMonth: directRecords,
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    res.status(500).json({ error: 'Failed to fetch dashboard stats' });
  }
});

// Top materials by quantity received
router.get('/top-materials', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;
    const limit = parseInt(req.query.limit as string) || 10;

    const materials = await MainStockRecord.aggregate([
      { $match: { company_id } },
      { $group: { _id: '$materialName', quantityReceived: { $sum: '$quantityReceived' } } },
      { $sort: { quantityReceived: -1 } },
      { $limit: limit },
      { $project: { materialName: '$_id', quantityReceived: 1, _id: 0 } },
    ]);

    res.json(materials);
  } catch (error) {
    console.error('Top materials error:', error);
    res.status(500).json({ error: 'Failed to fetch top materials' });
  }
});

// Stock movements over time (for line chart)
router.get('/movements', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;
    const days = parseInt(req.query.days as string) || 30;
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const movements = await MainStockRecord.aggregate([
      { $match: { company_id, date: { $gte: startDate } } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$date' } },
          received: { $sum: '$quantityReceived' },
          used: { $sum: '$quantityUsed' },
        },
      },
      { $sort: { _id: 1 } },
      { $project: { date: '$_id', received: 1, used: 1, _id: 0 } },
    ]);

    // Fill in missing dates with zeros
    const result = [];
    for (let i = 0; i < days; i++) {
      const d = new Date();
      d.setDate(d.getDate() - (days - 1 - i));
      const dateStr = d.toISOString().split('T')[0];
      const existing = movements.find(m => m.date === dateStr);
      result.push({
        date: dateStr,
        received: existing?.received || 0,
        used: existing?.used || 0,
      });
    }

    res.json(result);
  } catch (error) {
    console.error('Stock movements error:', error);
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
});

// Get single main stock record
router.get('/:id', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;

    const record = await MainStockRecord.findById(id);

    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    res.json(record);
  } catch (error) {
    console.error('Get main stock record error:', error);
    res.status(500).json({ error: 'Failed to fetch main stock record' });
  }
});

// Create direct main stock record (non-site purchase)
router.post('/direct', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const {
      materialName,
      material_id,
      quantityReceived,
      quantityUsed,
      price,
      date,
      notes,
    } = req.body;

    if (!materialName || !date) {
      res.status(400).json({
        error: 'Material and date are required',
      });
      return;
    }

    // Calculate total value if price is provided
    const totalValue = price != null && quantityReceived != null
      ? price * quantityReceived
      : null;

    const record = new MainStockRecord({
      source: RecordSource.DIRECT,
      materialName,
      material_id: material_id ? new mongoose.Types.ObjectId(material_id) : undefined,
      quantityReceived: quantityReceived || 0,
      quantityUsed: quantityUsed || 0,
      price: price || null,
      totalValue,
      date: new Date(date),
      status: RecordStatus.DIRECT,
      notes,
      recordedBy: new mongoose.Types.ObjectId(req.user!.id),
      company_id: req.user!.company_id,
    });

    await record.save();

    // Log main stock record creation (pass minimal details)
    await ActionLogService.logFromRequest(
      req,
      ActionType.CREATE,
      ResourceType.MAIN_STOCK,
      `Created main stock record: ${record.materialName}`,
      {
        resourceId: record._id.toString(),
        resourceName: record.materialName,
        details: {
          quantityReceived: record.quantityReceived,
          quantityUsed: record.quantityUsed,
          price: record.price,
          totalValue: record.totalValue,
          date: record.date,
          notes: record.notes,
          source: record.source,
          siteId: record.site_id,
        },
      }
    );

    // Broadcast update
    broadcastToClients({
      type: 'MAIN_STOCK_UPDATED',
      payload: { mainStockRecord: record },
      timestamp: new Date(),
    });

    res.status(201).json(record);
  } catch (error) {
    console.error('Create main stock record error:', error);
    res.status(500).json({ error: 'Failed to create main stock record' });
  }
});

// Update price for a main stock record (PATCH endpoint for inline editing)
router.patch('/:id/price', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    if (price === undefined || price === null || price < 0) {
      res.status(400).json({ error: 'Valid price is required' });
      return;
    }

    const record = await MainStockRecord.findById(id);

    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    const previousPrice = record.price;
    const totalValue = price * record.quantityReceived;

    // Update the record
    record.price = price;
    record.totalValue = totalValue;
    
    // Update status if it was pending price
    if (record.status === RecordStatus.PENDING_PRICE) {
      record.status = RecordStatus.PRICED;
    }

    await record.save();

    // Log price update
    await ActionLogService.logPriceUpdate(req, record._id.toString(), record.materialName, previousPrice || null, price);

    // Broadcast update
    broadcastToClients({
      type: 'MAIN_STOCK_UPDATED',
      payload: { mainStockRecord: record, priceUpdate: { previousPrice, newPrice: price } },
      timestamp: new Date(),
    });

    res.json(record);
  } catch (error) {
    console.error('Update price error:', error);
    res.status(500).json({ error: 'Failed to update price' });
  }
});

// Mark record as received (change status from DIRECT to PRICED)
router.patch('/:id/receive', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const { price } = req.body;

    const record = await MainStockRecord.findById(id);
    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    // Verify ownership
    if (record.company_id.toString() !== req.user!.company_id) {
      res.status(403).json({ error: 'Not authorized to update this record' });
      return;
    }

    // Update status to PRICED
    record.status = RecordStatus.PRICED;
    
    // Optionally set price if provided
    if (price && price > 0) {
      record.price = price;
      record.totalValue = record.quantityReceived * price;
    }

    await record.save();

    // Log the action
    await ActionLogService.logFromRequest(req, ActionType.UPDATE, ResourceType.MAIN_STOCK, 
      `Marked record as received: ${record.materialName}`, {
      resourceId: record._id.toString(),
      resourceName: record.materialName,
    });

    // Broadcast update
    broadcastToClients({
      type: 'MAIN_STOCK_UPDATED',
      payload: { mainStockRecord: record },
      timestamp: new Date(),
    });

    res.json(record);
  } catch (error) {
    console.error('Mark as received error:', error);
    res.status(500).json({ error: 'Failed to mark record as received' });
  }
});

// Update main stock record (full update)
router.put('/:id', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const {
      materialName,
      quantityReceived,
      quantityUsed,
      price,
      date,
      status,
      notes,
    } = req.body;

    const record = await MainStockRecord.findById(id);

    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    // Build updateData for logging
    const updateData: any = {};

    // Update fields and track what changed
    if (materialName) {
      record.materialName = materialName;
      updateData.materialName = materialName;
    }
    if (quantityReceived !== undefined) {
      record.quantityReceived = quantityReceived;
      updateData.quantityReceived = quantityReceived;
    }
    if (quantityUsed !== undefined) {
      record.quantityUsed = quantityUsed;
      updateData.quantityUsed = quantityUsed;
    }
    if (price !== undefined) {
      record.price = price;
      updateData.price = price;
    }
    if (status) {
      record.status = status;
      updateData.status = status;
    }
    if (notes !== undefined) {
      record.notes = notes;
      updateData.notes = notes;
    }
    if (date) {
      record.date = new Date(date);
      updateData.date = date;
    }

    // Recalculate total value
    if (record.price != null && record.quantityReceived != null) {
      record.totalValue = record.price * record.quantityReceived;
    }

    await record.save();

    // Log main stock record update
    await ActionLogService.logFromRequest(
      req,
      ActionType.UPDATE,
      ResourceType.MAIN_STOCK,
      `Updated main stock record: ${record.materialName}`,
      {
        resourceId: record._id.toString(),
        resourceName: record.materialName,
        details: updateData,
      }
    );

    // Broadcast update
    broadcastToClients({
      type: 'MAIN_STOCK_UPDATED',
      payload: { mainStockRecord: record },
      timestamp: new Date(),
    });

    res.json(record);
  } catch (error) {
    console.error('Update main stock record error:', error);
    res.status(500).json({ error: 'Failed to update main stock record' });
  }
});

// Delete main stock record
router.delete('/:id', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;

    const record = await MainStockRecord.findByIdAndDelete(id);

    if (!record) {
      res.status(404).json({ error: 'Record not found' });
      return;
    }

    // Log main stock record deletion
    await ActionLogService.logFromRequest(
      req,
      ActionType.DELETE,
      ResourceType.MAIN_STOCK,
      `Deleted main stock record: ${record.materialName}`,
      {
        resourceId: record._id.toString(),
        resourceName: record.materialName,
      }
    );

    // Broadcast update - views will need to recalculate
    broadcastToClients({
      type: 'MAIN_STOCK_UPDATED',
      payload: { deletedRecordId: id },
      timestamp: new Date(),
    });

    res.json({ message: 'Record deleted successfully' });
  } catch (error) {
    console.error('Delete main stock record error:', error);
    res.status(500).json({ error: 'Failed to delete main stock record' });
  }
});

// Get site-sourced records that need pricing (price is null)
router.get('/pending-pricing/all', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const company_id = req.user!.company_id;

    const records = await MainStockRecord.find({
      company_id,
      source: RecordSource.SITE,
      status: RecordStatus.PENDING_PRICE,
    })
      .sort({ createdAt: -1 })
      .populate('site_id', 'name');

    res.json(records);
  } catch (error) {
    console.error('Get pending pricing records error:', error);
    res.status(500).json({ error: 'Failed to fetch pending pricing records' });
  }
});

// Bulk add prices to site records
router.post('/bulk-price', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { updates } = req.body as { updates: { id: string; price: number }[] };

    if (!updates || !Array.isArray(updates) || updates.length === 0) {
      res.status(400).json({ error: 'Updates array is required' });
      return;
    }

    const results = [];
    for (const { id, price } of updates) {
      const record = await MainStockRecord.findById(id);
      if (record) {
        const previousPrice: number | null = record.price ?? null;
        const quantityReceived = record.quantityReceived || 0;
        const totalValue = price * quantityReceived;

        record.price = price;
        record.totalValue = totalValue;
        record.status = RecordStatus.PRICED;

        await record.save();

        // Log individual price update
        await ActionLogService.logPriceUpdate(req, record._id.toString(), record.materialName, previousPrice, price);

        results.push({ id, price, totalValue });
      }
    }

    // Broadcast bulk update
    broadcastToClients({
      type: 'MAIN_STOCK_UPDATED',
      payload: { bulkPriceUpdate: results },
      timestamp: new Date(),
    });

    res.json({ message: 'Prices updated successfully', updated: results.length });
  } catch (error) {
    console.error('Bulk price update error:', error);
    res.status(500).json({ error: 'Failed to update prices' });
  }
});

// Get stock movements for a specific record
router.get('/:id/movements', authenticateToken, requireMainStockManager, async (req, res): Promise<void> => {
  try {
    const { id } = req.params;
    const idStr = Array.isArray(id) ? id[0] : id;

    const movements = await StockMovement.find({
      mainStock_id: new mongoose.Types.ObjectId(idStr),
    }).sort({ date: -1 });

    res.json(movements);
  } catch (error) {
    console.error('Get stock movements error:', error);
    res.status(500).json({ error: 'Failed to fetch stock movements' });
  }
});

export default router;
