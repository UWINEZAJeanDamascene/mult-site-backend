import { UserRole } from '../types'

export const hasFullAccess = (role: UserRole): boolean => {
  // Roles with full read/write access to all resources
  return ['main_manager', 'accountant', 'manager'].includes(role)
}

export const canEdit = (role: UserRole): boolean => {
  // All management roles can create/update/delete
  return ['main_manager', 'accountant', 'manager'].includes(role)
}

export const canManageUsers = (role: UserRole): boolean => {
  // All management roles can manage users
  return ['main_manager', 'accountant', 'manager'].includes(role)
}

export const requiresMainManager = (role: UserRole): boolean => {
  // For operations restricted to management roles only
  return ['main_manager', 'accountant', 'manager'].includes(role)
}
