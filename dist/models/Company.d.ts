import mongoose, { Document } from 'mongoose';
export interface ICompany extends Document {
    name: string;
    company_id?: string | null;
    logo?: string;
    address?: string;
    phone?: string;
    email?: string;
    website?: string;
    taxId?: string;
    industry?: string;
    description?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Company: mongoose.Model<ICompany, {}, {}, {}, mongoose.Document<unknown, {}, ICompany, {}, mongoose.DefaultSchemaOptions> & ICompany & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ICompany>;
export default Company;
//# sourceMappingURL=Company.d.ts.map