import mongoose, { Schema, Document } from 'mongoose'

export interface IPurchaseReturnItem {
  materialName: string
  material_id?: string
  quantityReturned: number
  unit: string
  unitPrice: number
  reason: 'defective' | 'wrong_item' | 'overage' | 'other'
  notes?: string
}

export interface IPurchaseReturnDocument extends Document {
  returnNumber: string
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
  items: IPurchaseReturnItem[]
  returnDate: Date
  returnedBy: string
  returnedByName?: string
  carrier?: string
  trackingNumber?: string
  condition: 'good' | 'damaged' | 'partial'
  refundStatus: 'pending' | 'processed' | 'refunded'
  refundAmount?: number
  notes?: string
  attachments?: string[]
  company_id: string
  createdAt: Date
  updatedAt: Date
}

const PurchaseReturnItemSchema = new Schema<IPurchaseReturnItem>(
  {
    materialName: { type: String, required: true },
    material_id: String,
    quantityReturned: { type: Number, required: true, min: 0 },
    unit: { type: String, required: true },
    unitPrice: { type: Number, required: true, min: 0 },
    reason: {
      type: String,
      enum: ['defective', 'wrong_item', 'overage', 'other'],
      required: true,
    },
    notes: String,
  },
  { _id: false }
)

const PurchaseReturnSchema = new Schema<IPurchaseReturnDocument>(
  {
    returnNumber: { type: String, required: true, unique: true },
    poId: { type: String, required: true, index: true },
    poNumber: { type: String, required: true },
    supplier: {
      name: { type: String, required: true },
      contactPerson: String,
      email: String,
      phone: String,
    },
    site_id: { type: String, required: true },
    site: {
      _id: { type: String, required: true },
      name: { type: String, required: true },
      location: String,
    },
    items: { type: [PurchaseReturnItemSchema], required: true },
    returnDate: { type: Date, required: true },
    returnedBy: { type: String, required: true },
    returnedByName: String,
    carrier: String,
    trackingNumber: String,
    condition: {
      type: String,
      enum: ['good', 'damaged', 'partial'],
      required: true,
    },
    refundStatus: {
      type: String,
      enum: ['pending', 'processed', 'refunded'],
      default: 'pending',
    },
    refundAmount: { type: Number, min: 0 },
    notes: String,
    attachments: [String],
    company_id: { type: String, required: true, index: true },
  },
  { timestamps: true }
)

// Index for faster queries
PurchaseReturnSchema.index({ company_id: 1, createdAt: -1 })
PurchaseReturnSchema.index({ company_id: 1, poId: 1 })
PurchaseReturnSchema.index({ returnNumber: 1 })

export const PurchaseReturn = mongoose.model<IPurchaseReturnDocument>(
  'PurchaseReturn',
  PurchaseReturnSchema
)
