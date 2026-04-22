import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { ActionLog, ActionType, ResourceType } from '../models/ActionLog';
import { UserRole } from '../models/User';
import mongoose from 'mongoose';

const router = Router();

console.log('Action logs routes loaded');

// Get all action logs (main managers only)
router.get('/', authenticateToken, async (req, res): Promise<void> => {
  try {
    // Only main managers can view action logs
    if (req.user!.role !== UserRole.MAIN_MANAGER) {
      res.status(403).json({ error: 'Access denied. Main manager role required.' });
      return;
    }

    const companyId = req.user!.company_id;
    const {
      page = '1',
      limit = '20',
      action,
      resource,
      userId,
      startDate,
      endDate,
      search,
    } = req.query;

    const pageNum = parseInt(page as string);
    const limitNum = parseInt(limit as string);
    const skip = (pageNum - 1) * limitNum;

    // Build query
    let query: any = { companyId };

    if (action && Object.values(ActionType).includes(action as ActionType)) {
      query.action = action;
    }

    if (resource && Object.values(ResourceType).includes(resource as ResourceType)) {
      query.resource = resource;
    }

    if (userId && mongoose.Types.ObjectId.isValid(userId as string)) {
      query.userId = new mongoose.Types.ObjectId(userId as string);
    }

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate as string);
      if (endDate) query.timestamp.$lte = new Date(endDate as string);
    }

    if (search) {
      query.$or = [
        { description: { $regex: search, $options: 'i' } },
        { userName: { $regex: search, $options: 'i' } },
        { userEmail: { $regex: search, $options: 'i' } },
        { resourceName: { $regex: search, $options: 'i' } },
      ];
    }

    const [logs, total] = await Promise.all([
      ActionLog.find(query)
        .sort({ timestamp: -1 })
        .skip(skip)
        .limit(limitNum)
        .lean(),
      ActionLog.countDocuments(query),
    ]);

    res.json({
      logs: logs.map((log) => ({
        id: log._id.toString(),
        userId: log.userId.toString(),
        userName: log.userName,
        userEmail: log.userEmail,
        userRole: log.userRole,
        action: log.action,
        resource: log.resource,
        resourceId: log.resourceId,
        resourceName: log.resourceName,
        description: log.description,
        details: log.details,
        ipAddress: log.ipAddress,
        timestamp: log.timestamp,
      })),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (error) {
    console.error('Get action logs error:', error);
    res.status(500).json({ error: 'Failed to fetch action logs' });
  }
});

// Get action log statistics (main managers only)
router.get('/stats', authenticateToken, async (req, res): Promise<void> => {
  try {
    if (req.user!.role !== UserRole.MAIN_MANAGER) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const companyId = req.user!.company_id;
    const { startDate, endDate } = req.query;

    let dateFilter: any = {};
    if (startDate || endDate) {
      dateFilter.timestamp = {};
      if (startDate) dateFilter.timestamp.$gte = new Date(startDate as string);
      if (endDate) dateFilter.timestamp.$lte = new Date(endDate as string);
    }

    const [actionStats, resourceStats, recentActivity, totalCount] = await Promise.all([
      // Actions by type
      ActionLog.aggregate([
        { $match: { companyId, ...dateFilter } },
        { $group: { _id: '$action', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Actions by resource
      ActionLog.aggregate([
        { $match: { companyId, ...dateFilter } },
        { $group: { _id: '$resource', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
      ]),
      // Recent activity (top users)
      ActionLog.aggregate([
        { $match: { companyId, ...dateFilter } },
        {
          $group: {
            _id: '$userId',
            userName: { $first: '$userName' },
            userEmail: { $first: '$userEmail' },
            count: { $sum: 1 },
          },
        },
        { $sort: { count: -1 } },
        { $limit: 5 },
      ]),
      // Total count
      ActionLog.countDocuments({ companyId, ...dateFilter }),
    ]);

    res.json({
      actionStats: actionStats.map((s) => ({ action: s._id, count: s.count })),
      resourceStats: resourceStats.map((s) => ({ resource: s._id, count: s.count })),
      topUsers: recentActivity.map((u) => ({
        userId: u._id.toString(),
        userName: u.userName,
        userEmail: u.userEmail,
        actionCount: u.count,
      })),
      totalActions: totalCount,
    });
  } catch (error) {
    console.error('Get action log stats error:', error);
    res.status(500).json({ error: 'Failed to fetch statistics' });
  }
});

// Get single action log details (main managers only)
router.get('/:id', authenticateToken, async (req, res): Promise<void> => {
  try {
    if (req.user!.role !== UserRole.MAIN_MANAGER) {
      res.status(403).json({ error: 'Access denied' });
      return;
    }

    const { id } = req.params;
    const companyId = req.user!.company_id;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      res.status(400).json({ error: 'Invalid log ID' });
      return;
    }

    const log = await ActionLog.findOne({
      _id: new mongoose.Types.ObjectId(id),
      companyId,
    }).lean();

    if (!log) {
      res.status(404).json({ error: 'Log not found' });
      return;
    }

    res.json({
      id: log._id.toString(),
      userId: log.userId.toString(),
      userName: log.userName,
      userEmail: log.userEmail,
      userRole: log.userRole,
      action: log.action,
      resource: log.resource,
      resourceId: log.resourceId,
      resourceName: log.resourceName,
      description: log.description,
      details: log.details,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      timestamp: log.timestamp,
    });
  } catch (error) {
    console.error('Get action log details error:', error);
    res.status(500).json({ error: 'Failed to fetch log details' });
  }
});

export default router;
