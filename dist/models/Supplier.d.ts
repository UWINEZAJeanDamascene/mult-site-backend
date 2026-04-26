import mongoose, { Document } from 'mongoose';
export interface ISupplierDocument extends Document {
    name: string;
    contactPerson?: string;
    email?: string;
    phone?: string;
    address?: string;
    company_id: string;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Supplier: mongoose.Model<ISupplierDocument, {}, {}, {}, mongoose.Document<unknown, {}, ISupplierDocument, {}, mongoose.DefaultSchemaOptions> & ISupplierDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, ISupplierDocument>;
//# sourceMappingURL=Supplier.d.ts.map