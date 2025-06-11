import { EventEmitter } from 'events';
import WebSocket from 'ws';
import logger from '../logger.service.js';
import metricsService from './metrics.service.js';

class RealtimeMonitoringService extends EventEmitter {
  constructor() {
    super();
    this.clients = new Map();
    this.metrics = {
      connections: 0,
      messages: 0,
      errors: 0
    };
    this.initializeWebSocket();
  }

  initializeWebSocket() {
    this.wss = new WebSocket.Server({ noServer: true });

    this.wss.on('connection', (ws, req) => {
      const clientId = crypto.randomUUID();
      this.handleNewConnection(ws, clientId, req);
    });

    this.startMetricsInterval();
  }

  handleNewConnection(ws, clientId, req) {
    this.clients.set(clientId, {
      ws,
      connectedAt: Date.now(),
      ip: req.socket.remoteAddress,
      lastPing: Date.now()
    });

    this.metrics.connections++;

    ws.on('message', (message) => {
      this.handleMessage(clientId, message);
    });

    ws.on('close', () => {
      this.handleDisconnection(clientId);
    });

    ws.on('error', (error) => {
      this.handleError(clientId, error);
    });

    // Send initial state
    this.sendInitialState(ws);
    this.setupHeartbeat(ws, clientId);
  }

  handleMessage(clientId, message) {
    try {
      const data = JSON.parse(message);
      this.metrics.messages++;

      switch (data.type) {
        case 'subscribe':
          this.handleSubscription(clientId, data.channels);
          break;
        case 'unsubscribe':
          this.handleUnsubscription(clientId, data.channels);
          break;
        case 'pong':
          this.updateClientPing(clientId);
          break;
        default:
          this.handleCustomMessage(clientId, data);
      }
    } catch (error) {
      this.handleError(clientId, error);
    }
  }

  handleDisconnection(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      this.metrics.connections--;
      this.clients.delete(clientId);
      this.emit('client:disconnected', { clientId });
    }
  }

  handleError(clientId, error) {
    this.metrics.errors++;
    logger.error(`WebSocket error for client ${clientId}:`, error);
    this.emit('error', { clientId, error });
  }

  async sendInitialState(ws) {
    try {
      const initialState = await this.getInitialState();
      ws.send(JSON.stringify({
        type: 'initial_state',
        data: initialState
      }));
    } catch (error) {
      logger.error('Error sending initial state:', error);
    }
  }

  setupHeartbeat(ws, clientId) {
    const interval = setInterval(() => {
      if (!this.clients.has(clientId)) {
        clearInterval(interval);
        return;
      }

      const client = this.clients.get(clientId);
      if (Date.now() - client.lastPing > 30000) {
        ws.terminate();
        this.handleDisconnection(clientId);
        clearInterval(interval);
        return;
      }

      ws.send(JSON.stringify({ type: 'ping' }));
    }, 15000);
  }

  updateClientPing(clientId) {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastPing = Date.now();
    }
  }

  broadcast(data, channel = null) {
    const message = JSON.stringify({
      type: 'broadcast',
      channel,
      data,
      timestamp: Date.now()
    });

    for (const [clientId, client] of this.clients) {
      if (!channel || client.channels?.includes(channel)) {
        try {
          client.ws.send(message);
        } catch (error) {
          this.handleError(clientId, error);
        }
      }
    }
  }

  startMetricsInterval() {
    setInterval(() => {
      this.broadcastMetrics();
    }, 5000);
  }

  async broadcastMetrics() {
    try {
      const metrics = await metricsService.getMetricsReport();
      this.broadcast({
        type: 'metrics_update',
        data: metrics
      }, 'system_metrics');
    } catch (error) {
      logger.error('Error broadcasting metrics:', error);
    }
  }

  private async getInitialState() {
    return {
      metrics: await metricsService.getMetricsReport(),
      activeConnections: this.metrics.connections,
      serverTime: Date.now()
    };
  }

  getMonitoringStats() {
    return {
      activeConnections: this.metrics.connections,
      totalMessages: this.metrics.messages,
      errorCount: this.metrics.errors,
      clients: Array.from(this.clients.entries()).map(([id, client]) => ({
        id,
        connectedAt: client.connectedAt,
        ip: client.ip,
        lastPing: client.lastPing
      }))
    };
  }
}

export default new RealtimeMonitoringService(); 
export default new RealtimeMonitoring(); 