import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { WebSocketServer } from 'ws';
import { spawn } from 'child_process';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Logger class
class ServerLogger {
    constructor(logFile = null, verbose = false) {
        this.logFile = logFile;
        this.verbose = verbose;
        
        if (logFile) {
            const logDir = path.dirname(logFile);
            if (!fs.existsSync(logDir)) {
                fs.mkdirSync(logDir, { recursive: true });
            }
        }
    }
    
    log(level, message, data = null) {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [${level}] ${message}`;
        
        // Always show errors and important info
        if (this.verbose || level === 'ERROR' || level === 'FATAL' || level === 'INFO') {
            const colors = {
                INFO: '\x1b[32m',
                DEBUG: '\x1b[36m',
                WARN: '\x1b[33m',
                ERROR: '\x1b[31m',
                FATAL: '\x1b[35m'
            };
            const color = colors[level] || '\x1b[0m';
            console.log(color + logMessage + '\x1b[0m');
        }
        
        // Write to file
        if (this.logFile) {
            const fileMessage = logMessage + (data ? '\n' + JSON.stringify(data, null, 2) : '') + '\n';
            fs.appendFileSync(this.logFile, fileMessage, 'utf8');
        }
    }
    
    info(message, data = null) { this.log('INFO', message, data); }
    debug(message, data = null) { this.log('DEBUG', message, data); }
    warn(message, data = null) { this.log('WARN', message, data); }
    error(message, data = null) { this.log('ERROR', message, data); }
}

// Parse command line arguments
const args = process.argv.slice(2);
const parsedArgs = {};
for (let i = 0; i < args.length; i += 2) {
    if (args[i].startsWith('--')) {
        const key = args[i].replace('--', '');
        parsedArgs[key] = args[i + 1];
    }
}

// Configuration
const config = {
    port: parsedArgs.port || process.env.PORT || 3000,
    llamaPort: parsedArgs['llama-port'] || process.env.LLAMA_PORT || 8080,
    wsPort: parsedArgs['ws-port'] || process.env.WS_PORT || 8081,
    model: parsedArgs.model || process.env.MODEL || './../models/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    ctxSize: parsedArgs['ctx-size'] || process.env.CTX_SIZE || 4096,
    nGpuLayers: parsedArgs['gpu-layers'] || process.env.GPU_LAYERS || 20,
    parallel: parsedArgs.parallel || process.env.PARALLEL || 4,
    host: parsedArgs.host || process.env.HOST || '0.0.0.0',
    logFile: parsedArgs['log-file'] || process.env.LOG_FILE || './logs/openchatmobile.log',
    verbose: parsedArgs.verbose === 'true' || process.env.VERBOSE === 'true'
};

// Initialize logger
const logger = new ServerLogger(config.logFile, config.verbose);

logger.info('OpenChatMobile Server Starting...');
logger.info('Configuration loaded:', config);

const app = express();

// Middleware - MEJORAR CORS PARA WEBSOCKET
app.use(cors({
    origin: function(origin, callback) {
        // Permitir todas las solicitudes en desarrollo
        if (!origin || origin.includes('localhost') || origin.includes('127.0.0.1')) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true
}));

app.use(express.json({ limit: '50mb' }));
app.use(express.static('../frontend'));

// Request logging middleware
app.use((req, res, next) => {
    const start = Date.now();
    logger.debug(`${req.method} ${req.url}`, {
        headers: req.headers,
        body: req.body,
        query: req.query
    });
    
    res.on('finish', () => {
        const duration = Date.now() - start;
        logger.info(`${req.method} ${req.url} ${res.statusCode} - ${duration}ms`);
    });
    
    next();
});

// Start LLaMA server
logger.info('Starting LLaMA server...');
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
    logger.info(`LLaMA: ${output.trim()}`);
    if (output.includes('HTTP server listening')) {
        logger.info('LLaMA Server is ready');
    }
});

llamaProcess.stderr.on('data', (data) => {
    logger.error(`LLaMA Error: ${data}`);
});

// WebSocket Server - MEJORAR CONFIGURACIÓN
const wss = new WebSocketServer({ 
    port: config.wsPort,
    perMessageDeflate: false,
    clientTracking: true
});

logger.info(`WebSocket Server started on port ${config.wsPort}`);
logger.info(`WebSocket URL: ws://${config.host}:${config.wsPort}`);

const activeConnections = new Map();

wss.on('connection', (ws, req) => {
    const clientId = Date.now() + Math.random().toString(36).substr(2, 9);
    activeConnections.set(clientId, ws);
    
    logger.info(`New WebSocket client connected: ${clientId}`, {
        ip: req.socket.remoteAddress,
        headers: req.headers
    });
    
    // Send welcome message
    ws.send(JSON.stringify({
        type: 'info',
        message: 'WebSocket connected successfully',
        clientId: clientId,
        timestamp: new Date().toISOString()
    }));
    
    ws.on('message', async (message) => {
        try {
            const data = JSON.parse(message.toString());
            logger.debug(`WebSocket message from ${clientId}:`, data);
            
            if (data.type === 'chat') {
                const response = await fetch(`http://${config.host}:${config.llamaPort}/completion`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        prompt: data.message,
                        n_predict: data.maxTokens || 200,
                        temperature: data.temperature || 0.7,
                        stream: true
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`LLaMA server responded with ${response.status}`);
                }
                
                const reader = response.body.getReader();
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = new TextDecoder().decode(value);
                    logger.debug(`Stream chunk for ${clientId}:`, chunk);
                    
                    chunk.split('\n').forEach(line => {
                        if (line.startsWith('data: ')) {
                            const dataStr = line.substring(6);
                            if (dataStr === '[DONE]') {
                                ws.send(JSON.stringify({ type: 'done' }));
                                logger.debug(`Stream completed for ${clientId}`);
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
                                logger.error('Error parsing stream data:', e.message);
                            }
                        }
                    });
                }
            }
        } catch (error) {
            logger.error(`WebSocket error for ${clientId}:`, error);
            ws.send(JSON.stringify({
                type: 'error',
                message: error.message
            }));
        }
    });
    
    ws.on('close', () => {
        activeConnections.delete(clientId);
        logger.info(`WebSocket client disconnected: ${clientId}`);
    });
    
    ws.on('error', (error) => {
        logger.error(`WebSocket error for ${clientId}:`, error);
    });
    
    // Heartbeat to keep connection alive
    const heartbeatInterval = setInterval(() => {
        if (ws.readyState === ws.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', timestamp: Date.now() }));
        }
    }, 30000);
    
    ws.on('close', () => {
        clearInterval(heartbeatInterval);
    });
});

// API Routes
app.get('/api/health', (req, res) => {
    res.json({
        status: 'ok',
        llama: 'running',
        websocket: {
            connected: activeConnections.size,
            port: config.wsPort
        },
        timestamp: new Date().toISOString(),
        config: {
            port: config.port,
            llamaPort: config.llamaPort,
            wsPort: config.wsPort,
            model: config.model,
            host: config.host
        }
    });
});

app.post('/api/chat', async (req, res) => {
    try {
        const { message, maxTokens = 200, temperature = 0.7 } = req.body;
        
        logger.info('Chat request received:', { messageLength: message.length, maxTokens, temperature });
        
        const response = await fetch(`http://${config.host}:${config.llamaPort}/completion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: message,
                n_predict: maxTokens,
                temperature: temperature,
                stream: false
            })
        });

        const data = await response.json();
        logger.info('Chat response generated:', { 
            tokensUsed: data.tokens_used,
            contentLength: data.content?.length || 0
        });
        
        res.json({
            response: data.content,
            tokens_used: data.tokens_used
        });
        
    } catch (error) {
        logger.error('Chat error:', error);
        res.status(500).json({ error: error.message });
    }
});

// File upload endpoint
app.post('/api/upload', express.raw({ type: '*/*', limit: '10mb' }), async (req, res) => {
    try {
        const filename = req.headers['x-filename'] || 'upload.txt';
        const content = req.body.toString();
        
        logger.info('File upload received:', { filename, size: content.length });
        
        // Process the file content (in a real app, you might want to save it)
        res.json({
            success: true,
            filename: filename,
            size: content.length,
            content: content.substring(0, 1000) // Return first 1000 chars for preview
        });
        
    } catch (error) {
        logger.error('Upload error:', error);
        res.status(500).json({ error: error.message });
    }
});

// Get available models
app.get('/api/models', (req, res) => {
    const modelsDir = path.join(__dirname, '../models');
    const models = [];
    
    try {
        if (fs.existsSync(modelsDir)) {
            const files = fs.readdirSync(modelsDir);
            files.forEach(file => {
                if (file.endsWith('.gguf')) {
                    const stats = fs.statSync(path.join(modelsDir, file));
                    models.push({
                        name: file,
                        path: `./../models/${file}`,
                        size: stats.size,
                        sizeMB: Math.round(stats.size / (1024 * 1024))
                    });
                }
            });
        }
        
        res.json({ models });
    } catch (error) {
        logger.error('Error reading models:', error);
        res.status(500).json({ error: error.message });
    }
});

// Modern Express 5 route with named parameter - MUST BE THE LAST ROUTE
app.get('/{*splat}', (req, res) => {
    logger.debug('Serving frontend for route:', req.url);
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(config.port, () => {
    logger.info(`Backend running at http://${config.host}:${config.port}`);
    logger.info(`Frontend: http://${config.host}:${config.port}`);
    logger.info(`LLaMA: http://${config.host}:${config.llamaPort}`);
    logger.info(`WebSocket: ws://${config.host}:${config.wsPort}`);
    logger.info(`Log file: ${config.logFile}`);
    
    // Log important URLs for debugging
    console.log('\n=== OpenChatMobile Server Ready ===');
    console.log(`Frontend: http://localhost:${config.port}`);
    console.log(`API: http://localhost:${config.port}/api/health`);
    console.log(`WebSocket: ws://localhost:${config.wsPort}`);
    console.log(`LLaMA Server: http://localhost:${config.llamaPort}`);
    console.log('===================================\n');
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
    logger.info('Shutting down...');
    if (llamaProcess) llamaProcess.kill();
    
    // Close all WebSocket connections
    activeConnections.forEach((ws, clientId) => {
        logger.info(`Closing WebSocket connection: ${clientId}`);
        ws.close();
    });
    
    process.exit(0);
});

process.on('SIGINT', () => {
    logger.info('Interrupted, shutting down...');
    if (llamaProcess) llamaProcess.kill();
    process.exit(0);
});