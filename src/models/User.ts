import mongoose, { Schema, Document, Model } from 'mongoose';
import bcrypt from 'bcryptjs';

export enum UserRole {
  MAIN_MANAGER = 'main_manager',
  SITE_MANAGER = 'site_manager',
  ACCOUNTANT = 'accountant',
  MANAGER = 'manager',
}

export interface IUser {
  name: string;
  email: string;
  password: string;
  role: UserRole;
  assignedSites: mongoose.Types.ObjectId[];
  company_id: string;
  isActive: boolean;
  // Profile fields
  profilePicture?: string;
  phone?: string;
  department?: string;
  jobTitle?: string;
  bio?: string;
  location?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface IUserDocument extends IUser, Document {
  comparePassword(candidatePassword: string): Promise<boolean>;
  isModified(path: string): boolean;
}

export interface IUserModel extends Model<IUserDocument> {}

const UserSchema = new Schema<IUserDocument, IUserModel>(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: Object.values(UserRole),
      required: true,
    },
    assignedSites: [{
      type: Schema.Types.ObjectId,
      ref: 'Site',
    }],
    company_id: { type: String, required: true, index: true },
    isActive: { type: Boolean, default: true },
    // Profile fields
    profilePicture: { type: String },
    phone: { type: String },
    department: { type: String },
    jobTitle: { type: String },
    bio: { type: String },
    location: { type: String },
  },
  { timestamps: true }
);

// Index for company-scoped queries
UserSchema.index({ company_id: 1, email: 1 });
UserSchema.index({ company_id: 1, role: 1 });

// Hash password before saving (work factor 12)
(UserSchema as any).pre('save', async function (this: IUserDocument) {
  if (!this.isModified('password')) return;

  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model<IUserDocument, IUserModel>('User', UserSchema);
export default User;
