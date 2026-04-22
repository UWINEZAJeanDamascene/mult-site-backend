import { User, UserRole } from '../types';
export declare function hashPassword(password: string): Promise<string>;
export declare function verifyPassword(password: string, hashedPassword: string): Promise<boolean>;
export declare function generateToken(user: User): string;
export declare function verifyToken(token: string): Omit<User, 'isActive'> & {
    iat: number;
    exp: number;
};
export declare function hasPermission(role: UserRole, action: string, resource: string): boolean;
export declare function canAccessSite(user: User, siteId: string, assignedSiteIds: string[]): boolean;
export declare function canModifySiteRecord(user: User, recordCreatorId: string, siteId: string, assignedSiteIds: string[]): boolean;
//# sourceMappingURL=auth.d.ts.map