import { MainStockRecord, IMainStockRecordDocument } from '../models/MainStockRecord';
import { StockMovement, MovementType } from '../models/StockMovement';
import mongoose from 'mongoose';

/**
 * Update MainStockRecord quantities with StockMovement logging
 * Every change writes a StockMovement document first, then updates the record
 */
export async function updateStockQuantities(
  mainStockRecordId: string,
  updates: {
    quantityReceived?: number;
    quantityUsed?: number;
  },
  context: {
    performedBy: string;
    company_id: string;
    site_id?: string;
    material_id?: string;
    notes?: string;
  }
): Promise<IMainStockRecordDocument> {
  const record = await MainStockRecord.findById(mainStockRecordId);
  if (!record) {
    throw new Error('MainStockRecord not found');
  }

  const previousQtyReceived = record.quantityReceived;
  const previousQtyUsed = record.quantityUsed;

  const newQtyReceived = updates.quantityReceived ?? previousQtyReceived;
  const newQtyUsed = updates.quantityUsed ?? previousQtyUsed;

  // Determine movement type
  let movementType = MovementType.ADJUSTMENT;
  if (newQtyReceived > previousQtyReceived) {
    movementType = MovementType.RECEIVED;
  } else if (newQtyUsed > previousQtyUsed) {
    movementType = MovementType.USED;
  }

  // 1. Write StockMovement first
  await StockMovement.create({
    mainStockRecord_id: new mongoose.Types.ObjectId(mainStockRecordId),
    site_id: context.site_id ? new mongoose.Types.ObjectId(context.site_id) : undefined,
    material_id: context.material_id ? new mongoose.Types.ObjectId(context.material_id) : record.material_id,
    movementType,
    quantity: Math.max(
      Math.abs(newQtyReceived - previousQtyReceived),
      Math.abs(newQtyUsed - previousQtyUsed)
    ),
    previousQuantityUsed: previousQtyUsed,
    previousQuantityReceived: previousQtyReceived,
    newQuantityUsed: newQtyUsed,
    newQuantityReceived: newQtyReceived,
    performedBy: new mongoose.Types.ObjectId(context.performedBy),
    company_id: context.company_id,
    notes: context.notes || `Quantity update: ${movementType}`,
    date: new Date(),
  });

  // 2. Update MainStockRecord
  record.quantityReceived = newQtyReceived;
  record.quantityUsed = newQtyUsed;
  await record.save();

  return record;
}

/**
 * Set price on a MainStockRecord with movement logging
 */
export async function setStockPrice(
  mainStockRecordId: string,
  price: number,
  context: {
    performedBy: string;
    company_id: string;
    notes?: string;
  }
): Promise<IMainStockRecordDocument> {
  const record = await MainStockRecord.findById(mainStockRecordId);
  if (!record) {
    throw new Error('MainStockRecord not found');
  }

  const previousPrice = record.price;

  // Log as adjustment movement
  await StockMovement.create({
    mainStockRecord_id: new mongoose.Types.ObjectId(mainStockRecordId),
    material_id: record.material_id,
    movementType: MovementType.ADJUSTMENT,
    quantity: 0,
    previousQuantityUsed: record.quantityUsed,
    previousQuantityReceived: record.quantityReceived,
    newQuantityUsed: record.quantityUsed,
    newQuantityReceived: record.quantityReceived,
    performedBy: new mongoose.Types.ObjectId(context.performedBy),
    company_id: context.company_id,
    notes: context.notes || `Price set: ${previousPrice} -> ${price}`,
    date: new Date(),
  });

  // Update price (totalValue computed via pre-save hook)
  record.price = price;
  await record.save();

  return record;
}

/**
 * Bulk set prices on site-sourced records
 */
export async function bulkSetPrices(
  updates: { mainStockRecordId: string; price: number }[],
  context: {
    performedBy: string;
    company_id: string;
  }
): Promise<{ updated: number; errors: string[] }> {
  const errors: string[] = [];
  let updated = 0;

  for (const { mainStockRecordId, price } of updates) {
    try {
      await setStockPrice(mainStockRecordId, price, {
        performedBy: context.performedBy,
        company_id: context.company_id,
        notes: 'Bulk price update',
      });
      updated++;
    } catch (error) {
      errors.push(`Failed to update ${mainStockRecordId}: ${(error as Error).message}`);
    }
  }

  return { updated, errors };
}
