import mongoose, { Schema, Document } from 'mongoose'

export interface ISupplierDocument extends Document {
  name: string
  contactPerson?: string
  email?: string
  phone?: string
  address?: string
  company_id: string
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const supplierSchema = new Schema<ISupplierDocument>(
  {
    name: {
      type: String,
      required: [true, 'Supplier name is required'],
      trim: true,
    },
    contactPerson: {
      type: String,
      trim: true,
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
    },
    phone: {
      type: String,
      trim: true,
    },
    address: {
      type: String,
      trim: true,
    },
    company_id: {
      type: String,
      required: [true, 'Company ID is required'],
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
)

// Compound index to prevent duplicate supplier names per company
supplierSchema.index({ name: 1, company_id: 1 }, { unique: true })

export const Supplier = mongoose.model<ISupplierDocument>('Supplier', supplierSchema)
