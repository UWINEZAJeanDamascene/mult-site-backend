import mongoose, { Document, Model } from 'mongoose';
export declare enum MovementType {
    RECEIVED = "received",
    USED = "used",
    ADJUSTMENT = "adjustment"
}
export interface IStockMovement {
    mainStockRecord_id: mongoose.Types.ObjectId;
    site_id?: mongoose.Types.ObjectId;
    material_id?: mongoose.Types.ObjectId;
    movementType: MovementType;
    quantity: number;
    previousQuantityUsed: number;
    previousQuantityReceived: number;
    newQuantityUsed: number;
    newQuantityReceived: number;
    performedBy: mongoose.Types.ObjectId;
    company_id: string;
    date: Date;
    notes?: string;
    createdAt: Date;
}
export interface IStockMovementDocument extends IStockMovement, Document {
    _id: mongoose.Types.ObjectId;
}
export interface IStockMovementModel extends Model<IStockMovementDocument> {
}
export declare const StockMovement: IStockMovementModel;
export default StockMovement;
//# sourceMappingURL=StockMovement.d.ts.map