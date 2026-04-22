"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.connectDB = connectDB;
exports.disconnectDB = disconnectDB;
const mongoose_1 = __importDefault(require("mongoose"));
const index_1 = require("./index");
const uri = index_1.config.DATABASE_URL || 'mongodb://localhost:27017/siteSock';
async function connectDB() {
    try {
        await mongoose_1.default.connect(uri);
        console.log('Connected to MongoDB via Mongoose');
    }
    catch (error) {
        console.error('Failed to connect to MongoDB:', error);
        throw error;
    }
}
async function disconnectDB() {
    await mongoose_1.default.disconnect();
    console.log('Disconnected from MongoDB');
}
exports.default = mongoose_1.default;
//# sourceMappingURL=mongoose.js.map