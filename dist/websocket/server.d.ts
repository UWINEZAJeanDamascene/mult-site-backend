import { WebSocketServer } from 'ws';
import { StockUpdateEvent } from '../types';
export declare function initializeWebSocketServer(): WebSocketServer;
export declare function broadcastToClients(event: StockUpdateEvent): void;
export declare function broadcastToSite(siteId: string, event: StockUpdateEvent): void;
export declare function getConnectedClientCount(): number;
export declare function closeWebSocketServer(): void;
//# sourceMappingURL=server.d.ts.map