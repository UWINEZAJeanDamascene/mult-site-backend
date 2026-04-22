import mongoose, { Schema, Document, Model } from 'mongoose';

export enum RecordSource {
  SITE = 'site',
  DIRECT = 'direct',
}

export enum RecordStatus {
  PENDING_PRICE = 'pending_price',
  PRICED = 'priced',
  DIRECT = 'direct',
}

export interface IMainStockRecord {
  source: RecordSource;
  site_id?: mongoose.Types.ObjectId;
  siteRecord_id?: mongoose.Types.ObjectId;
  material_id?: mongoose.Types.ObjectId;
  materialName: string;
  quantityReceived: number;
  quantityUsed: number;
  price?: number | null;
  totalValue?: number | null;
  date: Date;
  status: RecordStatus;
  notes?: string;
  recordedBy: mongoose.Types.ObjectId;
  company_id: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMainStockRecordDocument extends IMainStockRecord, Document {
  _id: mongoose.Types.ObjectId;
  isModified(path: string): boolean;
}

export interface IMainStockRecordModel extends Model<IMainStockRecordDocument> {}

const MainStockRecordSchema = new Schema<IMainStockRecordDocument, IMainStockRecordModel>(
  {
    source: {
      type: String,
      enum: Object.values(RecordSource),
      required: true,
    },
    site_id: {
      type: Schema.Types.ObjectId,
      ref: 'Site',
      default: null,
    },
    siteRecord_id: {
      type: Schema.Types.ObjectId,
      ref: 'SiteRecord',
      default: null,
    },
    material_id: {
      type: Schema.Types.ObjectId,
      ref: 'Material',
    },
    materialName: { type: String, required: true },
    quantityReceived: { type: Number, default: 0 },
    quantityUsed: { type: Number, default: 0 },
    price: { type: Number, default: null },
    totalValue: { type: Number, default: null },
    date: { type: Date, required: true },
    status: {
      type: String,
      enum: Object.values(RecordStatus),
      default: RecordStatus.PENDING_PRICE,
    },
    notes: { type: String },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    company_id: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

// Compound indexes for multi-tenancy
MainStockRecordSchema.index({ company_id: 1, site_id: 1 });
MainStockRecordSchema.index({ company_id: 1, material_id: 1 });
MainStockRecordSchema.index({ company_id: 1, source: 1 });
MainStockRecordSchema.index({ company_id: 1, status: 1 });
MainStockRecordSchema.index({ siteRecord_id: 1 });

// Note: Pre-save hooks disabled due to Mongoose 9.x TypeScript issues
// Logic moved to service layer:
// - totalValue computed before saving
// - Status updates handled explicitly in stockService.ts

export const MainStockRecord = mongoose.model<IMainStockRecordDocument, IMainStockRecordModel>(
  'MainStockRecord',
  MainStockRecordSchema
);
export default MainStockRecord;
