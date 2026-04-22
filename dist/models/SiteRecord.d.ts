import mongoose, { Document, Model } from 'mongoose';
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
export interface ISiteRecordModel extends Model<ISiteRecordDocument> {
}
export declare const SiteRecord: ISiteRecordModel;
export default SiteRecord;
//# sourceMappingURL=SiteRecord.d.ts.map