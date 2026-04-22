"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supertest_1 = __importDefault(require("supertest"));
const index_1 = __importDefault(require("../index"));
describe('Authentication', () => {
    describe('POST /api/auth/login', () => {
        it('should return 400 if credentials are missing', async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post('/api/auth/login')
                .send({});
            expect(response.status).toBe(400);
            expect(response.body.error).toBe('Email and password are required');
        });
        it('should return 401 for invalid credentials', async () => {
            const response = await (0, supertest_1.default)(index_1.default)
                .post('/api/auth/login')
                .send({ email: 'test@test.com', password: 'wrongpassword' });
            expect(response.status).toBe(401);
        });
    });
    describe('GET /api/auth/me', () => {
        it('should return 401 without token', async () => {
            const response = await (0, supertest_1.default)(index_1.default).get('/api/auth/me');
            expect(response.status).toBe(401);
        });
    });
});
//# sourceMappingURL=auth.test.js.map