import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ISite {
  name: string;
  location?: string;
  description?: string;
  company_id: string;
  createdBy: mongoose.Types.ObjectId;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISiteDocument extends ISite, Document {}

export interface ISiteModel extends Model<ISiteDocument> {}

const SiteSchema = new Schema<ISiteDocument, ISiteModel>(
  {
    name: { type: String, required: true },
    location: { type: String },
    description: { type: String },
    company_id: { type: String, required: true, index: true },
    createdBy: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

// Index for company-scoped queries
SiteSchema.index({ company_id: 1, name: 1 });
SiteSchema.index({ company_id: 1, isActive: 1 });

export const Site = mongoose.model<ISiteDocument, ISiteModel>('Site', SiteSchema);
export default Site;
