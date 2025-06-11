class WebSocketService {
  constructor() {
    this.ws = null;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
    this.reconnectTimeout = 1000; // Start with 1 second
    this.messageHandlers = new Map();
    this.isConnecting = false;
    // Use environment variables for WebSocket configuration
    this.wsPort = process.env.REACT_APP_WS_PORT || '9000';
    this.wsHost = process.env.REACT_APP_WS_HOST || 'localhost';
  }

  async connect(type = 'notifications') {
    if (this.isConnecting) return;
    this.isConnecting = true;

    try {
      // Get the WebSocket token
      const response = await fetch(`/api/${type}/ws-token`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('accessToken')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to get WebSocket token');
      }

      const { data: { wsToken } } = await response.json();
      
      // Create WebSocket connection with the token
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${this.wsHost}:${this.wsPort}/ws/${type}?token=${wsToken}`;
      
      console.log('Connecting to WebSocket:', wsUrl);
      this.ws = new WebSocket(wsUrl);

      // Setup event handlers
      this.ws.onopen = this.handleOpen.bind(this);
      this.ws.onclose = this.handleClose.bind(this);
      this.ws.onmessage = this.handleMessage.bind(this);
      this.ws.onerror = this.handleError.bind(this);

    } catch (error) {
      console.error('WebSocket connection failed:', error);
      this.attemptReconnect();
    } finally {
      this.isConnecting = false;
    }
  }

  handleOpen() {
    console.log('WebSocket connected');
    this.reconnectAttempts = 0;
    this.reconnectTimeout = 1000;
  }

  handleClose() {
    console.log('WebSocket closed');
    this.attemptReconnect();
  }

  handleMessage(event) {
    try {
      const data = JSON.parse(event.data);
      
      // Call all registered handlers for this message type
      const handlers = this.messageHandlers.get(data.type) || [];
      handlers.forEach(handler => handler(data));

    } catch (error) {
      console.error('Failed to handle WebSocket message:', error);
    }
  }

  handleError(error) {
    console.error('WebSocket error:', error);
  }

  attemptReconnect() {
    if (this.reconnectAttempts < this.maxReconnectAttempts) {
      setTimeout(() => {
        console.log(`Attempting to reconnect (${this.reconnectAttempts + 1}/${this.maxReconnectAttempts})...`);
        this.reconnectAttempts++;
        this.connect();
        // Exponential backoff
        this.reconnectTimeout *= 2;
      }, this.reconnectTimeout);
    } else {
      console.error('Max reconnection attempts reached');
    }
  }

  // Register a message handler
  on(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, []);
    }
    this.messageHandlers.get(messageType).push(handler);
  }

  // Remove a message handler
  off(messageType, handler) {
    if (!this.messageHandlers.has(messageType)) return;
    
    const handlers = this.messageHandlers.get(messageType);
    const index = handlers.indexOf(handler);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  // Send a message
  send(data) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    } else {
      console.error('WebSocket is not connected');
    }
  }

  // Close the connection
  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}

// Create singleton instances for different WebSocket types
export const notificationWS = new WebSocketService();
export const messageWS = new WebSocketService();