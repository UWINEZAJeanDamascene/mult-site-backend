"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.requiresMainManager = exports.canManageUsers = exports.canEdit = exports.hasFullAccess = void 0;
const hasFullAccess = (role) => {
    // Roles with full read/write access to all resources
    return ['main_manager', 'accountant', 'manager'].includes(role);
};
exports.hasFullAccess = hasFullAccess;
const canEdit = (role) => {
    // All management roles can create/update/delete
    return ['main_manager', 'accountant', 'manager'].includes(role);
};
exports.canEdit = canEdit;
const canManageUsers = (role) => {
    // All management roles can manage users
    return ['main_manager', 'accountant', 'manager'].includes(role);
};
exports.canManageUsers = canManageUsers;
const requiresMainManager = (role) => {
    // For operations restricted to management roles only
    return ['main_manager', 'accountant', 'manager'].includes(role);
};
exports.requiresMainManager = requiresMainManager;
//# sourceMappingURL=permissions.js.map