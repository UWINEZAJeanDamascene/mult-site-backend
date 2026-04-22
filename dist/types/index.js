"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.RecordStatus = exports.RecordSource = exports.UserRole = void 0;
// Enums
var UserRole;
(function (UserRole) {
    UserRole["SITE_MANAGER"] = "site_manager";
    UserRole["MAIN_MANAGER"] = "main_manager";
    UserRole["ACCOUNTANT"] = "accountant";
    UserRole["MANAGER"] = "manager";
})(UserRole || (exports.UserRole = UserRole = {}));
var RecordSource;
(function (RecordSource) {
    RecordSource["SITE"] = "site";
    RecordSource["DIRECT"] = "direct";
})(RecordSource || (exports.RecordSource = RecordSource = {}));
var RecordStatus;
(function (RecordStatus) {
    RecordStatus["PENDING_PRICE"] = "pending_price";
    RecordStatus["PRICED"] = "priced";
    RecordStatus["DIRECT"] = "direct";
})(RecordStatus || (exports.RecordStatus = RecordStatus = {}));
//# sourceMappingURL=index.js.map