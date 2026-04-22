import mongoose from 'mongoose';
/**
 * UsedMaterialsView - Aggregates total quantity used per material
 * Groups MainStockRecords by material and sums quantityUsed across all records
 * filtered by company
 */
export declare function getUsedMaterialsView(company_id: string): Promise<any[]>;
/**
 * RemainingMaterialsView - Computes quantityReceived - quantityUsed per material
 * with total value. Includes price valuation.
 */
export declare function getRemainingMaterialsView(company_id: string): Promise<any[]>;
/**
 * Get single material used view
 */
export declare function getSingleUsedMaterialView(company_id: string, materialName: string): Promise<any>;
/**
 * Get single material remaining view
 */
export declare function getSingleRemainingMaterialView(company_id: string, materialName: string): Promise<any>;
/**
 * Comprehensive stock summary
 */
export declare function getStockSummary(company_id: string): Promise<{
    totalMaterials: number;
    totalRecords: number;
    pendingPricing: number;
    summary: {
        materialName: any;
        material_id: any;
        totalUsed: any;
        totalRemaining: any;
        totalValue: any;
    }[];
}>;
/**
 * Service to record stock movement and update derived views
 * This should be called before updating MainStockRecord quantities
 */
export declare function recordStockMovement(data: {
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
}): Promise<mongoose.Document<unknown, {}, import("../models/StockMovement").IStockMovementDocument, {}, mongoose.DefaultSchemaOptions> & import("../models/StockMovement").IStockMovementDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}>;
//# sourceMappingURL=viewsAggregation.d.ts.map