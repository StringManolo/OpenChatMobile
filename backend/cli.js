#!/usr/bin/env node
import parseCLI from 'simpleargumentsparser';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Colores para el CLI
const colors = {
    reset: '\x1b[0m',
    bright: '\x1b[1m',
    dim: '\x1b[2m',
    underscore: '\x1b[4m',
    blink: '\x1b[5m',
    reverse: '\x1b[7m',
    hidden: '\x1b[8m',
    
    black: '\x1b[30m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    magenta: '\x1b[35m',
    cyan: '\x1b[36m',
    white: '\x1b[37m',
    
    bgBlack: '\x1b[40m',
    bgRed: '\x1b[41m',
    bgGreen: '\x1b[42m',
    bgYellow: '\x1b[43m',
    bgBlue: '\x1b[44m',
    bgMagenta: '\x1b[45m',
    bgCyan: '\x1b[46m',
    bgWhite: '\x1b[47m'
};

// Logger mejorado con colores y archivos
class Logger {
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
        const levelColors = {
            INFO: colors.green,
            DEBUG: colors.cyan,
            WARN: colors.yellow,
            ERROR: colors.red,
            FATAL: colors.magenta
        };
        
        const color = levelColors[level] || colors.white;
        const logMessage = `[${timestamp}] [${level}] ${message}`;
        
        // Mostrar en consola
        if (this.verbose || level !== 'DEBUG') {
            console.log(color + logMessage + colors.reset);
            if (data && this.verbose) {
                console.log(colors.dim + JSON.stringify(data, null, 2) + colors.reset);
            }
        }
        
        // Escribir en archivo
        if (this.logFile) {
            const fileMessage = `[${timestamp}] [${level}] ${message}` + 
                (data ? '\n' + JSON.stringify(data, null, 2) : '') + '\n';
            fs.appendFileSync(this.logFile, fileMessage, 'utf8');
        }
    }
    
    info(message, data = null) { this.log('INFO', message, data); }
    debug(message, data = null) { this.log('DEBUG', message, data); }
    warn(message, data = null) { this.log('WARN', message, data); }
    error(message, data = null) { this.log('ERROR', message, data); }
}

// Default configuration
const DEFAULT_CONFIG = {
    port: 3000,
    llamaPort: 8080,
    wsPort: 8081,
    model: './../models/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
    ctxSize: 4096,
    nGpuLayers: 20,
    parallel: 4,
    host: '0.0.0.0',
    logFile: './logs/openchatmobile.log',
    verbose: false
};

// Global variables
let llamaProcess = null;
let expressProcess = null;
let logger = null;

const usage = `${colors.cyan}
OpenChatMobile CLI - LLaMA chat server manager
${colors.reset}
Usage: open-chat-mobile [COMMAND] [OPTIONS]

Commands:
  start                   Start the server (default)
  stop                   Stop the server
  restart                Restart the server
  status                 Show server status
  logs                   View server logs
  config                 Show/edit configuration
  clean-logs             Clean log files

Options:
  -p, --port <num>       Backend server port (default: ${DEFAULT_CONFIG.port})
  --llama-port <num>     LLaMA server port (default: ${DEFAULT_CONFIG.llamaPort})
  --ws-port <num>        WebSocket port (default: ${DEFAULT_CONFIG.wsPort})
  -m, --model <path>     Path to GGUF model (default: ${DEFAULT_CONFIG.model})
  --ctx-size <num>       Context size (default: ${DEFAULT_CONFIG.ctxSize})
  --gpu-layers <num>     GPU layers to use (default: ${DEFAULT_CONFIG.nGpuLayers})
  --parallel <num>       Parallelization (default: ${DEFAULT_CONFIG.parallel})
  --host <ip>            Host to bind (default: ${DEFAULT_CONFIG.host})
  --log-file <path>      Log file path (default: ${DEFAULT_CONFIG.logFile})
  -v, --verbose          Verbose logging

  -h, --help            Show this help
  --version             Show version
  -d, --debug           Debug mode
  --foreground          Run in foreground (no daemon)

Examples:
  ${colors.dim}open-chat-mobile start --port 4000 --model ./models/my-model.gguf
  open-chat-mobile stop
  open-chat-mobile logs --follow
  open-chat-mobile config set --port 4000
  open-chat-mobile --log-file ./logs/custom.log --verbose${colors.reset}
`;

const version = '2.0.0';

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
        console.error(colors.red + 'Error loading configuration:' + error.message + colors.reset);
    }
    return { ...DEFAULT_CONFIG };
}

function saveConfig(config) {
    try {
        const configFile = getConfigFile();
        fs.writeFileSync(configFile, JSON.stringify(config, null, 2));
        console.log(colors.green + 'Configuration saved' + colors.reset);
    } catch (error) {
        console.error(colors.red + 'Error saving configuration:' + error.message + colors.reset);
    }
}

function writePid(pid) {
    try {
        fs.writeFileSync(getPidFile(), pid.toString());
    } catch (error) {
        console.error(colors.red + 'Error writing PID:' + error.message + colors.reset);
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
    const verbose = cli.c.verbose || config.verbose;
    
    logger = new Logger(config.logFile, verbose);
    
    logger.info('Starting OpenChatMobile...');
    logger.info(`Model: ${config.model}`);
    logger.info(`Backend: http://${config.host}:${config.port}`);
    logger.info(`LLaMA: http://${config.host}:${config.llamaPort}`);
    logger.info(`WebSocket: ws://${config.host}:${config.wsPort}`);
    logger.info(`Log file: ${config.logFile}`);
    
    // Mostrar URLs importantes para el usuario
    console.log('\n' + colors.cyan + '=== OpenChatMobile Server ===' + colors.reset);
    console.log(colors.green + `✓ Frontend: http://localhost:${config.port}` + colors.reset);
    console.log(colors.green + `✓ API: http://localhost:${config.port}/api/health` + colors.reset);
    console.log(colors.green + `✓ WebSocket: ws://localhost:${config.wsPort}` + colors.reset);
    console.log(colors.green + `✓ LLaMA Server: http://localhost:${config.llamaPort}` + colors.reset);
    console.log(colors.cyan + '===============================' + colors.reset + '\n');
    
    if (isForeground) {
        await startInForeground(config);
    } else {
        startAsDaemon(config);
    }
}

function startAsDaemon(config) {
    const serverScript = path.join(__dirname, 'server.js');
    
    const args = [
        serverScript,
        '--llama-port', config.llamaPort.toString(),
        '--port', config.port.toString(),
        '--model', config.model,
        '--ctx-size', config.ctxSize.toString(),
        '--gpu-layers', config.nGpuLayers.toString(),
        '--parallel', config.parallel.toString(),
        '--host', config.host,
        '--log-file', config.logFile,
        ...(config.verbose ? ['--verbose'] : [])
    ];
    
    const child = spawn('node', args, {
        detached: true,
        stdio: 'ignore',
        env: { ...process.env, NODE_ENV: 'production' }
    });
    
    child.unref();
    writePid(child.pid);
    
    console.log(colors.green + `Server started as daemon (PID: ${child.pid})` + colors.reset);
    console.log(colors.cyan + `Logs: ${config.logFile}` + colors.reset);
    console.log(colors.dim + 'Use "open-chat-mobile logs" to view logs' + colors.reset);
    console.log(colors.dim + 'Use "open-chat-mobile stop" to stop the server' + colors.reset);
}

async function startInForeground(config) {
    logger.info('Starting in foreground mode...');
    
    // Start LLaMA server
    logger.info('Starting LLaMA server...');
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
        logger.info(`LLaMA: ${output.trim()}`);
    });
    
    llamaProcess.stderr.on('data', (data) => {
        logger.error(`LLaMA Error: ${data}`);
    });
    
    // Start Express server
    const serverScript = path.join(__dirname, 'server.js');
    
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    expressProcess = spawn('node', [
        serverScript,
        '--llama-port', config.llamaPort,
        '--port', config.port,
        '--model', config.model,
        '--ctx-size', config.ctxSize,
        '--gpu-layers', config.nGpuLayers,
        '--parallel', config.parallel,
        '--host', config.host,
        '--log-file', config.logFile,
        ...(config.verbose ? ['--verbose'] : [])
    ], {
        stdio: 'inherit'
    });
    
    process.on('SIGINT', () => {
        logger.info('Stopping servers...');
        if (llamaProcess) llamaProcess.kill();
        if (expressProcess) expressProcess.kill();
        process.exit(0);
    });
}

function stopServer() {
    const pid = readPid();
    
    if (!pid) {
        console.log(colors.yellow + 'No running server found' + colors.reset);
        return;
    }
    
    console.log(colors.yellow + `Stopping server (PID: ${pid})...` + colors.reset);
    
    if (killProcess(pid)) {
        fs.unlinkSync(getPidFile());
        console.log(colors.green + 'Server stopped successfully' + colors.reset);
    } else {
        console.log(colors.red + 'Failed to stop server' + colors.reset);
    }
}

function showStatus() {
    const pid = readPid();
    
    if (pid && isProcessRunning(pid)) {
        console.log(colors.green + `✓ Server is running (PID: ${pid})` + colors.reset);
        
        const config = loadConfig();
        console.log(colors.cyan + '\nCurrent configuration:' + colors.reset);
        console.log(`   Backend: http://localhost:${config.port}`);
        console.log(`   LLaMA: http://localhost:${config.llamaPort}`);
        console.log(`   WebSocket: ws://localhost:${config.wsPort}`);
        console.log(`   Model: ${config.model}`);
        console.log(`   Context: ${config.ctxSize} tokens`);
        console.log(`   GPU Layers: ${config.nGpuLayers}`);
        console.log(`   Log file: ${config.logFile}`);
    } else {
        console.log(colors.red + '✗ Server is not running' + colors.reset);
        
        if (pid) {
            fs.unlinkSync(getPidFile());
            console.log(colors.yellow + 'PID file cleaned up' + colors.reset);
        }
    }
}

function showLogs(cli) {
    const config = loadConfig();
    const logFile = cli.c['log-file'] || config.logFile || getLogFile();
    
    if (!fs.existsSync(logFile)) {
        console.log(colors.yellow + 'No logs available' + colors.reset);
        return;
    }
    
    const shouldFollow = cli.c.follow || false;
    
    if (shouldFollow) {
        console.log(colors.cyan + 'Following logs (Ctrl+C to exit)...' + colors.reset);
        
        const stream = fs.createReadStream(logFile, { encoding: 'utf8' });
        const rl = readline.createInterface({
            input: stream,
            terminal: false
        });
        
        // Show last lines
        const lines = fs.readFileSync(logFile, 'utf8').split('\n');
        const lastLines = lines.slice(-20).filter(line => line.trim());
        lastLines.forEach(line => {
            colorizeLogLine(line);
        });
        
        // Watch for new logs
        const watcher = fs.watch(logFile, (eventType) => {
            if (eventType === 'change') {
                const newLines = fs.readFileSync(logFile, 'utf8').split('\n');
                const diff = newLines.slice(lines.length - 1);
                diff.forEach(line => {
                    if (line.trim()) colorizeLogLine(line);
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
        lastLines.forEach(line => colorizeLogLine(line));
    }
}

function colorizeLogLine(line) {
    if (line.includes('[ERROR]') || line.includes('[FATAL]')) {
        console.log(colors.red + line + colors.reset);
    } else if (line.includes('[WARN]')) {
        console.log(colors.yellow + line + colors.reset);
    } else if (line.includes('[INFO]')) {
        console.log(colors.green + line + colors.reset);
    } else if (line.includes('[DEBUG]')) {
        console.log(colors.cyan + line + colors.reset);
    } else {
        console.log(line);
    }
}

function cleanLogs() {
    const config = loadConfig();
    const logFile = config.logFile || getLogFile();
    
    if (fs.existsSync(logFile)) {
        fs.writeFileSync(logFile, '');
        console.log(colors.green + 'Logs cleaned successfully' + colors.reset);
    } else {
        console.log(colors.yellow + 'No log file found' + colors.reset);
    }
}

function handleConfig(cli) {
    const config = loadConfig();
    
    if (cli.c.set) {
        const newConfig = { ...config };
        
        if (cli.s.p || cli.c.port) newConfig.port = cli.s.p || cli.c.port || config.port;
        if (cli.c['llama-port']) newConfig.llamaPort = cli.c['llama-port'];
        if (cli.c['ws-port']) newConfig.wsPort = cli.c['ws-port'];
        if (cli.s.m || cli.c.model) newConfig.model = cli.s.m || cli.c.model || config.model;
        if (cli.c['ctx-size']) newConfig.ctxSize = cli.c['ctx-size'];
        if (cli.c['gpu-layers']) newConfig.nGpuLayers = cli.c['gpu-layers'];
        if (cli.c.parallel) newConfig.parallel = cli.c.parallel;
        if (cli.c.host) newConfig.host = cli.c.host;
        if (cli.c['log-file']) newConfig.logFile = cli.c['log-file'];
        if (cli.c.verbose !== undefined) newConfig.verbose = cli.c.verbose;
        
        saveConfig(newConfig);
        console.log(colors.green + 'Restart the server to apply changes' + colors.reset);
    } else {
        console.log(colors.cyan + 'Current configuration:' + colors.reset);
        console.log(JSON.stringify(config, null, 2));
        console.log(colors.dim + `\nConfig file: ${getConfigFile()}` + colors.reset);
    }
}

// Main function
(async () => {
    try {
        const cli = await parseCLI();
        
        // Show help if explicitly requested
        if (cli.s.h || cli.c.help) {
            console.log(usage);
            process.exit(0);
        }
        
        // Show version if explicitly requested
        if (cli.s.v || cli.c.version) {
            console.log(colors.cyan + `OpenChatMobile CLI v${version}` + colors.reset);
            process.exit(0);
        }
        
        // Determine command
        let command = 'start';
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
            host: cli.c.host || baseConfig.host,
            logFile: cli.c['log-file'] || baseConfig.logFile,
            verbose: cli.c.verbose || baseConfig.verbose
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
                
            case 'clean-logs':
                cleanLogs();
                break;
                
            case 'config':
                handleConfig(cli);
                break;
                
            default:
                console.log(colors.red + `Unknown command: ${command}` + colors.reset);
                console.log(usage);
                process.exit(1);
        }
        
    } catch (error) {
        console.error(colors.red + 'Error:' + error.message + colors.reset);
        if (cli?.s?.d || cli?.c?.debug) {
            console.error(error.stack);
        }
        process.exit(1);
    }
})();
