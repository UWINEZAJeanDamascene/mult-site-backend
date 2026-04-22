import { Request } from 'express';
import { ActionLog, ActionType, ResourceType } from '../models/ActionLog';
import type { IUserDocument } from '../models/User';

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

export class ActionLogService {
  /**
   * Log a user action
   */
  static async logAction(data: ActionLogData): Promise<void> {
    try {
      await ActionLog.create({
        ...data,
        timestamp: new Date(),
      });
    } catch (error) {
      console.error('Failed to log action:', error);
      // Don't throw - logging should not break main functionality
    }
  }

  /**
   * Log action from Express request
   */
  static async logFromRequest(
    req: Request,
    action: ActionType,
    resource: ResourceType,
    description: string,
    options: {
      userId?: string;
      userName?: string;
      userEmail?: string;
      userRole?: string;
      companyId?: string;
      resourceId?: string;
      resourceName?: string;
      details?: Record<string, any>;
    } = {}
  ): Promise<void> {
    try {
      // Use passed user data or fall back to req.user
      const userId = options.userId || req.user?.id;
      const userName = options.userName || req.user?.name;
      const userEmail = options.userEmail || req.user?.email;
      const userRole = options.userRole || req.user?.role;
      const companyId = options.companyId || req.user?.company_id;

      if (!userId || !userName) {
        console.log('ActionLogService: Missing user data, skipping log');
        return;
      }

      const { resourceId, resourceName, details } = options;

      await ActionLog.create({
        userId,
        userName,
        userEmail: userEmail || 'unknown',
        userRole: userRole || 'unknown',
        companyId: companyId || 'unknown',
        action,
        resource,
        resourceId,
        resourceName,
        description,
        details,
        ipAddress: req.ip || req.socket.remoteAddress,
        userAgent: req.headers['user-agent'],
      });
      console.log(`Action logged: ${action} - ${description}`);
    } catch (error) {
      // Silently fail - don't break the main operation
      console.error('Failed to log action:', error);
    }
  }

   /**
    * Log site creation
    */
   static async logSiteCreate(req: Request, siteId: string, siteName: string): Promise<void> {
     await this.logFromRequest(req, ActionType.CREATE, ResourceType.SITE, `Created site: ${siteName}`, {
       resourceId: siteId,
       resourceName: siteName,
       details: {
         name: req.body.name,
         location: req.body.location,
         description: req.body.description,
       },
     });
   }

   /**
    * Log site update
    */
   static async logSiteUpdate(req: Request, siteId: string, siteName: string): Promise<void> {
     await this.logFromRequest(req, ActionType.UPDATE, ResourceType.SITE, `Updated site: ${siteName}`, {
       resourceId: siteId,
       resourceName: siteName,
       details: {
         name: req.body.name,
         location: req.body.location,
         description: req.body.description,
         isActive: req.body.isActive,
       },
     });
   }

  /**
   * Log site deletion
   */
  static async logSiteDelete(req: Request, siteId: string, siteName: string): Promise<void> {
    await this.logFromRequest(req, ActionType.DELETE, ResourceType.SITE, `Deleted site: ${siteName}`, {
      resourceId: siteId,
      resourceName: siteName,
    });
  }

  /**
   * Log site record creation
   */
  static async logSiteRecordCreate(
    req: Request,
    recordId: string,
    materialName: string,
    details: any
  ): Promise<void> {
    await this.logFromRequest(
      req,
      ActionType.CREATE,
      ResourceType.SITE_RECORD,
      `Recorded material: ${materialName}`,
      {
        resourceId: recordId,
        resourceName: materialName,
        details,
      }
    );
  }

  /**
   * Log main stock record creation
   */
  static async logMainStockCreate(
    req: Request,
    recordId: string,
    materialName: string,
    details: any
  ): Promise<void> {
    await this.logFromRequest(
      req,
      ActionType.CREATE,
      ResourceType.MAIN_STOCK,
      `Created main stock record: ${materialName}`,
      {
        resourceId: recordId,
        resourceName: materialName,
        details,
      }
    );
  }

  /**
   * Log price update
   */
  static async logPriceUpdate(
    req: Request,
    recordId: string,
    materialName: string,
    oldPrice: number | null,
    newPrice: number
  ): Promise<void> {
    await this.logFromRequest(
      req,
      ActionType.PRICE_UPDATE,
      ResourceType.MAIN_STOCK,
      `Updated price for ${materialName}: ${oldPrice || '-'} → ${newPrice}`,
      {
        resourceId: recordId,
        resourceName: materialName,
        details: { oldPrice, newPrice },
      }
    );
  }

   /**
    * Log material creation
    */
   static async logMaterialCreate(req: Request, materialId: string, materialName: string): Promise<void> {
     await this.logFromRequest(req, ActionType.CREATE, ResourceType.MATERIAL, `Created material: ${materialName}`, {
       resourceId: materialId,
       resourceName: materialName,
       details: {
         name: req.body.name,
         unit: req.body.unit,
         description: req.body.description,
       },
     });
   }

   /**
    * Log material update
    */
   static async logMaterialUpdate(req: Request, materialId: string, materialName: string): Promise<void> {
     await this.logFromRequest(req, ActionType.UPDATE, ResourceType.MATERIAL, `Updated material: ${materialName}`, {
       resourceId: materialId,
       resourceName: materialName,
       details: {
         name: req.body.name,
         unit: req.body.unit,
         description: req.body.description,
       },
     });
   }

  /**
   * Log user creation
   */
  static async logUserCreate(req: Request, userId: string, userName: string, userEmail: string): Promise<void> {
    await this.logFromRequest(req, ActionType.CREATE, ResourceType.USER, `Created user: ${userName} (${userEmail})`, {
      resourceId: userId,
      resourceName: userName,
      details: { email: userEmail, role: req.body.role },
    });
  }

   /**
    * Log user update
    */
   static async logUserUpdate(req: Request, userId: string, userName: string): Promise<void> {
     await this.logFromRequest(
       req,
       ActionType.UPDATE,
       ResourceType.USER,
       `Updated user: ${userName}`,
       {
         userId,
         userName,
         details: {
           name: req.body.name,
           email: req.body.email,
           role: req.body.role,
           assignedSites: req.body.assignedSiteIds,
           isActive: req.body.isActive,
         },
       }
     );
   }

  /**
   * Log user deletion
   */
  static async logUserDelete(req: Request, userId: string, userName: string): Promise<void> {
    await this.logFromRequest(req, ActionType.DELETE, ResourceType.USER, `Deleted user: ${userName}`, {
      resourceId: userId,
      resourceName: userName,
    });
  }

  /**
   * Log manager assignment to site
   */
  static async logManagerAssign(
    req: Request,
    siteId: string,
    siteName: string,
    managerId: string,
    managerName: string
  ): Promise<void> {
    await this.logFromRequest(
      req,
      ActionType.ASSIGN,
      ResourceType.SITE,
      `Assigned manager ${managerName} to site ${siteName}`,
      {
        resourceId: siteId,
        resourceName: siteName,
        details: { managerId, managerName },
      }
    );
  }

  /**
   * Log manager unassignment from site
   */
  static async logManagerUnassign(
    req: Request,
    siteId: string,
    siteName: string,
    managerId: string,
    managerName: string
  ): Promise<void> {
    await this.logFromRequest(
      req,
      ActionType.UNASSIGN,
      ResourceType.SITE,
      `Removed manager ${managerName} from site ${siteName}`,
      {
        resourceId: siteId,
        resourceName: siteName,
        details: { managerId, managerName },
      }
    );
  }

  /**
   * Log sync to main stock
   */
  static async logSyncToMainStock(
    req: Request,
    siteRecordId: string,
    materialName: string,
    syncedQuantity: number
  ): Promise<void> {
    await this.logFromRequest(
      req,
      ActionType.SYNC,
      ResourceType.MAIN_STOCK,
      `Synced ${materialName} to main stock (${syncedQuantity} units)`,
      {
        resourceId: siteRecordId,
        resourceName: materialName,
        details: { syncedQuantity },
      }
    );
  }

  /**
   * Log login
   */
  static async logLogin(
    req: Request,
    userId: string,
    userName: string,
    userEmail: string,
    userRole: string,
    companyId?: string
  ): Promise<void> {
    await this.logFromRequest(req, ActionType.LOGIN, ResourceType.SYSTEM, `User logged in: ${userName}`, {
      userId,
      userName,
      userEmail,
      userRole,
      resourceId: userId,
      resourceName: userName,
      companyId,
    });
  }

  /**
   * Log logout
   */
  static async logLogout(req: Request, userId: string, userName: string): Promise<void> {
    await this.logFromRequest(req, ActionType.LOGOUT, ResourceType.SYSTEM, `User logged out: ${userName}`, {
      resourceId: userId,
      resourceName: userName,
    });
  }
}

export default ActionLogService;
