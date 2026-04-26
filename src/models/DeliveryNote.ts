import mongoose, { Schema, Document } from 'mongoose'

export interface IDeliveryNoteItem {
  materialName: string
  material_id?: string
  quantityOrdered: number
  quantityDelivered: number
  unit: string
  unitPrice: number
  totalPrice: number
  condition?: 'good' | 'damaged' | 'partial'
  notes?: string
}

export interface IDeliveryNoteDocument extends Document {
  dnNumber: string
  poId: string
  poNumber: string
  supplier: {
    name: string
    contactPerson?: string
    email?: string
    phone?: string
  }
  site_id: string
  site: {
    _id: string
    name: string
    location?: string
  }
  items: IDeliveryNoteItem[]
  deliveryDate: Date
  receivedBy: string
  receivedByName?: string
  carrier?: string
  trackingNumber?: string
  condition: 'good' | 'damaged' | 'partial'
  notes?: string
  attachments?: string[]
  subTotal: number
  taxRate: number
  taxAmount: number
  totalAmount: number
  company_id: string
  createdAt: Date
  updatedAt: Date
}

const deliveryNoteItemSchema = new Schema<IDeliveryNoteItem>(
  {
    materialName: { type: String, required: true },
    material_id: String,
    quantityOrdered: { type: Number, required: true },
    quantityDelivered: { type: Number, required: true },
    unit: { type: String, required: true },
    unitPrice: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    condition: {
      type: String,
      enum: ['good', 'damaged', 'partial'],
    },
    notes: String,
  },
  { _id: false }
)

const deliveryNoteSchema = new Schema<IDeliveryNoteDocument>(
  {
    dnNumber: {
      type: String,
      required: [true, 'Delivery note number is required'],
      unique: true,
    },
    poId: {
      type: String,
      required: [true, 'Purchase Order ID is required'],
      index: true,
    },
    poNumber: {
      type: String,
      required: [true, 'PO Number is required'],
    },
    supplier: {
      name: { type: String, required: true },
      contactPerson: String,
      email: String,
      phone: String,
    },
    site_id: { type: String, required: true },
    site: {
      _id: String,
      name: String,
      location: String,
    },
    items: [deliveryNoteItemSchema],
    deliveryDate: {
      type: Date,
      required: [true, 'Delivery date is required'],
    },
    receivedBy: {
      type: String,
      required: [true, 'Received by is required'],
    },
    receivedByName: String,
    carrier: String,
    trackingNumber: String,
    condition: {
      type: String,
      enum: ['good', 'damaged', 'partial'],
      required: [true, 'Condition is required'],
    },
    notes: String,
    attachments: [String],
    subTotal: { type: Number, required: true, default: 0 },
    taxRate: { type: Number, default: 0 },
    taxAmount: { type: Number, default: 0 },
    totalAmount: { type: Number, required: true, default: 0 },
    company_id: {
      type: String,
      required: [true, 'Company ID is required'],
      index: true,
    },
  },
  {
    timestamps: true,
  }
)

// Compound index for company-based queries
 deliveryNoteSchema.index({ company_id: 1, createdAt: -1 })
 deliveryNoteSchema.index({ company_id: 1, poId: 1 })

export const DeliveryNote = mongoose.model<IDeliveryNoteDocument>('DeliveryNote', deliveryNoteSchema)
