import { MainStockRecord, SiteRecord, Site } from '../models';
import type { IMainStockRecordDocument } from '../models/MainStockRecord';
import type { RecordSource } from '../models/MainStockRecord';
import mongoose from 'mongoose';

/**
 * Auto Adjustment Service
 * Updates derived views whenever a stock movement occurs
 * - Views are now computed on-demand via aggregation (see viewsAggregation.ts)
 * - This file now mainly handles site-to-mainstock sync
 */

export async function processStockMovement(recordId: string): Promise<void> {
  // Views are computed on-demand via aggregation pipelines
  // No need to maintain separate view collections
  // The getUsedMaterialsView() and getRemainingMaterialsView() in viewsAggregation.ts
  // will always return fresh data on next query
  console.log(`Stock movement processed for record ${recordId}`);
}

/**
 * Sync a site record to main stock (triggered on site record create/update)
 * This is now handled by the SiteRecord post-save middleware,
 * but kept here for manual sync if needed.
 */
export async function syncSiteRecordToMainStock(siteRecordId: string): Promise<IMainStockRecordDocument> {
  const siteRecord = await SiteRecord.findById(siteRecordId);

  if (!siteRecord) {
    throw new Error('Site record not found');
  }

  // Get site name
  const site = await Site.findById(siteRecord.site_id);
  const siteName = site?.name || 'Unknown';

  // Check if there's an existing main stock record for this site record
  const existingMainRecord = await MainStockRecord.findOne({
    siteRecord_id: new mongoose.Types.ObjectId(siteRecordId),
  });

  const mainStockData: any = {
    source: 'site' as RecordSource,
    site_id: siteRecord.site_id,
    siteRecord_id: siteRecord._id,
    material_id: siteRecord.material_id,
    materialName: siteRecord.materialName,
    quantityReceived: siteRecord.quantityReceived,
    quantityUsed: siteRecord.quantityUsed,
    date: siteRecord.date,
    notes: siteRecord.notes,
    recordedBy: siteRecord.recordedBy,
    company_id: siteRecord.company_id,
    // Price is null here - main manager will add it later
    price: existingMainRecord?.price ?? null,
    totalValue: existingMainRecord?.price != null
      ? siteRecord.quantityUsed * existingMainRecord.price
      : null,
  };

  let mainRecord: IMainStockRecordDocument;

  if (existingMainRecord) {
    // Update existing main stock record
    Object.assign(existingMainRecord, mainStockData);
    mainRecord = await existingMainRecord.save();
  } else {
    // Create new main stock record
    mainRecord = await MainStockRecord.create(mainStockData);

    // Update site record with sync reference
    siteRecord.syncedToMainStock = true;
    siteRecord.mainStockEntryId = mainRecord._id as mongoose.Types.ObjectId;
    await siteRecord.save();
  }

  // Trigger auto-adjustment for derived views
  await processStockMovement(mainRecord._id.toString());

  return mainRecord;
}
