import { MongoClient, Db } from 'mongodb';
declare let client: MongoClient;
declare let db: Db;
export declare function connectDB(): Promise<Db>;
export declare function getDB(): Db;
export declare function disconnectDB(): Promise<void>;
export { client, db };
declare const _default: {
    connectDB: typeof connectDB;
    getDB: typeof getDB;
    disconnectDB: typeof disconnectDB;
};
export default _default;
//# sourceMappingURL=database.d.ts.map