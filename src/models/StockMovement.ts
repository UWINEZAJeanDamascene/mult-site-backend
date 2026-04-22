import mongoose, { Schema, Document, Model } from 'mongoose';

export enum MovementType {
  RECEIVED = 'received',
  USED = 'used',
  ADJUSTMENT = 'adjustment',
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

export interface IStockMovementModel extends Model<IStockMovementDocument> {}

const StockMovementSchema = new Schema<IStockMovementDocument, IStockMovementModel>(
  {
    mainStockRecord_id: {
      type: Schema.Types.ObjectId,
      ref: 'MainStockRecord',
      required: true,
      index: true,
    },
    site_id: {
      type: Schema.Types.ObjectId,
      ref: 'Site',
    },
    material_id: {
      type: Schema.Types.ObjectId,
      ref: 'Material',
    },
    movementType: {
      type: String,
      enum: Object.values(MovementType),
      required: true,
    },
    quantity: { type: Number, required: true },
    previousQuantityUsed: { type: Number, required: true },
    previousQuantityReceived: { type: Number, required: true },
    newQuantityUsed: { type: Number, required: true },
    newQuantityReceived: { type: Number, required: true },
    performedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    company_id: { type: String, required: true, index: true },
    date: { type: Date, required: true, default: Date.now },
    notes: { type: String },
  },
  { timestamps: true }
);

// Compound indexes
StockMovementSchema.index({ company_id: 1, mainStockRecord_id: 1 });
StockMovementSchema.index({ company_id: 1, material_id: 1 });
StockMovementSchema.index({ company_id: 1, date: -1 });

export const StockMovement = mongoose.model<IStockMovementDocument, IStockMovementModel>(
  'StockMovement',
  StockMovementSchema
);
export default StockMovement;
