export declare class NotificationService {
    static notifyMaterialReceived(userId: string, materialName: string, quantity: number, siteName?: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    static notifyMaterialUsed(userId: string, materialName: string, quantity: number, siteName?: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    static notifyLowStock(userId: string, materialName: string, remainingQuantity: number, threshold?: number): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    static notifySiteCreated(userId: string, siteName: string, location: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    static notifyPriceUpdated(userId: string, materialName: string, oldPrice: number, newPrice: number): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    static notifyRecordReceived(userId: string, materialName: string, status: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
    static notifySystem(userId: string, title: string, message: string): Promise<(import("mongoose").Document<unknown, {}, import("../models/Notification").INotification, {}, import("mongoose").DefaultSchemaOptions> & import("../models/Notification").INotification & Required<{
        _id: import("mongoose").Types.ObjectId;
    }> & {
        __v: number;
    } & {
        id: string;
    }) | null>;
}
export default NotificationService;
//# sourceMappingURL=notificationService.d.ts.map