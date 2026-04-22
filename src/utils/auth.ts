import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { config } from '../config';
import { User, UserRole } from '../types';

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

export function generateToken(user: User): string {
  const assignedSiteIds = (user.assignedSites || []).map((s) => {
    if (typeof s === 'string') return s;
    if (typeof s === 'object' && 'id' in s) return s.id;
    if (typeof s === 'object' && '_id' in s) return (s as any)._id.toString();
    return String(s);
  });

  const payload = {
    userId: user.id,
    email: user.email,
    role: user.role,
    name: user.name,
    company_id: user.company_id,
    assignedSiteIds,
  };

  return jwt.sign(payload, config.JWT.SECRET, {
    expiresIn: config.JWT.EXPIRES_IN as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string): Omit<User, 'isActive'> & { iat: number; exp: number } {
  return jwt.verify(token, config.JWT.SECRET) as Omit<User, 'isActive'> & { iat: number; exp: number };
}

// RBAC Permission Matrix
const PERMISSIONS: Record<UserRole, Record<string, string[]>> = {
  [UserRole.SITE_MANAGER]: {
    site: ['read_own'],
    siteRecord: ['create', 'read_own', 'update_own', 'delete_own'],
    mainStock: [], // No access to main stock
    user: ['read_own'],
    views: [], // No access to derived views
  },
  [UserRole.MAIN_MANAGER]: {
    site: ['create', 'read', 'update', 'delete', 'manage'],
    siteRecord: ['create', 'read', 'update', 'delete', 'manage'], // Full access including editing price
    mainStock: ['create', 'read', 'update', 'delete', 'manage'],
    user: ['create', 'read', 'update', 'delete', 'manage'],
    views: ['read', 'manage'],
  },
  [UserRole.ACCOUNTANT]: {
    site: ['create', 'read', 'update', 'delete', 'manage'],
    siteRecord: ['create', 'read', 'update', 'delete', 'manage'],
    mainStock: ['create', 'read', 'update', 'delete', 'manage'],
    user: ['read', 'update'], // can view and update users but not create/delete
    views: ['read', 'manage'],
  },
  [UserRole.MANAGER]: {
    site: ['create', 'read', 'update', 'delete', 'manage'],
    siteRecord: ['create', 'read', 'update', 'delete', 'manage'],
    mainStock: ['create', 'read', 'update', 'delete', 'manage'],
    user: ['create', 'read', 'update', 'delete', 'manage'],
    views: ['read', 'manage'],
  },
};

export function hasPermission(
  role: UserRole,
  action: string,
  resource: string
): boolean {
  const resourcePerms = PERMISSIONS[role][resource];
  if (!resourcePerms) return false;

  // Management roles have full access
  if (role === UserRole.MAIN_MANAGER || role === UserRole.ACCOUNTANT || role === UserRole.MANAGER) {
    return resourcePerms.includes(action) || resourcePerms.includes('manage');
  }

  // Site manager can only access own site data
  if (action.startsWith('read') && resourcePerms.includes('read_own')) return true;
  if (action.startsWith('update') && resourcePerms.includes('update_own')) return true;
  if (action.startsWith('delete') && resourcePerms.includes('delete_own')) return true;
  if (action.startsWith('create') && resourcePerms.includes('create')) return true;

  return resourcePerms.includes(action);
}

export function canAccessSite(user: User, siteId: string, assignedSiteIds: string[]): boolean {
  if (user.role === UserRole.MAIN_MANAGER || user.role === UserRole.ACCOUNTANT || user.role === UserRole.MANAGER) return true;
  return assignedSiteIds.includes(siteId);
}

export function canModifySiteRecord(
  user: User,
  recordCreatorId: string,
  siteId: string,
  assignedSiteIds: string[]
): boolean {
  if (user.role === UserRole.MAIN_MANAGER || user.role === UserRole.ACCOUNTANT || user.role === UserRole.MANAGER) return true;
  // Site manager can only modify their own records on their assigned sites
  return user.id === recordCreatorId && assignedSiteIds.includes(siteId);
}
