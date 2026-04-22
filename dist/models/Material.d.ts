import { Document, Model } from 'mongoose';
export interface IMaterial {
    name: string;
    unit: string;
    description?: string;
    company_id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export interface IMaterialDocument extends IMaterial, Document {
}
export interface IMaterialModel extends Model<IMaterialDocument> {
}
export declare const Material: IMaterialModel;
export default Material;
//# sourceMappingURL=Material.d.ts.map