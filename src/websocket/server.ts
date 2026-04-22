import { WebSocketServer, WebSocket } from 'ws';
import { config } from '../config';
import { StockUpdateEvent } from '../types';

let wss: WebSocketServer | null = null;
const clients = new Set<WebSocket>();

export function initializeWebSocketServer(): WebSocketServer {
  const port = config.WS_PORT;

  wss = new WebSocketServer({ port });

  wss.on('connection', (ws: WebSocket) => {
    console.log('WebSocket client connected');
    clients.add(ws);

    // Send initial connection confirmation
    ws.send(JSON.stringify({
      type: 'CONNECTED',
      payload: { message: 'Connected to Lilstock WebSocket' },
      timestamp: new Date(),
    }));

    ws.on('message', (message: Buffer) => {
      try {
        const data = JSON.parse(message.toString());
        console.log('WebSocket message received:', data);

        // Handle ping/pong for keepalive
        if (data.type === 'PING') {
          ws.send(JSON.stringify({ type: 'PONG', timestamp: new Date() }));
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      console.log('WebSocket client disconnected');
      clients.delete(ws);
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
      clients.delete(ws);
    });
  });

  console.log(`WebSocket server running on port ${port}`);

  return wss;
}

export function broadcastToClients(event: StockUpdateEvent): void {
  if (clients.size === 0) return;

  const message = JSON.stringify(event);

  clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

export function broadcastToSite(siteId: string, event: StockUpdateEvent): void {
  // In a real implementation, you'd track which clients are subscribed to which sites
  // For now, broadcast to all and let clients filter by siteId in the payload
  broadcastToClients({
    ...event,
    payload: { ...event.payload as object, siteId },
  });
}

export function getConnectedClientCount(): number {
  return clients.size;
}

export function closeWebSocketServer(): void {
  if (wss) {
    wss.close(() => {
      console.log('WebSocket server closed');
    });
    clients.clear();
    wss = null;
  }
}
