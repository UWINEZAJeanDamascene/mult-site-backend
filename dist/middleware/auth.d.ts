import { Request, Response, NextFunction } from 'express';
import { UserRole } from '../types';
import type { User as UserType } from '../types';
declare global {
    namespace Express {
        interface Request {
            user?: UserType;
            assignedSiteIds?: string[];
        }
    }
}
export declare function authenticateToken(req: Request, res: Response, next: NextFunction): Promise<void>;
export declare function requirePermission(action: string, resource: string): (req: Request, res: Response, next: NextFunction) => void;
export declare function requireRole(allowedRoles: UserRole[]): (req: Request, res: Response, next: NextFunction) => void;
export declare function requireMainStockManager(req: Request, res: Response, next: NextFunction): void;
export declare function requireSiteAccess(siteIdParam?: string): (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function requireSiteRecordOwnership(req: Request, res: Response, next: NextFunction): Promise<void>;
//# sourceMappingURL=auth.d.ts.map