import mongoose, { Schema, Document, Model } from 'mongoose';
import { MainStockRecord, RecordSource, RecordStatus } from './MainStockRecord';

export interface ISiteRecord {
  site_id: mongoose.Types.ObjectId;
  material_id?: mongoose.Types.ObjectId;
  materialName: string;
  quantityReceived: number;
  quantityUsed: number;
  date: Date;
  notes?: string;
  recordedBy: mongoose.Types.ObjectId;
  company_id: string;
  syncedToMainStock: boolean;
  mainStockEntryId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISiteRecordDocument extends ISiteRecord, Document {
  _id: mongoose.Types.ObjectId;
  isModified(path: string): boolean;
}

export interface ISiteRecordModel extends Model<ISiteRecordDocument> {}

const SiteRecordSchema = new Schema<ISiteRecordDocument, ISiteRecordModel>(
  {
    site_id: {
      type: Schema.Types.ObjectId,
      ref: 'Site',
      required: true,
      index: true,
    },
    material_id: {
      type: Schema.Types.ObjectId,
      ref: 'Material',
    },
    materialName: { type: String, required: true },
    quantityReceived: { type: Number, default: 0 },
    quantityUsed: { type: Number, default: 0 },
    date: { type: Date, required: true },
    notes: { type: String },
    recordedBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    company_id: { type: String, required: true, index: true },
    syncedToMainStock: { type: Boolean, default: false },
    mainStockEntryId: {
      type: Schema.Types.ObjectId,
      ref: 'MainStockRecord',
    },
  },
  { timestamps: true }
);

// Compound index for company-scoped queries
SiteRecordSchema.index({ company_id: 1, site_id: 1 });
SiteRecordSchema.index({ company_id: 1, materialName: 1 });

// Post-save middleware: Auto-create MainStockRecord
SiteRecordSchema.post('save', async function (doc: ISiteRecordDocument) {
  try {
    // Get site name for siteSource
    const site = await mongoose.model('Site').findById(doc.site_id);
    const siteName = site ? (site as any).name : 'Unknown';

    // Check if this is an update to an existing synced record
    let mainStockRecord;

    if (doc.mainStockEntryId) {
      // Update existing main stock record
      mainStockRecord = await MainStockRecord.findByIdAndUpdate(
        doc.mainStockEntryId,
        {
          materialName: doc.materialName,
          quantityReceived: doc.quantityReceived,
          quantityUsed: doc.quantityUsed,
          date: doc.date,
          notes: doc.notes,
          updatedAt: new Date(),
        },
        { returnDocument: 'after' }
      );
      if (!mainStockRecord) {
        console.error(`MainStockRecord ${doc.mainStockEntryId} not found for update`);
        return;
      }
    } else {
      // Create new main stock record
      mainStockRecord = await MainStockRecord.create({
        source: RecordSource.SITE,
        site_id: doc.site_id,
        siteRecord_id: doc._id,
        material_id: doc.material_id,
        materialName: doc.materialName,
        quantityReceived: doc.quantityReceived,
        quantityUsed: doc.quantityUsed,
        date: doc.date,
        status: RecordStatus.PENDING_PRICE,
        notes: doc.notes,
        recordedBy: doc.recordedBy,
        company_id: doc.company_id,
      } as any);

      // Update site record with sync reference
      await mongoose.model('SiteRecord').findByIdAndUpdate(doc._id, {
        syncedToMainStock: true,
        mainStockEntryId: mainStockRecord!._id,
      });
    }

    if (mainStockRecord) {
      console.log(`Auto-synced SiteRecord ${doc._id} to MainStockRecord ${mainStockRecord._id}`);
    }
  } catch (error) {
    console.error('Error auto-syncing SiteRecord to MainStock:', error);
  }
});

export const SiteRecord = mongoose.model<ISiteRecordDocument, ISiteRecordModel>(
  'SiteRecord',
  SiteRecordSchema
);
export default SiteRecord;
