import mongoose, { Document } from 'mongoose';
export interface IPOItem {
    _id?: mongoose.Types.ObjectId;
    materialName: string;
    material_id?: mongoose.Types.ObjectId;
    description?: string;
    quantityOrdered: number;
    quantityReceived: number;
    unitPrice: number;
    totalPrice: number;
    unit: string;
    notes?: string;
}
export interface IPurchaseOrder extends Document {
    poNumber: string;
    supplier: {
        name: string;
        contactPerson?: string;
        email?: string;
        phone?: string;
        address?: string;
    };
    site_id: mongoose.Types.ObjectId;
    status: 'draft' | 'sent' | 'partial' | 'received' | 'completed' | 'cancelled';
    items: IPOItem[];
    subTotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    notes?: string;
    terms?: string;
    sentDate?: Date;
    expectedDeliveryDate?: Date;
    createdBy: mongoose.Types.ObjectId;
    company_id: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const PurchaseOrder: mongoose.Model<IPurchaseOrder, {}, {}, {}, mongoose.Document<unknown, {}, IPurchaseOrder, {}, mongoose.DefaultSchemaOptions> & IPurchaseOrder & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPurchaseOrder>;
export default PurchaseOrder;
//# sourceMappingURL=PurchaseOrder.d.ts.map