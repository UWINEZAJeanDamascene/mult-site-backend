import mongoose from 'mongoose';
import { MainStockRecord } from '../models/MainStockRecord';
import { StockMovement } from '../models/StockMovement';

/**
 * UsedMaterialsView - Aggregates total quantity used per material
 * Groups MainStockRecords by material and sums quantityUsed across all records
 * filtered by company
 */
export async function getUsedMaterialsView(company_id: string) {
  const pipeline = [
    {
      $match: {
        company_id,
        quantityUsed: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: '$materialName',
        material_id: { $first: '$material_id' },
        totalQuantityUsed: { $sum: '$quantityUsed' },
        avgPrice: { $avg: '$price' },
        totalValue: {
          $sum: {
            $multiply: ['$quantityUsed', { $ifNull: ['$price', 0] }],
          },
        },
        recordCount: { $sum: 1 },
        siteBreakdown: {
          $push: {
            site_id: '$site_id',
            source: '$source',
            quantityUsed: '$quantityUsed',
          },
        },
        lastRecord: { $last: '$$ROOT' },
      },
    },
    {
      $project: {
        _id: 0,
        materialName: '$_id',
        material_id: 1,
        totalQuantityUsed: 1,
        avgPrice: 1,
        totalValue: 1,
        recordCount: 1,
        siteBreakdown: 1,
        lastRecordId: '$lastRecord._id',
        updatedAt: new Date(),
      },
    },
    { $sort: { materialName: 1 as const } },
  ];

  return MainStockRecord.aggregate(pipeline);
}

/**
 * RemainingMaterialsView - Computes quantityReceived - quantityUsed per material
 * with total value. Includes price valuation.
 */
export async function getRemainingMaterialsView(company_id: string) {
  const pipeline = [
    {
      $match: {
        company_id,
      },
    },
    {
      $group: {
        _id: '$materialName',
        material_id: { $first: '$material_id' },
        totalReceived: { $sum: '$quantityReceived' },
        totalUsed: { $sum: '$quantityUsed' },
        remainingQuantity: {
          $sum: { $subtract: ['$quantityReceived', '$quantityUsed'] },
        },
        avgPrice: { $avg: '$price' },
        remainingValue: {
          $sum: {
            $multiply: [
              { $subtract: ['$quantityReceived', '$quantityUsed'] },
              { $ifNull: ['$price', 0] },
            ],
          },
        },
        siteBreakdown: {
          $push: {
            site_id: '$site_id',
            source: '$source',
            received: '$quantityReceived',
            used: '$quantityUsed',
            remaining: { $subtract: ['$quantityReceived', '$quantityUsed'] },
          },
        },
        lastRecord: { $last: '$$ROOT' },
      },
    },
    {
      $project: {
        _id: 0,
        materialName: '$_id',
        material_id: 1,
        totalReceived: 1,
        totalUsed: 1,
        remainingQuantity: 1,
        avgPrice: 1,
        remainingValue: 1,
        siteBreakdown: 1,
        lastRecordId: '$lastRecord._id',
        updatedAt: new Date(),
      },
    },
    { $sort: { materialName: 1 as const } },
  ];

  return MainStockRecord.aggregate(pipeline);
}

/**
 * Get single material used view
 */
export async function getSingleUsedMaterialView(company_id: string, materialName: string) {
  const pipeline = [
    {
      $match: {
        company_id,
        materialName: { $regex: new RegExp(`^${materialName}$`, 'i') },
        quantityUsed: { $gt: 0 },
      },
    },
    {
      $group: {
        _id: '$materialName',
        material_id: { $first: '$material_id' },
        totalQuantityUsed: { $sum: '$quantityUsed' },
        avgPrice: { $avg: '$price' },
        totalValue: {
          $sum: {
            $multiply: ['$quantityUsed', { $ifNull: ['$price', 0] }],
          },
        },
        recordCount: { $sum: 1 },
        siteBreakdown: {
          $push: {
            site_id: '$site_id',
            source: '$source',
            quantityUsed: '$quantityUsed',
          },
        },
        lastRecord: { $last: '$$ROOT' },
      },
    },
    {
      $project: {
        _id: 0,
        materialName: '$_id',
        material_id: 1,
        totalQuantityUsed: 1,
        avgPrice: 1,
        totalValue: 1,
        recordCount: 1,
        siteBreakdown: 1,
        lastRecordId: '$lastRecord._id',
        updatedAt: new Date(),
      },
    },
  ];

  const result = await MainStockRecord.aggregate(pipeline);
  return result[0] || null;
}

/**
 * Get single material remaining view
 */
export async function getSingleRemainingMaterialView(company_id: string, materialName: string) {
  const pipeline = [
    {
      $match: {
        company_id,
        materialName: { $regex: new RegExp(`^${materialName}$`, 'i') },
      },
    },
    {
      $group: {
        _id: '$materialName',
        material_id: { $first: '$material_id' },
        totalReceived: { $sum: '$quantityReceived' },
        totalUsed: { $sum: '$quantityUsed' },
        remainingQuantity: {
          $sum: { $subtract: ['$quantityReceived', '$quantityUsed'] },
        },
        avgPrice: { $avg: '$price' },
        remainingValue: {
          $sum: {
            $multiply: [
              { $subtract: ['$quantityReceived', '$quantityUsed'] },
              { $ifNull: ['$price', 0] },
            ],
          },
        },
        siteBreakdown: {
          $push: {
            site_id: '$site_id',
            source: '$source',
            received: '$quantityReceived',
            used: '$quantityUsed',
            remaining: { $subtract: ['$quantityReceived', '$quantityUsed'] },
          },
        },
        lastRecord: { $last: '$$ROOT' },
      },
    },
    {
      $project: {
        _id: 0,
        materialName: '$_id',
        material_id: 1,
        totalReceived: 1,
        totalUsed: 1,
        remainingQuantity: 1,
        avgPrice: 1,
        remainingValue: 1,
        siteBreakdown: 1,
        lastRecordId: '$lastRecord._id',
        updatedAt: new Date(),
      },
    },
  ];

  const result = await MainStockRecord.aggregate(pipeline);
  return result[0] || null;
}

/**
 * Comprehensive stock summary
 */
export async function getStockSummary(company_id: string) {
  const [usedMaterials, remainingMaterials, totalRecords, pendingPricing] = await Promise.all([
    getUsedMaterialsView(company_id),
    getRemainingMaterialsView(company_id),
    MainStockRecord.countDocuments({ company_id }),
    MainStockRecord.countDocuments({ company_id, status: 'pending_price' }),
  ]);

  // Build summary combining both views
  const allMaterials = new Set([
    ...usedMaterials.map((u: any) => u.materialName),
    ...remainingMaterials.map((r: any) => r.materialName),
  ]);

  const summary = Array.from(allMaterials).map((materialName) => {
    const used = usedMaterials.find((u: any) => u.materialName === materialName);
    const remaining = remainingMaterials.find((r: any) => r.materialName === materialName);

    return {
      materialName,
      material_id: used?.material_id || remaining?.material_id,
      totalUsed: used?.totalQuantityUsed || 0,
      totalRemaining: remaining?.remainingQuantity || 0,
      totalValue: (used?.totalValue || 0) + (remaining?.remainingValue || 0),
    };
  });

  return {
    totalMaterials: allMaterials.size,
    totalRecords,
    pendingPricing,
    summary: summary.sort((a, b) => a.materialName.localeCompare(b.materialName)),
  };
}

/**
 * Service to record stock movement and update derived views
 * This should be called before updating MainStockRecord quantities
 */
export async function recordStockMovement(data: {
  mainStockRecord_id: string;
  site_id?: string;
  material_id?: string;
  movementType: string;
  quantity: number;
  previousQuantityUsed: number;
  previousQuantityReceived: number;
  newQuantityUsed: number;
  newQuantityReceived: number;
  performedBy: string;
  company_id: string;
  notes?: string;
}) {
  // 1. Write StockMovement first
  const movement = await StockMovement.create({
    ...data,
    date: new Date(),
  });

  // 2. Views are computed on-demand via aggregation, no separate update needed
  // The getUsedMaterialsView and getRemainingMaterialsView will reflect
  // the latest data on next query

  return movement;
}
