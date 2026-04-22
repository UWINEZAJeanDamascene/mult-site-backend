import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IMaterial {
  name: string;
  unit: string;
  description?: string;
  company_id: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface IMaterialDocument extends IMaterial, Document {}

export interface IMaterialModel extends Model<IMaterialDocument> {}

const MaterialSchema = new Schema<IMaterialDocument, IMaterialModel>(
  {
    name: { type: String, required: true },
    unit: { type: String, required: true }, // e.g., kg, litres, pcs
    description: { type: String },
    company_id: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Index for company-scoped queries
MaterialSchema.index({ company_id: 1, name: 1 });

export const Material = mongoose.model<IMaterialDocument, IMaterialModel>('Material', MaterialSchema);
export default Material;
