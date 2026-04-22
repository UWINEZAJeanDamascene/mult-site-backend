import mongoose, { Document, Model } from 'mongoose';
export declare enum RecordSource {
    SITE = "site",
    DIRECT = "direct"
}
export declare enum RecordStatus {
    PENDING_PRICE = "pending_price",
    PRICED = "priced",
    DIRECT = "direct"
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
export interface IMainStockRecordModel extends Model<IMainStockRecordDocument> {
}
export declare const MainStockRecord: IMainStockRecordModel;
export default MainStockRecord;
//# sourceMappingURL=MainStockRecord.d.ts.map