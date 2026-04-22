export declare enum UserRole {
    SITE_MANAGER = "site_manager",
    MAIN_MANAGER = "main_manager",
    ACCOUNTANT = "accountant",
    MANAGER = "manager"
}
export declare enum RecordSource {
    SITE = "site",
    DIRECT = "direct"
}
export declare enum RecordStatus {
    PENDING_PRICE = "pending_price",
    PRICED = "priced",
    DIRECT = "direct"
}
export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
    company_id: string;
    isActive: boolean;
    assignedSites?: {
        id: string;
        name: string;
    }[];
}
export interface UserWithToken extends User {
    token: string;
}
export interface Site {
    id: string;
    name: string;
    location?: string;
    description?: string;
    company_id: string;
    isActive: boolean;
    createdBy: string;
    createdAt: Date;
}
export interface SiteRecord {
    id: string;
    site_id: string;
    material_id?: string;
    materialName: string;
    quantityReceived: number;
    quantityUsed: number;
    date: Date;
    notes?: string;
    recordedBy: string;
    company_id: string;
    syncedToMainStock: boolean;
    mainStockEntryId?: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateSiteRecordInput {
    materialName: string;
    quantityReceived?: number;
    quantityUsed?: number;
    date: Date;
    notes?: string;
    siteId: string;
}
export interface UpdateSiteRecordInput {
    materialName?: string;
    quantityReceived?: number;
    quantityUsed?: number;
    date?: Date;
    notes?: string;
}
export interface MainStockRecord {
    id: string;
    source: RecordSource;
    site_id?: string;
    siteRecord_id?: string;
    material_id?: string;
    materialName: string;
    quantityReceived: number;
    quantityUsed: number;
    price?: number;
    totalValue?: number;
    date: Date;
    status: RecordStatus;
    notes?: string;
    recordedBy: string;
    company_id: string;
    createdAt: Date;
    updatedAt: Date;
}
export interface CreateDirectRecordInput {
    material: string;
    siteSource: string;
    quantityReceived?: number;
    quantityUsed?: number;
    price?: number;
    date: Date;
    notes?: string;
}
export interface UpdateMainStockRecordInput {
    material?: string;
    quantityReceived?: number;
    quantityUsed?: number;
    price?: number;
    date?: Date;
    status?: RecordStatus;
    notes?: string;
}
export interface UsedMaterialView {
    id: string;
    material: string;
    totalQuantityUsed: number;
    avgPrice?: number;
    totalValue?: number;
    recordCount: number;
    siteBreakdown?: Record<string, number>;
    updatedAt: Date;
}
export interface RemainingMaterialView {
    id: string;
    material: string;
    totalReceived: number;
    totalUsed: number;
    remainingQuantity: number;
    avgPrice?: number;
    remainingValue?: number;
    siteBreakdown?: Record<string, {
        received: number;
        used: number;
        remaining: number;
    }>;
    updatedAt: Date;
}
export interface AuthenticatedRequest {
    user: User;
}
export interface StockUpdateEvent {
    type: 'SITE_RECORD_CREATED' | 'SITE_RECORD_UPDATED' | 'MAIN_STOCK_UPDATED' | 'VIEWS_UPDATED';
    payload: unknown;
    timestamp: Date;
}
export interface PermissionCheck {
    role: UserRole;
    action: 'create' | 'read' | 'update' | 'delete' | 'manage';
    resource: 'site' | 'siteRecord' | 'mainStock' | 'user' | 'views';
}
//# sourceMappingURL=index.d.ts.map