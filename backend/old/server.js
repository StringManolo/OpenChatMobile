import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration from environment variables
const config = {
  port: process.env.PORT || 3000,
  llamaPort: process.env.LLAMA_PORT || 8080,
  wsPort: process.env.WS_PORT || 8081,
  model: process.env.MODEL || './../models/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
  ctxSize: process.env.CTX_SIZE || 4096,
  nGpuLayers: process.env.GPU_LAYERS || 20,
  parallel: process.env.PARALLEL || 4,
  host: process.env.HOST || '0.0.0.0'
};

const app = express();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// Log configuration
console.log('Configuration loaded:');
console.log(`- Backend port: ${config.port}`);
console.log(`- LLaMA port: ${config.llamaPort}`);
console.log(`- WebSocket port: ${config.wsPort}`);
console.log(`- Model: ${config.model}`);

// Start LLaMA server
console.log('Starting LLaMA server...');
const llamaProcess = spawn('./../bin/llama-server', [
  '-m', config.model,
  '--port', config.llamaPort.toString(),
  '--host', config.host,
  '--ctx-size', config.ctxSize.toString(),
  '--n-gpu-layers', config.nGpuLayers.toString(),
  '--cont-batching',
  '--parallel', config.parallel.toString(),
  '--log-disable'
]);

llamaProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(`LLaMA: ${output.trim()}`);
  if (output.includes('HTTP server listening')) {
    console.log('LLaMA Server ready');
  }
});

llamaProcess.stderr.on('data', (data) => {
  console.error(`LLaMA Error: ${data}`);
});

// WebSocket Server
const wss = new WebSocketServer({ port: config.wsPort });
console.log(`WebSocket Server on port ${config.wsPort}`);

wss.on('connection', (ws) => {
  console.log('New WebSocket client connected');

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message.toString());

      if (data.type === 'chat') {
        const response = await fetch(`http://localhost:${config.llamaPort}/completion`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            prompt: data.message,
            n_predict: data.maxTokens || 200,
            temperature: data.temperature || 0.7,
            stream: true
          })
        });
        const reader = response.body.getReader();

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = new TextDecoder().decode(value);
          chunk.split('\n').forEach(line => {
            if (line.startsWith('data: ')) {
              const dataStr = line.substring(6);
              if (dataStr === '[DONE]') {
                ws.send(JSON.stringify({ type: 'done' }));
                return;
              }

              try {
                const jsonData = JSON.parse(dataStr);
                if (jsonData.content) {
                  ws.send(JSON.stringify({
                    type: 'token',
                    token: jsonData.content
                  }));
                }
              } catch (e) {
                // Ignore
              }
            }
          });
        }
      }
    } catch (error) {
      console.error('WebSocket error:', error);
      ws.send(JSON.stringify({
        type: 'error',
        message: error.message
      }));
    }
  });
});

// API Routes
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    llama: 'running',
    timestamp: new Date().toISOString()
  });
});

app.post('/api/chat', async (req, res) => {
  try {
    const { message } = req.body;

    const response = await fetch(`http://localhost:${config.llamaPort}/completion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        prompt: message,
        n_predict: 200,
        temperature: 0.7,
        stream: false
      })
    });

    const data = await response.json();
    res.json({
      response: data.content,
      tokens_used: data.tokens_used
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Modern Express 5 route with named parameter - MUST BE THE LAST ROUTE
app.get('/{*splat}', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

// Fallback for Express 4 (uncomment if needed)
// app.get('*', (req, res) => {
//   res.sendFile(path.join(__dirname, '../frontend/index.html'));
// });

app.listen(config.port, () => {
  console.log(`Backend running at http://localhost:${config.port}`);
  console.log(`Frontend: http://localhost:${config.port}`);
  console.log(`LLaMA: http://localhost:${config.llamaPort}`);
  console.log(`WebSocket: ws://localhost:${config.wsPort}`);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('Shutting down...');
  if (llamaProcess) llamaProcess.kill();
  process.exit(0);
});