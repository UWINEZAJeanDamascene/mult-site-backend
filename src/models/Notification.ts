import mongoose, { Schema, Document } from 'mongoose';

export enum NotificationType {
  MATERIAL_RECEIVED = 'MATERIAL_RECEIVED',
  MATERIAL_USED = 'MATERIAL_USED',
  MATERIAL_LOW_STOCK = 'MATERIAL_LOW_STOCK',
  SITE_CREATED = 'SITE_CREATED',
  SITE_UPDATED = 'SITE_UPDATED',
  PRICE_UPDATED = 'PRICE_UPDATED',
  RECORD_RECEIVED = 'RECORD_RECEIVED',
  SYSTEM = 'SYSTEM'
}

export enum NotificationPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH'
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

const NotificationSchema = new Schema<INotification>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    type: {
      type: String,
      enum: Object.values(NotificationType),
      required: true,
    },
    title: {
      type: String,
      required: true,
    },
    message: {
      type: String,
      required: true,
    },
    priority: {
      type: String,
      enum: Object.values(NotificationPriority),
      default: NotificationPriority.MEDIUM,
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    data: {
      type: Schema.Types.Mixed,
      default: {},
    },
    link: {
      type: String,
    },
  },
  { timestamps: true }
);

// Index for efficient querying
NotificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });

export const Notification = mongoose.model<INotification>('Notification', NotificationSchema);

// Static method to create notification
export const createNotification = async (data: {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  priority?: NotificationPriority;
  data?: Record<string, any>;
  link?: string;
}) => {
  try {
    const notification = new Notification(data);
    await notification.save();
    return notification;
  } catch (error) {
    console.error('Failed to create notification:', error);
    return null;
  }
};

export default Notification;
