import mongoose, { Document } from 'mongoose';
export interface IDeliveryNoteItem {
    materialName: string;
    material_id?: string;
    quantityOrdered: number;
    quantityDelivered: number;
    unit: string;
    unitPrice: number;
    totalPrice: number;
    condition?: 'good' | 'damaged' | 'partial';
    notes?: string;
}
export interface IDeliveryNoteDocument extends Document {
    dnNumber: string;
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
    items: IDeliveryNoteItem[];
    deliveryDate: Date;
    receivedBy: string;
    receivedByName?: string;
    carrier?: string;
    trackingNumber?: string;
    condition: 'good' | 'damaged' | 'partial';
    notes?: string;
    attachments?: string[];
    subTotal: number;
    taxRate: number;
    taxAmount: number;
    totalAmount: number;
    company_id: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const DeliveryNote: mongoose.Model<IDeliveryNoteDocument, {}, {}, {}, mongoose.Document<unknown, {}, IDeliveryNoteDocument, {}, mongoose.DefaultSchemaOptions> & IDeliveryNoteDocument & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, IDeliveryNoteDocument>;
//# sourceMappingURL=DeliveryNote.d.ts.map