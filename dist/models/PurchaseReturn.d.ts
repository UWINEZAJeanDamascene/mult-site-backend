import mongoose, { Document } from 'mongoose';
export interface IPurchaseReturnItem {
    materialName: string;
    material_id?: string;
    quantityReturned: number;
    unit: string;
    unitPrice: number;
    reason: 'defective' | 'wrong_item' | 'overage' | 'other';
    notes?: string;
}
export interface IPurchaseReturnDocument extends Document {
    returnNumber: string;
    poId: string;
    poNumber: string;
    supplier: {
        name: string;
        contactPerson?: string;
        email?: string;
        phone?: string;
    };
    site_id: string;
    site: {
        _id: string;
        name: string;
        location?: string;
    };
    items: IPurchaseReturnItem[];
    returnDate: Date;
    returnedBy: string;
    returnedByName?: string;
    carrier?: string;
    trackingNumber?: string;
    condition: 'good' | 'damaged' | 'partial';
    refundStatus: 'pending' | 'processed' | 'refunded';
    refundAmount?: number;
    notes?: string;
    attachments?: string[];
    company_id: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const PurchaseReturn: mongoose.Model<IPurchaseReturnDocument, {}, {}, {}, mongoose.Document<unknown, {}, IPurchaseReturnDocument, {}, mongoose.DefaultSchemaOptions> & IPurchaseReturnDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IPurchaseReturnDocument>;
//# sourceMappingURL=PurchaseReturn.d.ts.map