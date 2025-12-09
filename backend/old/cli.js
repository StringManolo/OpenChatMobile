#!/usr/bin/env node

import parseCLI from 'simpleargumentsparser';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Default configuration
const DEFAULT_CONFIG = {
  port: 3000,
  llamaPort: 8080,
  wsPort: 8081,
  model: './../models/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
  ctxSize: 4096,
  nGpuLayers: 20,
  parallel: 4,
  host: '0.0.0.0'
};

// Global variables for processes
let llamaProcess = null;
let expressProcess = null;

const usage = `
OpenChatMobile CLI - LLaMA chat server manager

Usage: open-chat-mobile [COMMAND] [OPTIONS]

Commands:
  start                   Start the server (default)
  stop                   Stop the server
  restart                Restart the server
  status                 Show server status
  logs                   View server logs
  config                 Show/edit configuration

Options:
  -p, --port <num>       Backend server port (default: ${DEFAULT_CONFIG.port})
  --llama-port <num>     LLaMA server port (default: ${DEFAULT_CONFIG.llamaPort})
  --ws-port <num>        WebSocket port (default: ${DEFAULT_CONFIG.wsPort})
  -m, --model <path>     Path to GGUF model (default: ${DEFAULT_CONFIG.model})
  --ctx-size <num>       Context size (default: ${DEFAULT_CONFIG.ctxSize})
  --gpu-layers <num>     GPU layers to use (default: ${DEFAULT_CONFIG.nGpuLayers})
  --parallel <num>       Parallelization (default: ${DEFAULT_CONFIG.parallel})
  --host <ip>            Host to bind (default: ${DEFAULT_CONFIG.host})
  
  -h, --help            Show this help
  -v, --version         Show version
  -d, --debug           Debug mode
  --foreground          Run in foreground (no daemon)

Examples:
  open-chat-mobile start --port 4000 --model ./models/my-model.gguf
  open-chat-mobile stop
  open-chat-mobile logs --follow
  open-chat-mobile config set --port 4000
`;

const version = '1.0.0';

// Helper functions
function getPidFile() {
  return path.join(__dirname, '.open-chat-mobile.pid');
}

function getLogFile() {
  return path.join(__dirname, 'open-chat-mobile.log');
}

function getConfigFile() {
  return path.join(__dirname, 'open-chat-mobile.config.json');
}

function loadConfig() {
  try {
    const configFile = getConfigFile();
    if (fs.existsSync(configFile)) {
      const data = fs.readFileSync(configFile, 'utf8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('Error loading configuration:', error.message);
  }
  return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
  try {
    const configFile = getConfigFile();
    fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
    console.log('Configuration saved');
  } catch (error) {
    console.error('Error saving configuration:', error.message);
  }
}

function writePid(pid) {
  try {
    fs.writeFileSync(getPidFile(), pid.toString());
  } catch (error) {
    console.error('Error writing PID:', error.message);
  }
}

function readPid() {
  try {
    const pidFile = getPidFile();
    if (fs.existsSync(pidFile)) {
      const pid = parseInt(fs.readFileSync(pidFile, 'utf8').trim());
      if (pid && pid > 0) return pid;
    }
  } catch (error) {
    // Ignore error
  }
  return null;
}

function killProcess(pid) {
  try {
    process.kill(pid, 'SIGTERM');
    return true;
  } catch (error) {
    return false;
  }
}

function isProcessRunning(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

// Command functions
async function startServer(cli, config) {
  const isForeground = cli.c.foreground || false;
  
  console.log('Starting OpenChatMobile...');
  console.log(`Model: ${config.model}`);
  console.log(`Backend: http://${config.host}:${config.port}`);
  console.log(`LLaMA: http://${config.host}:${config.llamaPort}`);
  console.log(`WebSocket: ws://${config.host}:${config.wsPort}`);
  
  if (isForeground) {
    await startInForeground(config);
  } else {
    startAsDaemon(config);
  }
}

function startAsDaemon(config) {
  const serverScript = path.join(__dirname, 'server.js');
  
  // Build arguments for the server
  const args = [
    serverScript,
    '--llama-port', config.llamaPort.toString(),
    '--port', config.port.toString(),
    '--model', config.model,
    '--ctx-size', config.ctxSize.toString(),
    '--gpu-layers', config.nGpuLayers.toString(),
    '--parallel', config.parallel.toString(),
    '--host', config.host
  ];
  
  const child = spawn('node', args, {
    detached: true,
    stdio: 'ignore',
    env: { ...process.env, NODE_ENV: 'production' }
  });
  
  child.unref();
  writePid(child.pid);
  
  console.log(`Server started as daemon (PID: ${child.pid})`);
  console.log(`Logs: ${getLogFile()}`);
  console.log('Use "open-chat-mobile logs" to view logs');
  console.log('Use "open-chat-mobile stop" to stop the server');
}

async function startInForeground(config) {
  console.log('Starting in foreground...');
  
  // Start LLaMA server
  console.log('Starting LLaMA server...');
  llamaProcess = spawn('./../bin/llama-server', [
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
  });
  
  llamaProcess.stderr.on('data', (data) => {
    console.error(`LLaMA Error: ${data}`);
  });
  
  // Start Express server
  const serverScript = path.join(__dirname, 'server.js');
  
  // Wait for LLaMA to be ready
  await new Promise(resolve => setTimeout(resolve, 2000));
  
  expressProcess = spawn('node', [serverScript], {
    stdio: 'inherit',
    env: { 
      ...process.env, 
      PORT: config.port,
      LLAMA_PORT: config.llamaPort,
      WS_PORT: config.wsPort
    }
  });
  
  // Handle termination signals
  process.on('SIGINT', () => {
    console.log('Stopping servers...');
    if (llamaProcess) llamaProcess.kill();
    if (expressProcess) expressProcess.kill();
    process.exit(0);
  });
}

function stopServer() {
  const pid = readPid();
  
  if (!pid) {
    console.log('No running server found');
    return;
  }
  
  console.log(`Stopping server (PID: ${pid})...`);
  
  if (killProcess(pid)) {
    fs.unlinkSync(getPidFile());
    console.log('Server stopped successfully');
  } else {
    console.log('Failed to stop server');
  }
}

function showStatus() {
  const pid = readPid();
  
  if (pid && isProcessRunning(pid)) {
    console.log(`Server is running (PID: ${pid})`);
    
    const config = loadConfig();
    console.log('\nCurrent configuration:');
    console.log(`   Backend: http://localhost:${config.port}`);
    console.log(`   LLaMA: http://localhost:${config.llamaPort}`);
    console.log(`   WebSocket: ws://localhost:${config.wsPort}`);
    console.log(`   Model: ${config.model}`);
    console.log(`   Context: ${config.ctxSize} tokens`);
    console.log(`   GPU Layers: ${config.nGpuLayers}`);
  } else {
    console.log('Server is not running');
    
    if (pid) {
      fs.unlinkSync(getPidFile());
      console.log('PID file cleaned up');
    }
  }
}

function showLogs(cli) {
  const logFile = getLogFile();
  
  if (!fs.existsSync(logFile)) {
    console.log('No logs available');
    return;
  }
  
  const shouldFollow = cli.c.follow || false;
  
  if (shouldFollow) {
    console.log('Following logs (Ctrl+C to exit)...');
    
    const stream = fs.createReadStream(logFile, { encoding: 'utf8' });
    const rl = readline.createInterface({
      input: stream,
      terminal: false
    });
    
    // Show last lines
    const lines = fs.readFileSync(logFile, 'utf8').split('\n');
    const lastLines = lines.slice(-20).filter(line => line.trim());
    lastLines.forEach(line => console.log(line));
    
    // Watch for new logs
    const watcher = fs.watch(logFile, (eventType) => {
      if (eventType === 'change') {
        const newLines = fs.readFileSync(logFile, 'utf8').split('\n');
        const diff = newLines.slice(lines.length - 1);
        diff.forEach(line => {
          if (line.trim()) console.log(line);
        });
      }
    });
    
    process.on('SIGINT', () => {
      watcher.close();
      process.exit(0);
    });
  } else {
    // Show last 50 lines
    const lines = fs.readFileSync(logFile, 'utf8').split('\n');
    const lastLines = lines.slice(-50).filter(line => line.trim());
    lastLines.forEach(line => console.log(line));
  }
}

function handleConfig(cli) {
  const config = loadConfig();
  
  if (cli.c.set) {
    // Save new configuration
    const newConfig = { ...config };
    
    if (cli.s.p || cli.c.port) newConfig.port = cli.s.p || cli.c.port || config.port;
    if (cli.c['llama-port']) newConfig.llamaPort = cli.c['llama-port'];
    if (cli.c['ws-port']) newConfig.wsPort = cli.c['ws-port'];
    if (cli.s.m || cli.c.model) newConfig.model = cli.s.m || cli.c.model || config.model;
    if (cli.c['ctx-size']) newConfig.ctxSize = cli.c['ctx-size'];
    if (cli.c['gpu-layers']) newConfig.nGpuLayers = cli.c['gpu-layers'];
    if (cli.c.parallel) newConfig.parallel = cli.c.parallel;
    if (cli.c.host) newConfig.host = cli.c.host;
    
    saveConfig(newConfig);
    console.log('Restart the server to apply changes');
  } else {
    // Show current configuration
    console.log('Current configuration:');
    console.log(JSON.stringify(config, null, 2));
    console.log(`\nConfig file: ${getConfigFile()}`);
  }
}

// Main function
(async () => {
  try {
    const cli = await parseCLI();
    
    // Debug mode
    if (cli.s.d || cli.c.debug) {
      console.log('Debug mode: Parsed CLI arguments:');
      console.log(JSON.stringify(cli, null, 2));
    }
    
    // Show help if explicitly requested
    if (cli.s.h || cli.c.help) {
      console.log(usage);
      process.exit(0);
    }
    
    // Show version if explicitly requested
    if (cli.s.v || cli.c.version) {
      console.log(`OpenChatMobile CLI v${version}`);
      process.exit(0);
    }
    
    // Determine command
    let command = 'start'; // Default command
    
    if (cli.o && cli.o.length > 0) {
      command = cli.o[0][0];
    }
    
    // Load configuration
    const baseConfig = loadConfig();
    
    // Override with command line arguments
    const config = {
      ...baseConfig,
      port: cli.s.p || cli.c.port || baseConfig.port,
      llamaPort: cli.c['llama-port'] || baseConfig.llamaPort,
      wsPort: cli.c['ws-port'] || baseConfig.wsPort,
      model: cli.s.m || cli.c.model || baseConfig.model,
      ctxSize: cli.c['ctx-size'] || baseConfig.ctxSize,
      nGpuLayers: cli.c['gpu-layers'] || baseConfig.nGpuLayers,
      parallel: cli.c.parallel || baseConfig.parallel,
      host: cli.c.host || baseConfig.host
    };
    
    // Execute command
    switch (command) {
      case 'start':
        await startServer(cli, config);
        break;
        
      case 'stop':
        stopServer();
        break;
        
      case 'restart':
        stopServer();
        await new Promise(resolve => setTimeout(resolve, 1000));
        await startServer(cli, config);
        break;
        
      case 'status':
        showStatus();
        break;
        
      case 'logs':
        showLogs(cli);
        break;
        
      case 'config':
        handleConfig(cli);
        break;
        
      default:
        console.log(`Unknown command: ${command}`);
        console.log(usage);
        process.exit(1);
    }
    
  } catch (error) {
    console.error('Error:', error.message);
    if (cli?.s?.d || cli?.c?.debug) {
      console.error(error.stack);
    }
    process.exit(1);
  }
})();