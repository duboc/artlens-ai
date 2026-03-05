import WebSocket, { WebSocketServer } from 'ws';
import http from 'http';
import { config } from '../config.js';
import { getAccessToken, getLiveWebSocketUrl } from '../services/vertexai.js';

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

// Build full Vertex AI model resource path from a short model name
function resolveModelPath(model?: string): string {
  const modelName = model || config.vertex.modelLive;
  if (modelName.startsWith('projects/')) return modelName;
  return `projects/${config.projectId}/locations/${config.vertex.regionLive}/publishers/google/models/${modelName}`;
}

export function attachWebSocketServer(server: http.Server) {
  const wss = new WebSocketServer({ server, path: '/ws/live' });

  wss.on('connection', (browserWs: WebSocket) => {
    let upstreamWs: WebSocket | null = null;
    let sessionTimer: NodeJS.Timeout | null = null;

    const cleanup = () => {
      if (sessionTimer) {
        clearTimeout(sessionTimer);
        sessionTimer = null;
      }
      if (upstreamWs) {
        if (upstreamWs.readyState === WebSocket.OPEN || upstreamWs.readyState === WebSocket.CONNECTING) {
          upstreamWs.close();
        }
        upstreamWs = null;
      }
    };

    // Set session timeout
    sessionTimer = setTimeout(() => {
      console.log('Session timeout reached, closing connections');
      browserWs.close(1000, 'Session timeout');
      cleanup();
    }, SESSION_TIMEOUT_MS);

    // Wait for first message (setup) from browser
    let isFirstMessage = true;

    browserWs.on('message', async (data: WebSocket.Data) => {
      const message = data.toString();

      if (isFirstMessage) {
        isFirstMessage = false;

        try {
          // Parse setup message and inject full model resource path
          let setupMsg: any;
          try {
            setupMsg = JSON.parse(message);
          } catch {
            browserWs.close(1008, 'Invalid setup message');
            return;
          }

          if (setupMsg.setup) {
            setupMsg.setup.model = resolveModelPath(setupMsg.setup.model);
          }
          const modifiedMessage = JSON.stringify(setupMsg);

          // Get ADC token and connect to Vertex AI
          const token = await getAccessToken();
          const serviceUrl = getLiveWebSocketUrl();
          const wsUrl = `${serviceUrl}?access_token=${encodeURIComponent(token)}`;

          upstreamWs = new WebSocket(wsUrl);

          upstreamWs.on('open', () => {
            // Forward the modified setup message to Vertex AI
            upstreamWs!.send(modifiedMessage);
          });

          upstreamWs.on('message', (upstreamData: WebSocket.Data) => {
            // Forward Vertex AI messages to browser
            if (browserWs.readyState === WebSocket.OPEN) {
              browserWs.send(upstreamData.toString());
            }
          });

          upstreamWs.on('close', (code: number, reason: Buffer) => {
            console.log(`Upstream WS closed: ${code} ${reason.toString()}`);
            if (browserWs.readyState === WebSocket.OPEN) {
              browserWs.close(1001, reason.toString() || 'Upstream closed');
            }
            cleanup();
          });

          upstreamWs.on('error', (err: Error) => {
            console.error('Upstream WS error:', err.message);
            if (browserWs.readyState === WebSocket.OPEN) {
              browserWs.close(1011, 'Upstream connection error');
            }
            cleanup();
          });
        } catch (err) {
          console.error('Failed to connect to Vertex AI:', err);
          browserWs.close(1008, 'Authentication failed');
          cleanup();
        }
        return;
      }

      // Subsequent messages: forward to Vertex AI
      if (upstreamWs && upstreamWs.readyState === WebSocket.OPEN) {
        upstreamWs.send(message);
      }
    });

    browserWs.on('close', () => {
      cleanup();
    });

    browserWs.on('error', (err: Error) => {
      console.error('Browser WS error:', err.message);
      cleanup();
    });
  });

  return wss;
}
