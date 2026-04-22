import mongoose, { Schema, Document } from 'mongoose';

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

const POItemSchema: Schema = new Schema({
  materialName: { type: String, required: true },
  material_id: { type: Schema.Types.ObjectId, ref: 'Material', default: null },
  description: { type: String, default: '' },
  quantityOrdered: { type: Number, required: true, min: 0 },
  quantityReceived: { type: Number, default: 0, min: 0 },
  unitPrice: { type: Number, required: true, min: 0 },
  totalPrice: { type: Number, required: true, min: 0 },
  unit: { type: String, required: true },
  notes: { type: String, default: '' },
});

const PurchaseOrderSchema: Schema = new Schema(
  {
    poNumber: { type: String, required: true, unique: true },
    supplier: {
      name: { type: String, required: true },
      contactPerson: { type: String, default: '' },
      email: { type: String, default: '' },
      phone: { type: String, default: '' },
      address: { type: String, default: '' },
    },
    site_id: { type: Schema.Types.ObjectId, ref: 'Site', required: true },
    status: {
      type: String,
      enum: ['draft', 'sent', 'partial', 'received', 'completed', 'cancelled'],
      default: 'draft',
    },
    items: [POItemSchema],
    subTotal: { type: Number, required: true, default: 0 },
    taxRate: { type: Number, default: 0, min: 0, max: 100 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    notes: { type: String, default: '' },
    terms: { type: String, default: '' },
    sentDate: { type: Date, default: null },
    expectedDeliveryDate: { type: Date, default: null },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    company_id: { type: String, required: true, index: true },
  },
  { timestamps: true }
);

// Index for efficient queries
PurchaseOrderSchema.index({ company_id: 1, status: 1 });
PurchaseOrderSchema.index({ company_id: 1, site_id: 1 });
PurchaseOrderSchema.index({ poNumber: 1 });

export const PurchaseOrder = mongoose.model<IPurchaseOrder>('PurchaseOrder', PurchaseOrderSchema);
export default PurchaseOrder;
