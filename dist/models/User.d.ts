import mongoose, { Document, Model } from 'mongoose';
export declare enum UserRole {
    MAIN_MANAGER = "main_manager",
    SITE_MANAGER = "site_manager",
    ACCOUNTANT = "accountant",
    MANAGER = "manager"
}
export interface IUser {
    name: string;
    email: string;
    password: string;
    role: UserRole;
    assignedSites: mongoose.Types.ObjectId[];
    company_id: string;
    isActive: boolean;
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
export interface IUserModel extends Model<IUserDocument> {
}
export declare const User: IUserModel;
export default User;
//# sourceMappingURL=User.d.ts.map