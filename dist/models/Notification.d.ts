import mongoose, { Document } from 'mongoose';
export declare enum NotificationType {
    MATERIAL_RECEIVED = "MATERIAL_RECEIVED",
    MATERIAL_USED = "MATERIAL_USED",
    MATERIAL_LOW_STOCK = "MATERIAL_LOW_STOCK",
    SITE_CREATED = "SITE_CREATED",
    SITE_UPDATED = "SITE_UPDATED",
    PRICE_UPDATED = "PRICE_UPDATED",
    RECORD_RECEIVED = "RECORD_RECEIVED",
    SYSTEM = "SYSTEM"
}
export declare enum NotificationPriority {
    LOW = "LOW",
    MEDIUM = "MEDIUM",
    HIGH = "HIGH"
}
export interface INotification extends Document {
    userId: mongoose.Types.ObjectId;
    type: NotificationType;
    title: string;
    message: string;
    priority: NotificationPriority;
    isRead: boolean;
    data?: Record<string, any>;
    link?: string;
    createdAt: Date;
    updatedAt: Date;
}
export declare const Notification: mongoose.Model<INotification, {}, {}, {}, mongoose.Document<unknown, {}, INotification, {}, mongoose.DefaultSchemaOptions> & INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}, any, INotification>;
export declare const createNotification: (data: {
    userId: string;
    type: NotificationType;
    title: string;
    message: string;
    priority?: NotificationPriority;
    data?: Record<string, any>;
    link?: string;
}) => Promise<(mongoose.Document<unknown, {}, INotification, {}, mongoose.DefaultSchemaOptions> & INotification & Required<{
    _id: mongoose.Types.ObjectId;
}> & {
    __v: number;
} & {
    id: string;
}) | null>;
export default Notification;
//# sourceMappingURL=Notification.d.ts.map