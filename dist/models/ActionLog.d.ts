import mongoose, { Document, Model } from 'mongoose';
export declare enum ActionType {
    CREATE = "create",
    UPDATE = "update",
    DELETE = "delete",
    LOGIN = "login",
    LOGOUT = "logout",
    ASSIGN = "assign",
    UNASSIGN = "unassign",
    PRICE_UPDATE = "price_update",
    SYNC = "sync",
    EXPORT = "export",
    IMPORT = "import",
    VIEW = "view",
    OTHER = "other"
}
export declare enum ResourceType {
    SITE = "site",
    SITE_RECORD = "site_record",
    MAIN_STOCK = "main_stock",
    MATERIAL = "material",
    USER = "user",
    SYSTEM = "system",
    COMPANY = "company",
    PURCHASE_ORDER = "purchase_order"
}
export interface IActionLog {
    userId: mongoose.Types.ObjectId;
    userName: string;
    userEmail: string;
    userRole: string;
    companyId: string;
    action: ActionType;
    resource: ResourceType;
    resourceId?: string;
    resourceName?: string;
    description: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
    timestamp: Date;
}
export interface IActionLogDocument extends IActionLog, Document {
}
export interface IActionLogModel extends Model<IActionLogDocument> {
    logAction(data: Omit<IActionLog, 'timestamp'>): Promise<IActionLogDocument>;
}
export declare const ActionLog: IActionLogModel;
export default ActionLog;
//# sourceMappingURL=ActionLog.d.ts.map