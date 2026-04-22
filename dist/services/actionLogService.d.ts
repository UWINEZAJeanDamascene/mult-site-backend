import { Request } from 'express';
import { ActionType, ResourceType } from '../models/ActionLog';
export interface ActionLogData {
    userId: string;
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
}
export declare class ActionLogService {
    /**
     * Log a user action
     */
    static logAction(data: ActionLogData): Promise<void>;
    /**
     * Log action from Express request
     */
    static logFromRequest(req: Request, action: ActionType, resource: ResourceType, description: string, options?: {
        userId?: string;
        userName?: string;
        userEmail?: string;
        userRole?: string;
        companyId?: string;
        resourceId?: string;
        resourceName?: string;
        details?: Record<string, any>;
    }): Promise<void>;
    /**
     * Log site creation
     */
    static logSiteCreate(req: Request, siteId: string, siteName: string): Promise<void>;
    /**
     * Log site update
     */
    static logSiteUpdate(req: Request, siteId: string, siteName: string): Promise<void>;
    /**
     * Log site deletion
     */
    static logSiteDelete(req: Request, siteId: string, siteName: string): Promise<void>;
    /**
     * Log site record creation
     */
    static logSiteRecordCreate(req: Request, recordId: string, materialName: string, details: any): Promise<void>;
    /**
     * Log main stock record creation
     */
    static logMainStockCreate(req: Request, recordId: string, materialName: string, details: any): Promise<void>;
    /**
     * Log price update
     */
    static logPriceUpdate(req: Request, recordId: string, materialName: string, oldPrice: number | null, newPrice: number): Promise<void>;
    /**
     * Log material creation
     */
    static logMaterialCreate(req: Request, materialId: string, materialName: string): Promise<void>;
    /**
     * Log material update
     */
    static logMaterialUpdate(req: Request, materialId: string, materialName: string): Promise<void>;
    /**
     * Log user creation
     */
    static logUserCreate(req: Request, userId: string, userName: string, userEmail: string): Promise<void>;
    /**
     * Log user update
     */
    static logUserUpdate(req: Request, userId: string, userName: string): Promise<void>;
    /**
     * Log user deletion
     */
    static logUserDelete(req: Request, userId: string, userName: string): Promise<void>;
    /**
     * Log manager assignment to site
     */
    static logManagerAssign(req: Request, siteId: string, siteName: string, managerId: string, managerName: string): Promise<void>;
    /**
     * Log manager unassignment from site
     */
    static logManagerUnassign(req: Request, siteId: string, siteName: string, managerId: string, managerName: string): Promise<void>;
    /**
     * Log sync to main stock
     */
    static logSyncToMainStock(req: Request, siteRecordId: string, materialName: string, syncedQuantity: number): Promise<void>;
    /**
     * Log login
     */
    static logLogin(req: Request, userId: string, userName: string, userEmail: string, userRole: string, companyId?: string): Promise<void>;
    /**
     * Log logout
     */
    static logLogout(req: Request, userId: string, userName: string): Promise<void>;
}
export default ActionLogService;
//# sourceMappingURL=actionLogService.d.ts.map