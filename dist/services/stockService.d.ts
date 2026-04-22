import { IMainStockRecordDocument } from '../models/MainStockRecord';
/**
 * Update MainStockRecord quantities with StockMovement logging
 * Every change writes a StockMovement document first, then updates the record
 */
export declare function updateStockQuantities(mainStockRecordId: string, updates: {
    quantityReceived?: number;
    quantityUsed?: number;
}, context: {
    performedBy: string;
    company_id: string;
    site_id?: string;
    material_id?: string;
    notes?: string;
}): Promise<IMainStockRecordDocument>;
/**
 * Set price on a MainStockRecord with movement logging
 */
export declare function setStockPrice(mainStockRecordId: string, price: number, context: {
    performedBy: string;
    company_id: string;
    notes?: string;
}): Promise<IMainStockRecordDocument>;
/**
 * Bulk set prices on site-sourced records
 */
export declare function bulkSetPrices(updates: {
    mainStockRecordId: string;
    price: number;
}[], context: {
    performedBy: string;
    company_id: string;
}): Promise<{
    updated: number;
    errors: string[];
}>;
//# sourceMappingURL=stockService.d.ts.map