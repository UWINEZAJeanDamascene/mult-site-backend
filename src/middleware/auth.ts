import { Request, Response, NextFunction } from 'express';
import { verifyToken, hasPermission, canAccessSite } from '../utils/auth';
import { User } from '../models';
import { UserRole } from '../types';
import type { IUserDocument } from '../models/User';
import { Types } from 'mongoose';
import type { User as UserType } from '../types';

// Extend Express Request
declare global {
  namespace Express {
    interface Request {
      user?: UserType;
      assignedSiteIds?: string[];
    }
  }
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers['authorization'];
    // Support token from Authorization header or httpOnly cookie named access_token
    const tokenFromHeader = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN
    const tokenFromCookie = req.cookies && (req.cookies as any).access_token;
    const token = tokenFromHeader || tokenFromCookie;

    // Debug logging to help diagnose cross-origin cookie / header issues in deployments
    try {
      console.debug('[Auth] Incoming request origin:', req.headers.origin || 'none');
      console.debug('[Auth] Authorization header present:', !!authHeader);
      if (authHeader && typeof authHeader === 'string') {
        console.debug('[Auth] Authorization header (masked):', authHeader.slice(0, 30) + (authHeader.length > 30 ? '...' : ''))
      }
      console.debug('[Auth] access_token cookie present:', !!tokenFromCookie);
      if (tokenFromCookie && typeof tokenFromCookie === 'string') {
        console.debug('[Auth] access_token cookie length:', tokenFromCookie.length);
      }
    } catch (err) {
      console.debug('[Auth] Failed to log auth debug info', err);
    }

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    const decoded = verifyToken(token);

    // Support both 'id' and 'userId' in token for backwards compatibility
    const userId = (decoded as any).userId || (decoded as any).id;

    // Verify user still exists and is active
    const user = await User.findById(userId).select('-password');

    if (!user || !user.isActive) {
      res.status(401).json({ error: 'User not found or inactive' });
      return;
    }

    // For site managers, get their assigned sites
    let assignedSiteIds: string[] = [];
    if (user.role === UserRole.SITE_MANAGER && user.assignedSites) {
      assignedSiteIds = user.assignedSites.map((id: any) => id.toString());
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      name: user.name,
      role: user.role as any, // Cast to UserType's UserRole
      company_id: user.company_id,
      isActive: user.isActive,
    };
    req.assignedSiteIds = assignedSiteIds;

    next();
  } catch (error) {
    console.error('[Auth] Token verification failed:', error);
    res.status(403).json({ error: 'Invalid or expired token' });
    return;
  }
}

export function requirePermission(action: string, resource: string) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!hasPermission(req.user.role, action, resource)) {
      res.status(403).json({ error: 'Permission denied' });
      return;
    }

    next();
  };
}

export function requireRole(allowedRoles: UserRole[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({ error: 'Insufficient permissions' });
      return;
    }

    next();
  };
}

export function requireMainStockManager(
  req: Request,
  res: Response,
  next: NextFunction
): void {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  const { method } = req;
  const isRead = ['GET', 'HEAD'].includes(method);
  const canAccess = [UserRole.MAIN_MANAGER, UserRole.ACCOUNTANT, UserRole.MANAGER].includes(req.user.role);

  if (!canAccess) {
    res.status(403).json({ error: 'Access denied' });
    return;
  }

  next();
}

export function requireSiteAccess(siteIdParam: string = 'siteId') {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (!req.user || !req.assignedSiteIds) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Management roles can access all sites
    if ([UserRole.MAIN_MANAGER, UserRole.ACCOUNTANT, UserRole.MANAGER].includes(req.user.role)) {
      next();
      return;
    }

    const siteId = req.params[siteIdParam] || req.body.siteId || req.query.siteId;

    if (!siteId) {
      res.status(400).json({ error: 'Site ID required' });
      return;
    }

    if (!canAccessSite(req.user, siteId, req.assignedSiteIds)) {
      res.status(403).json({ error: 'Access denied to this site' });
      return;
    }

    next();
  };
}

export async function requireSiteRecordOwnership(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  if (!req.user || !req.assignedSiteIds) {
    res.status(401).json({ error: 'Authentication required' });
    return;
  }

  // Management roles can modify any record
  if ([UserRole.MAIN_MANAGER, UserRole.ACCOUNTANT, UserRole.MANAGER].includes(req.user.role)) {
    next();
    return;
  }

  const recordId = req.params.id;
  if (!recordId) {
    res.status(400).json({ error: 'Record ID required' });
    return;
  }

  // Import SiteRecord model dynamically to avoid circular dependency
  const { SiteRecord } = await import('../models/SiteRecord');
  const record = await SiteRecord.findById(recordId).select('recordedBy site_id');

  if (!record) {
    res.status(404).json({ error: 'Record not found' });
    return;
  }

  // Site manager can only modify their own records on their assigned sites
  const recordedById = record.recordedBy?.toString();
  const siteId = record.site_id?.toString();

  if (
    recordedById !== req.user.id ||
    !req.assignedSiteIds.includes(siteId || '')
  ) {
    res.status(403).json({ error: 'Can only modify your own records' });
    return;
  }

  next();
}
