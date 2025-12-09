# OpenChatMobile

A modern, feature-rich chat interface for LLaMA models with streaming responses, multiple chats, and extensive customization options.

## Status
Currently only supporting aarch64 with glibc. Arm64 is the most widespread arch, so most likelly working out the box on your Android device with Termux.

> Install proot-distro and debian inside:  

```bash
pkg install proot-distro
proot-distro install debian
proot-distro login debian

# Check in list last debian version name and use its alias if orevious commands didn't work:
# proot-distro list
```

## Features

### Frontend Features
- **Multiple Chats**: Create, switch, and manage multiple chat sessions with persistent history
- **Real-time Streaming**: Token-by-token streaming responses via WebSocket for instant feedback
- **Day/Night Mode**: Toggle between light and dark themes with automatic preference detection
- **Customizable Settings**: Adjust max tokens, temperature, and system prompts per chat
- **Model Selection**: Choose between available GGUF models with automatic discovery
- **File Upload**: Upload text files (drag & drop supported) and process their content
- **Export Conversations**: Download entire chats as formatted Markdown files
- **Copy to Clipboard**: Copy individual messages or entire chats with one click
- **Responsive Design**: Fully responsive interface that works on desktop, tablet, and mobile
- **Minimalist UI**: Clean, modern interface with smooth animations and transitions
- **Debug Information**: Real-time connection status, WebSocket monitoring, and token counting
- **Keyboard Shortcuts**: Quick actions with comprehensive keyboard shortcuts
- **Quick Actions**: Pre-defined prompts for common tasks to get started quickly
- **Regenerate Responses**: Regenerate bot responses to try different answers
- **Auto-scroll**: Automatic scrolling to latest messages during conversations
- **Connection Status**: Real-time WebSocket connection monitoring with auto-reconnect
- **Toast Notifications**: Android-style toast notifications for user feedback

### Backend Features
- **Detailed Logging**: Comprehensive logs with timestamps and colored output in `./backend/logs/`
- **CLI Colors**: Colored terminal output for better readability and debugging
- **Foreground Mode**: Run with detailed output in terminal for real-time monitoring
- **WebSocket Support**: Real-time bidirectional communication for streaming responses
- **Health Monitoring**: Server status endpoints and connection tracking
- **File Upload API**: Handle file uploads and processing with size and type validation
- **Model Discovery**: Automatically detect available GGUF models in the models directory
- **Graceful Shutdown**: Clean shutdown of all processes including WebSocket connections
- **Configuration Management**: CLI-based configuration with JSON persistence

## Installation

### Prerequisites
- **Node.js 16+** (18+ recommended)
- **LLaMA C++ server binary** placed in `./bin/llama-server`
- **GGUF model files** placed in `./models/` directory

### Quick Start
1. **Clone and setup backend:**
```bash
cd backend
npm install
