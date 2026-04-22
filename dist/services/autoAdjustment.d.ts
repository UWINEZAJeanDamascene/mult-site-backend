import type { IMainStockRecordDocument } from '../models/MainStockRecord';
/**
 * Auto Adjustment Service
 * Updates derived views whenever a stock movement occurs
 * - Views are now computed on-demand via aggregation (see viewsAggregation.ts)
 * - This file now mainly handles site-to-mainstock sync
 */
export declare function processStockMovement(recordId: string): Promise<void>;
/**
 * Sync a site record to main stock (triggered on site record create/update)
 * This is now handled by the SiteRecord post-save middleware,
 * but kept here for manual sync if needed.
 */
export declare function syncSiteRecordToMainStock(siteRecordId: string): Promise<IMainStockRecordDocument>;
//# sourceMappingURL=autoAdjustment.d.ts.map