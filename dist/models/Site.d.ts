import mongoose, { Document, Model } from 'mongoose';
export interface ISite {
    name: string;
    location?: string;
    description?: string;
    company_id: string;
    createdBy: mongoose.Types.ObjectId;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface ISiteDocument extends ISite, Document {
}
export interface ISiteModel extends Model<ISiteDocument> {
}
export declare const Site: ISiteModel;
export default Site;
//# sourceMappingURL=Site.d.ts.map