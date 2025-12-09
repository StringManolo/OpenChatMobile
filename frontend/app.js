/**
 * OpenChatMobile - Frontend Application
 * Main application controller with all UI and business logic
 * @version 2.0.2
 */

class OpenChatMobile {
    constructor() {
        // State management
        this.currentChatId = null;
        this.chats = new Map();
        this.ws = null;
        this.isGenerating = false;
        this.isConnected = false;
        this.typingMessageId = null;
        this.serverHealth = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.uploadedFile = null;
        this.serverConfig = null;
        
        // Performance optimizations
        this.debounceTimers = {};
        this.pendingTokens = new Map(); // Para acumular tokens
        this.renderTimeout = null;
        this.lastRenderTime = 0;
        this.renderInterval = 50; // ms entre renders
        this.accumulatedContent = new Map(); // Contenido acumulado por mensaje
        
        // Initialize application
        this.initLogger();
        this.initElements();
        this.initEventListeners();
        this.initTheme();
        this.initDragAndDrop();
        this.loadChats();
        this.loadSettings();
        this.initializeConnection();
        
        // Focus input after initialization
        setTimeout(() => {
            this.messageInput?.focus();
            this.scrollToBottom();
        }, 300);
    }
    
    /**
     * Initialize logger for debugging
     */
    initLogger() {
        this.logger = {
            info: (msg, data = null) => console.info(`[OpenChatMobile] ${msg}`, data),
            debug: (msg, data = null) => console.debug(`[OpenChatMobile] ${msg}`, data),
            warn: (msg, data = null) => console.warn(`[OpenChatMobile] ${msg}`, data),
            error: (msg, data = null) => console.error(`[OpenChatMobile] ${msg}`, data),
            trace: (msg, data = null) => console.trace(`[OpenChatMobile] ${msg}`, data)
        };
    }
    
    /**
     * Initialize DOM elements
     */
    initElements() {
        try {
            // Sidebar elements
            this.sidebar = document.getElementById('sidebar');
            this.toggleSidebarBtn = document.getElementById('toggleSidebar');
            this.mobileSidebarToggle = document.getElementById('mobileSidebarToggle');
            this.newChatBtn = document.getElementById('newChatBtn');
            this.chatList = document.getElementById('chatList');
            this.exportChatBtn = document.getElementById('exportChatBtn');
            this.clearHistoryBtn = document.getElementById('clearHistoryBtn');
            
            // Settings elements
            this.modelSelect = document.getElementById('modelSelect');
            this.maxTokensInput = document.getElementById('maxTokens');
            this.maxTokensValue = document.getElementById('maxTokensValue');
            this.temperatureInput = document.getElementById('temperature');
            this.temperatureValue = document.getElementById('temperatureValue');
            this.systemPromptInput = document.getElementById('systemPrompt');
            this.darkModeToggle = document.getElementById('darkModeToggle');
            
            // Main content elements
            this.currentChatTitle = document.getElementById('currentChatTitle');
            this.connectionStatus = document.getElementById('connectionStatus');
            this.statusDot = this.connectionStatus?.querySelector('.status-dot');
            this.statusText = this.connectionStatus?.querySelector('.status-text');
            this.stopBtn = document.getElementById('stopBtn');
            this.tokenCount = document.getElementById('tokenCount');
            this.wsStatus = document.getElementById('wsStatus');
            this.messagesContainer = document.getElementById('messagesContainer');
            this.messageInput = document.getElementById('messageInput');
            this.sendBtn = document.getElementById('sendBtn');
            this.clearInputBtn = document.getElementById('clearInputBtn');
            this.fileUpload = document.getElementById('fileUpload');
            
            // Toast container (create if doesn't exist)
            this.toastContainer = document.getElementById('toastContainer');
            if (!this.toastContainer) {
                this.toastContainer = document.createElement('div');
                this.toastContainer.id = 'toastContainer';
                this.toastContainer.className = 'toast-container';
                document.body.appendChild(this.toastContainer);
            }
            
            this.logger.info('DOM elements initialized');
        } catch (error) {
            this.logger.error('Failed to initialize DOM elements:', error);
            throw error;
        }
    }
    
    /**
     * Initialize event listeners
     */
    initEventListeners() {
        // Sidebar controls
        this.toggleSidebarBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSidebar();
        });
        
        this.mobileSidebarToggle?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleSidebar();
        });
        
        this.newChatBtn?.addEventListener('click', () => this.createNewChat());
        this.exportChatBtn?.addEventListener('click', () => this.exportCurrentChat());
        this.clearHistoryBtn?.addEventListener('click', () => this.clearChatHistory());
        
        // Settings controls
        if (this.maxTokensInput) {
            this.maxTokensInput.addEventListener('input', (e) => {
                this.maxTokensValue.textContent = e.target.value;
                this.saveSettings();
            });
        }
        
        if (this.temperatureInput) {
            this.temperatureInput.addEventListener('input', (e) => {
                this.temperatureValue.textContent = e.target.value;
                this.saveSettings();
            });
        }
        
        this.systemPromptInput?.addEventListener('input', () => this.saveSettings());
        this.modelSelect?.addEventListener('change', () => this.saveSettings());
        this.darkModeToggle?.addEventListener('change', (e) => this.toggleDarkMode(e.target.checked));
        
        // Chat input controls
        this.messageInput?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
                e.preventDefault();
                this.sendMessage();
            }
        });
        
        this.messageInput?.addEventListener('input', () => this.adjustTextareaHeight());
        
        this.sendBtn?.addEventListener('click', () => this.sendMessage());
        this.clearInputBtn?.addEventListener('click', () => this.clearInput());
        this.stopBtn?.addEventListener('click', () => this.stopGeneration());
        
        // File upload
        this.fileUpload?.addEventListener('change', (e) => this.handleFileUpload(e));
        
        // Window events
        window.addEventListener('resize', () => this.handleResize());
        window.addEventListener('beforeunload', () => this.saveCurrentState());
        
        // Prevent accidental navigation
        window.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                this.exportCurrentChat();
            }
        });
        
        // Close sidebar when clicking outside on mobile
        document.addEventListener('click', (e) => {
            if (window.innerWidth < 768 && this.sidebar?.classList.contains('open')) {
                if (!this.sidebar.contains(e.target) && 
                    !this.mobileSidebarToggle?.contains(e.target) &&
                    !this.toggleSidebarBtn?.contains(e.target)) {
                    this.sidebar.classList.remove('open');
                    this.updateSidebarIcons();
                }
            }
        });
        
        this.logger.info('Event listeners initialized');
    }
    
    /**
     * Initialize drag and drop for file uploads
     */
    initDragAndDrop() {
        const preventDefaults = (e) => {
            e.preventDefault();
            e.stopPropagation();
        };
        
        const highlight = (e) => {
            document.body.classList.add('drag-overlay');
        };
        
        const unhighlight = (e) => {
            document.body.classList.remove('drag-overlay');
        };
        
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, preventDefaults, false);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            document.addEventListener(eventName, highlight, false);
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            document.addEventListener(eventName, unhighlight, false);
        });
        
        document.addEventListener('drop', (e) => {
            const dt = e.dataTransfer;
            const files = dt.files;
            
            if (files.length > 0) {
                this.handleFileUpload({ target: { files } });
            }
        }, false);
        
        this.logger.info('Drag and drop initialized');
    }
    
    /**
     * Initialize theme from local storage
     */
    initTheme() {
        const isDarkMode = localStorage.getItem('darkMode') === 'true';
        if (this.darkModeToggle) {
            this.darkModeToggle.checked = isDarkMode;
        }
        document.body.classList.toggle('dark-theme', isDarkMode);
        this.logger.info('Theme initialized', { darkMode: isDarkMode });
    }
    
    /**
     * Initialize server connection
     */
    async initializeConnection() {
        try {
            const healthy = await this.checkServerHealth();
            this.serverHealth = healthy;
            
            if (healthy) {
                // Get server config first
                await this.getServerConfig();
                this.connectWebSocket();
                await this.loadModels();
                this.showToast('Connected to server', 'success');
            } else {
                this.showToast('Server not responding. Starting in offline mode.', 'warning');
                this.loadFallbackModels();
            }
        } catch (error) {
            this.logger.error('Initialization error:', error);
            this.showToast('Failed to initialize connection', 'error');
        }
    }
    
    /**
     * Get server configuration
     */
    async getServerConfig() {
        try {
            const response = await fetch('/api/health');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            this.serverConfig = data.config || {};
            this.logger.info('Server configuration loaded:', this.serverConfig);
            
            return this.serverConfig;
        } catch (error) {
            this.logger.error('Failed to get server config:', error);
            this.serverConfig = {
                port: window.location.port || 3000,
                wsPort: 8081,
                llamaPort: 8080
            };
            return this.serverConfig;
        }
    }
    
    /**
     * Check server health
     */
    async checkServerHealth() {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 5000);
            
            const response = await fetch('/api/health', {
                signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (response.ok) {
                const data = await response.json();
                this.logger.info('Server health check passed:', data);
                return true;
            }
            return false;
        } catch (error) {
            this.logger.error('Server health check failed:', error);
            return false;
        }
    }
    
    /**
     * Connect to WebSocket server
     */
    connectWebSocket() {
        try {
            // Use the actual server configuration for WebSocket connection
            const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsPort = this.serverConfig?.wsPort || 8081;
            const hostname = window.location.hostname;
            
            // If we're running on localhost and server is on a different port,
            // we need to use the actual server hostname
            let wsUrl;
            
            if (hostname === 'localhost' || hostname === '127.0.0.1') {
                // For local development, use localhost with the configured port
                wsUrl = `${protocol}//localhost:${wsPort}`;
            } else {
                // For production, use the same hostname with the configured port
                wsUrl = `${protocol}//${hostname}:${wsPort}`;
            }
            
            this.logger.info(`Connecting to WebSocket: ${wsUrl}`);
            
            this.ws = new WebSocket(wsUrl);
            
            this.ws.onopen = () => {
                this.logger.info('WebSocket connection established');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus('connected');
                this.showToast('WebSocket connected', 'success');
            };
            
            this.ws.onmessage = (event) => {
                this.handleWebSocketMessage(event);
            };
            
            this.ws.onclose = (event) => {
                this.logger.warn(`WebSocket closed: Code ${event.code}, Reason: ${event.reason}`);
                this.isConnected = false;
                this.updateConnectionStatus('disconnected');
                
                if (event.code !== 1000 && this.reconnectAttempts < this.maxReconnectAttempts) {
                    this.reconnectAttempts++;
                    const delay = Math.min(3000 * this.reconnectAttempts, 15000);
                    
                    this.logger.info(`Attempting reconnection ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);
                    
                    setTimeout(() => {
                        if (!this.isConnected) {
                            this.connectWebSocket();
                        }
                    }, delay);
                }
            };
            
            this.ws.onerror = (error) => {
                this.logger.error('WebSocket error:', error);
                this.updateConnectionStatus('disconnected');
                this.showToast('WebSocket connection failed. Using HTTP fallback.', 'warning');
            };
            
        } catch (error) {
            this.logger.error('Error creating WebSocket:', error);
            this.updateConnectionStatus('disconnected');
            this.showToast('Failed to create WebSocket connection', 'error');
        }
    }
    
    /**
     * Handle WebSocket messages - OPTIMIZADO PARA EVITAR PARPADEO
     */
    handleWebSocketMessage(event) {
        try {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'token':
                    if (this.typingMessageId) {
                        this.accumulateToken(this.typingMessageId, data.token);
                    }
                    break;
                    
                case 'done':
                    this.finalizeStream();
                    break;
                    
                case 'error':
                    this.showToast(`Error: ${data.message}`, 'error');
                    this.isGenerating = false;
                    this.stopBtn.disabled = true;
                    this.sendBtn.disabled = false;
                    this.typingMessageId = null;
                    break;
                    
                default:
                    this.logger.warn('Unknown WebSocket message type:', data.type);
            }
        } catch (error) {
            this.logger.error('Error parsing WebSocket message:', error);
        }
    }
    
    /**
     * Acumula tokens y programa una actualización eficiente
     */
    accumulateToken(messageId, token) {
        // Inicializar acumulador si no existe
        if (!this.accumulatedContent.has(messageId)) {
            this.accumulatedContent.set(messageId, '');
        }
        
        // Acumular token
        const currentContent = this.accumulatedContent.get(messageId) + token;
        this.accumulatedContent.set(messageId, currentContent);
        
        // Programar actualización optimizada
        this.scheduleOptimizedUpdate(messageId);
    }
    
    /**
     * Programa una actualización optimizada para evitar parpadeo
     */
    scheduleOptimizedUpdate(messageId) {
        const now = Date.now();
        
        // Cancelar timeout anterior si existe
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }
        
        // Si ha pasado suficiente tiempo desde el último render, renderizar inmediatamente
        if (now - this.lastRenderTime > this.renderInterval) {
            this.renderAccumulatedContent();
            this.lastRenderTime = now;
        } else {
            // Programar render para el próximo intervalo
            this.renderTimeout = setTimeout(() => {
                this.renderAccumulatedContent();
                this.lastRenderTime = Date.now();
            }, this.renderInterval);
        }
    }
    
    /**
     * Renderiza el contenido acumulado de manera eficiente
     */
    renderAccumulatedContent() {
        this.accumulatedContent.forEach((content, messageId) => {
            const messageElement = document.getElementById(messageId);
            if (messageElement) {
                const contentElement = messageElement.querySelector('.message-content');
                if (contentElement) {
                    // Usar textContent para contenido simple (más rápido)
                    if (content.includes('`') || content.includes('*') || content.includes('[')) {
                        // Si tiene markdown, usar innerHTML
                        contentElement.innerHTML = this.markdownToHtml(content);
                    } else {
                        // Si es texto simple, usar textContent (más rápido)
                        contentElement.textContent = content;
                    }
                    
                    // Remover indicador de typing si existe
                    contentElement.classList.remove('typing');
                    
                    // Actualizar contador de tokens
                    this.updateTokenCount();
                }
            }
        });
        
        // Hacer scroll suave solo si estamos cerca del final
        this.scrollToBottomIfNearEnd();
    }
    
    /**
     * Finaliza el stream y limpia los acumuladores
     */
    finalizeStream() {
        // Renderizar cualquier contenido pendiente
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }
        this.renderAccumulatedContent();
        
        // Limpiar acumuladores
        this.accumulatedContent.clear();
        
        // Actualizar estado
        this.isGenerating = false;
        this.stopBtn.disabled = true;
        this.sendBtn.disabled = false;
        this.typingMessageId = null;
        
        // Forzar scroll al final
        this.scrollToBottom();
    }
    
    /**
     * Scroll suave solo si estamos cerca del final
     */
    scrollToBottomIfNearEnd() {
        if (!this.messagesContainer) return;
        
        const container = this.messagesContainer;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        
        // Solo hacer scroll si estamos a menos de 100px del final
        if (distanceFromBottom < 100) {
            this.scrollToBottom();
        }
    }
    
    /**
     * Scroll suave al final
     */
    scrollToBottom() {
        if (!this.messagesContainer) return;
        
        // Usar scrollTo con behavior smooth para scroll suave
        this.messagesContainer.scrollTo({
            top: this.messagesContainer.scrollHeight,
            behavior: 'smooth'
        });
    }
    
    /**
     * Chat Management
     */
    
    createNewChat(switchToChat = true) {
        try {
            const chatId = `chat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            const chat = {
                id: chatId,
                title: 'New Chat',
                messages: [],
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString(),
                settings: this.getCurrentSettings(),
                metadata: {
                    tokensUsed: 0,
                    fileAttachments: []
                }
            };
            
            this.chats.set(chatId, chat);
            this.saveChats();
            
            if (switchToChat) {
                this.currentChatId = chatId;
                this.renderMessages();
                this.updateChatTitle();
                this.loadChatSettings();
                
                // Close sidebar on mobile
                if (window.innerWidth < 768) {
                    this.closeSidebar();
                }
            }
            
            this.renderChatList();
            this.showToast('New chat created', 'success');
            
            this.logger.info('New chat created:', { chatId });
            return chatId;
            
        } catch (error) {
            this.logger.error('Error creating new chat:', error);
            this.showToast('Failed to create new chat', 'error');
            return null;
        }
    }
    
    loadChats() {
        try {
            const saved = localStorage.getItem('chatHistory');
            if (saved) {
                const parsed = JSON.parse(saved);
                const chatsArray = Array.isArray(parsed) ? parsed : [];
                this.chats = new Map(chatsArray);
                
                this.logger.info(`Loaded ${this.chats.size} chats from storage`);
                
                if (this.chats.size === 0) {
                    this.createNewChat();
                } else {
                    // Sort chats by update time (most recent first)
                    const sortedChats = Array.from(this.chats.entries())
                        .sort((a, b) => new Date(b[1].updatedAt) - new Date(a[1].updatedAt));
                    
                    this.chats = new Map(sortedChats);
                    
                    // Don't auto-select a chat, show welcome screen
                    this.currentChatId = null;
                    this.renderMessages();
                    this.updateChatTitle();
                }
            } else {
                this.createNewChat();
            }
            
            this.renderChatList();
            
        } catch (error) {
            this.logger.error('Error loading chats:', error);
            this.createNewChat();
        }
    }
    
    saveChats() {
        try {
            const serialized = JSON.stringify(Array.from(this.chats.entries()));
            localStorage.setItem('chatHistory', serialized);
        } catch (error) {
            this.logger.error('Error saving chats:', error);
        }
    }
    
    switchChat(chatId) {
        if (this.isGenerating) {
            this.showToast('Please wait for current generation to complete', 'warning');
            return;
        }
        
        if (!this.chats.has(chatId)) {
            this.showToast('Chat not found', 'error');
            return;
        }
        
        this.currentChatId = chatId;
        this.renderMessages();
        this.updateChatTitle();
        this.loadChatSettings();
        
        // Close sidebar on mobile
        if (window.innerWidth < 768) {
            this.closeSidebar();
        }
        
        const chat = this.chats.get(chatId);
        this.logger.info('Switched chat:', { chatId, title: chat.title });
        this.showToast(`Switched to: ${chat.title}`, 'info');
    }
    
    deleteChat(chatId) {
        if (!this.chats.has(chatId)) {
            this.showToast('Chat not found', 'error');
            return;
        }
        
        if (this.chats.size <= 1) {
            this.showToast('Cannot delete the only chat', 'warning');
            return;
        }
        
        const chatTitle = this.chats.get(chatId).title;
        
        if (confirm(`Are you sure you want to delete "${chatTitle}"? This action cannot be undone.`)) {
            this.chats.delete(chatId);
            this.saveChats();
            
            if (this.currentChatId === chatId) {
                const firstChat = Array.from(this.chats.keys())[0];
                this.switchChat(firstChat);
            }
            
            this.renderChatList();
            this.showToast(`Deleted: ${chatTitle}`, 'success');
            this.logger.info('Chat deleted:', { chatId, title: chatTitle });
        }
    }
    
    clearChatHistory() {
        if (this.chats.size === 0) {
            this.showToast('No chat history to clear', 'info');
            return;
        }
        
        if (confirm('Are you sure you want to clear ALL chat history? This action cannot be undone.')) {
            this.chats.clear();
            this.createNewChat();
            this.showToast('All chat history cleared', 'success');
            this.logger.info('Chat history cleared');
        }
    }
    
    /**
     * Message Handling
     */
    
    async sendMessage() {
        // Validation
        const message = this.messageInput?.value?.trim();
        if (!message || this.isGenerating) return;
        
        // Clear input immediately
        this.messageInput.value = '';
        this.adjustTextareaHeight();
        
        // Add user message to chat
        this.addMessage('user', message);
        
        // Update UI state
        this.isGenerating = true;
        this.stopBtn.disabled = false;
        this.sendBtn.disabled = true;
        
        // Get current chat and settings
        const chat = this.chats.get(this.currentChatId);
        if (!chat) {
            this.logger.error('Current chat not found');
            this.showToast('Chat not found', 'error');
            return;
        }
        
        const settings = chat.settings;
        
        try {
            if (this.ws && this.isConnected) {
                // Use WebSocket streaming
                const messageId = `msg_${Date.now()}`;
                this.typingMessageId = messageId;
                
                // Crear elemento de mensaje con contenido vacío
                this.addMessage('bot', '', messageId);
                
                // Inicializar acumulador para este mensaje
                this.accumulatedContent.set(messageId, '');
                
                // Prepare payload
                const payload = {
                    type: 'chat',
                    message: this.buildPrompt(chat, message),
                    maxTokens: parseInt(settings.maxTokens) || 200,
                    temperature: parseFloat(settings.temperature) || 0.7,
                    chatId: this.currentChatId
                };
                
                this.ws.send(JSON.stringify(payload));
                this.logger.info('Message sent via WebSocket:', payload);
                
            } else {
                // Fallback to HTTP
                this.showToast('Using HTTP fallback mode', 'warning');
                
                const messageId = `msg_${Date.now()}`;
                this.typingMessageId = messageId;
                this.addMessage('bot', 'Thinking...', messageId);
                
                const response = await fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        message: this.buildPrompt(chat, message),
                        maxTokens: parseInt(settings.maxTokens) || 200,
                        temperature: parseFloat(settings.temperature) || 0.7
                    })
                });
                
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
                }
                
                const data = await response.json();
                
                // Actualizar mensaje con respuesta completa
                this.updateMessageContent(messageId, data.response);
                this.isGenerating = false;
                this.stopBtn.disabled = true;
                this.sendBtn.disabled = false;
                this.typingMessageId = null;
                this.updateTokenCount();
            }
            
        } catch (error) {
            this.logger.error('Error sending message:', error);
            this.showToast(`Error: ${error.message}`, 'error');
            
            // Add error message to chat
            this.addMessage('bot', `I encountered an error: ${error.message}. Please try again.`);
            
            // Reset UI state
            this.isGenerating = false;
            this.stopBtn.disabled = true;
            this.sendBtn.disabled = false;
            this.typingMessageId = null;
            
            // Limpiar acumuladores
            this.accumulatedContent.clear();
            if (this.renderTimeout) {
                clearTimeout(this.renderTimeout);
            }
        }
    }
    
    buildPrompt(chat, newMessage) {
        const settings = chat.settings;
        let prompt = '';
        
        // Add system prompt if exists
        if (settings.systemPrompt?.trim()) {
            prompt += `${settings.systemPrompt}\n\n`;
        }
        
        // Add conversation history
        chat.messages.forEach(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            prompt += `${role}: ${msg.content}\n`;
        });
        
        // Add new user message
        prompt += `User: ${newMessage}\n`;
        prompt += 'Assistant:';
        
        return prompt;
    }
    
    stopGeneration() {
        if (this.ws && this.isConnected) {
            this.ws.send(JSON.stringify({ type: 'stop' }));
        }
        
        // Limpiar acumuladores y timeouts
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }
        this.accumulatedContent.clear();
        
        this.isGenerating = false;
        this.stopBtn.disabled = true;
        this.sendBtn.disabled = false;
        
        if (this.typingMessageId) {
            const typingElement = document.getElementById(this.typingMessageId);
            if (typingElement) {
                const contentElement = typingElement.querySelector('.message-content');
                if (contentElement) {
                    const currentText = contentElement.textContent;
                    contentElement.textContent = currentText + ' [Stopped]';
                    contentElement.classList.remove('typing');
                }
            }
            this.typingMessageId = null;
        }
        
        this.showToast('Generation stopped', 'warning');
        this.logger.info('Generation stopped by user');
    }
    
    addMessage(role, content, id = null) {
        const chat = this.chats.get(this.currentChatId);
        if (!chat) return null;
        
        const messageId = id || `msg_${Date.now()}`;
        const message = {
            id: messageId,
            role,
            content,
            timestamp: new Date().toISOString()
        };
        
        chat.messages.push(message);
        chat.updatedAt = new Date().toISOString();
        
        // Update chat title if first user message
        if (role === 'user' && chat.messages.length === 1) {
            const words = content.split(' ').slice(0, 5).join(' ');
            chat.title = words.length < content.length ? words + '...' : words;
            this.updateChatTitle();
            this.renderChatList();
        }
        
        this.saveChats();
        this.renderMessages();
        
        return messageId;
    }
    
    updateMessageContent(messageId, content) {
        const chat = this.chats.get(this.currentChatId);
        if (!chat) return;
        
        const message = chat.messages.find(m => m.id === messageId);
        if (message) {
            message.content = content;
            message.timestamp = new Date().toISOString();
            chat.updatedAt = message.timestamp;
            
            this.saveChats();
            this.renderMessages();
        }
    }
    
    getCurrentBotMessage() {
        const chat = this.chats.get(this.currentChatId);
        if (!chat || chat.messages.length === 0) return null;
        
        const lastMessage = chat.messages[chat.messages.length - 1];
        return lastMessage.role === 'bot' ? lastMessage.content : null;
    }
    
    /**
     * File Handling
     */
    
    async handleFileUpload(event) {
        const file = event.target.files?.[0];
        if (!file) return;
        
        // Validate file size (10MB limit)
        const maxSize = 10 * 1024 * 1024;
        if (file.size > maxSize) {
            this.showToast('File too large. Maximum size is 10MB.', 'error');
            return;
        }
        
        // Validate file type
        const allowedTypes = [
            'text/plain',
            'text/markdown',
            'text/html',
            'application/json',
            'text/csv',
            'application/pdf',
            'image/'
        ];
        
        const isValidType = allowedTypes.some(type => {
            if (type.endsWith('/')) {
                return file.type.startsWith(type);
            }
            return file.type === type;
        });
        
        if (!isValidType) {
            this.showToast('File type not supported', 'error');
            return;
        }
        
        try {
            this.showToast(`Uploading ${file.name}...`, 'info');
            
            // Read file content
            const content = await this.readFileAsText(file);
            
            // Upload to server
            const response = await fetch('/api/upload', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/octet-stream',
                    'X-Filename': encodeURIComponent(file.name),
                    'X-File-Size': file.size,
                    'X-File-Type': file.type
                },
                body: content
            });
            
            if (!response.ok) {
                throw new Error(`Upload failed: ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Store file reference
            this.uploadedFile = {
                name: file.name,
                size: file.size,
                type: file.type,
                content: data.content || content.substring(0, 1000),
                serverData: data
            };
            
            // Add file info to message input
            const fileInfo = `[File: ${file.name} (${this.formatFileSize(file.size)})]\n`;
            this.messageInput.value = fileInfo + (this.messageInput.value || '');
            this.adjustTextareaHeight();
            
            this.showToast(`File "${file.name}" uploaded successfully`, 'success');
            this.logger.info('File uploaded:', { 
                filename: file.name, 
                size: file.size,
                type: file.type 
            });
            
        } catch (error) {
            this.logger.error('File upload error:', error);
            this.showToast(`Upload failed: ${error.message}`, 'error');
        } finally {
            // Reset file input
            event.target.value = '';
        }
    }
    
    readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.onerror = (e) => reject(new Error('Failed to read file'));
            reader.readAsText(file);
        });
    }
    
    /**
     * UI Rendering
     */
    
    renderChatList() {
        if (!this.chatList) return;
        
        // Clear existing list
        this.chatList.innerHTML = '';
        
        // Get sorted chats (most recent first)
        const sortedChats = Array.from(this.chats.values())
            .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt))
            .slice(0, 20); // Limit to 20 most recent
        
        if (sortedChats.length === 0) {
            const emptyState = document.createElement('div');
            emptyState.className = 'empty-state';
            emptyState.innerHTML = `
                <div style="text-align: center; padding: 20px; color: var(--text-muted);">
                    <i class="fas fa-comments" style="font-size: 2em; margin-bottom: 10px; opacity: 0.5;"></i>
                    <p>No chats yet</p>
                </div>
            `;
            this.chatList.appendChild(emptyState);
            return;
        }
        
        sortedChats.forEach(chat => {
            const chatItem = this.createChatItem(chat);
            this.chatList.appendChild(chatItem);
        });
    }
    
    createChatItem(chat) {
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${chat.id === this.currentChatId ? 'active' : ''}`;
        chatItem.dataset.chatId = chat.id;
        
        const lastMessage = chat.messages[chat.messages.length - 1];
        let preview = 'No messages yet';
        
        if (lastMessage) {
            preview = lastMessage.content.substring(0, 30);
            if (lastMessage.content.length > 30) {
                preview += '...';
            }
            preview = this.escapeHtml(preview);
        }
        
        const timeAgo = this.getTimeAgo(new Date(chat.updatedAt));
        
        chatItem.innerHTML = `
            <div class="chat-item-content">
                <div class="chat-title">${this.escapeHtml(chat.title)}</div>
                <div class="chat-preview">${preview}</div>
                <div class="chat-time">${timeAgo}</div>
            </div>
            <div class="chat-actions">
                <button class="btn-icon copy-chat-btn" data-chat-id="${chat.id}" title="Copy Chat">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="btn-icon delete-chat-btn" data-chat-id="${chat.id}" title="Delete Chat">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        
        // Add event listeners
        chatItem.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-actions')) {
                this.switchChat(chat.id);
            }
        });
        
        const copyBtn = chatItem.querySelector('.copy-chat-btn');
        const deleteBtn = chatItem.querySelector('.delete-chat-btn');
        
        copyBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyChatToClipboard(chat.id);
        });
        
        deleteBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteChat(chat.id);
        });
        
        return chatItem;
    }
    
    renderMessages() {
        if (!this.messagesContainer) return;
        
        // Clear container
        this.messagesContainer.innerHTML = '';
        
        // Show welcome screen if no chat selected
        if (!this.currentChatId) {
            this.renderWelcomeScreen();
            return;
        }
        
        const chat = this.chats.get(this.currentChatId);
        if (!chat) {
            this.renderWelcomeScreen();
            return;
        }
        
        // Show empty state if no messages
        if (chat.messages.length === 0) {
            this.renderEmptyChatState(chat);
            return;
        }
        
        // Render all messages
        chat.messages.forEach(message => {
            const messageElement = this.createMessageElement(message);
            this.messagesContainer.appendChild(messageElement);
        });
        
        // Scroll to bottom
        this.scrollToBottom();
    }
    
    renderWelcomeScreen() {
        const welcome = document.createElement('div');
        welcome.className = 'welcome-message';
        welcome.innerHTML = `
            <div class="welcome-content">
                <h3>👋 Welcome to OpenChatMobile</h3>
                <p>Start a new conversation or select one from your chat history.</p>
                <div class="welcome-features">
                    <div class="feature">
                        <i class="fas fa-bolt"></i>
                        <span>Fast responses with streaming</span>
                    </div>
                    <div class="feature">
                        <i class="fas fa-moon"></i>
                        <span>Dark/Light mode</span>
                    </div>
                    <div class="feature">
                        <i class="fas fa-file-upload"></i>
                        <span>File upload support</span>
                    </div>
                    <div class="feature">
                        <i class="fas fa-cog"></i>
                        <span>Customizable settings</span>
                    </div>
                </div>
                <button class="btn-primary" id="createFirstChatBtn">
                    <i class="fas fa-plus"></i> Create Your First Chat
                </button>
            </div>
        `;
        
        this.messagesContainer.appendChild(welcome);
        
        // Add event listener for create button
        setTimeout(() => {
            const createBtn = document.getElementById('createFirstChatBtn');
            if (createBtn) {
                createBtn.addEventListener('click', () => this.createNewChat());
            }
        }, 100);
    }
    
    renderEmptyChatState(chat) {
        const emptyState = document.createElement('div');
        emptyState.className = 'welcome-message';
        emptyState.innerHTML = `
            <div class="welcome-content">
                <h3>💬 ${this.escapeHtml(chat.title)}</h3>
                <p>This chat is empty. Send a message to start the conversation.</p>
                <p class="hint">You can also upload files, adjust settings, and customize your experience.</p>
                <div class="quick-actions">
                    <button class="btn-secondary quick-action-btn" data-prompt="Hello! How can you help me today?">
                        <i class="fas fa-hand-wave"></i> Say Hello
                    </button>
                    <button class="btn-secondary quick-action-btn" data-prompt="Explain quantum computing in simple terms">
                        <i class="fas fa-atom"></i> Quantum Computing
                    </button>
                    <button class="btn-secondary quick-action-btn" data-prompt="Help me plan a healthy meal for today">
                        <i class="fas fa-utensils"></i> Meal Planning
                    </button>
                </div>
            </div>
        `;
        
        this.messagesContainer.appendChild(emptyState);
        
        // Add event listeners for quick actions
        setTimeout(() => {
            document.querySelectorAll('.quick-action-btn').forEach(btn => {
                btn.addEventListener('click', () => {
                    const prompt = btn.dataset.prompt;
                    this.messageInput.value = prompt;
                    this.adjustTextareaHeight();
                    this.messageInput.focus();
                });
            });
        }, 100);
    }
    
    createMessageElement(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${message.role} fade-in`;
        messageDiv.id = message.id;
        
        const time = new Date(message.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
        
        const avatar = message.role === 'user' 
            ? '<i class="fas fa-user-circle"></i> You'
            : '<i class="fas fa-robot"></i> Assistant';
        
        const isTyping = message.id === this.typingMessageId;
        
        messageDiv.innerHTML = `
            <div class="message-header">
                <div class="message-avatar">${avatar}</div>
                <div class="message-time">${time}</div>
            </div>
            <div class="message-content ${isTyping ? 'typing' : ''}">
                ${this.markdownToHtml(message.content)}
            </div>
            <div class="message-actions">
                <button class="btn-icon copy-message-btn" data-message-id="${message.id}" title="Copy message">
                    <i class="fas fa-copy"></i>
                </button>
                <button class="btn-icon regenerate-btn" data-message-id="${message.id}" title="Regenerate">
                    <i class="fas fa-redo"></i>
                </button>
            </div>
        `;
        
        // Add event listeners for action buttons
        const copyBtn = messageDiv.querySelector('.copy-message-btn');
        const regenerateBtn = messageDiv.querySelector('.regenerate-btn');
        
        copyBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.copyMessageToClipboard(message.id);
        });
        
        regenerateBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.regenerateResponse(message.id);
        });
        
        return messageDiv;
    }
    
    /**
     * Settings Management
     */
    
    getCurrentSettings() {
        return {
            model: this.modelSelect?.value || '',
            maxTokens: this.maxTokensInput?.value || 200,
            temperature: this.temperatureInput?.value || 0.7,
            systemPrompt: this.systemPromptInput?.value || 'You are a helpful assistant.',
            enableStreaming: true,
            autoScroll: true
        };
    }
    
    loadSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem('chatSettings')) || {};
            
            if (this.modelSelect) {
                this.modelSelect.value = settings.model || '';
            }
            
            if (this.maxTokensInput && this.maxTokensValue) {
                this.maxTokensInput.value = settings.maxTokens || 200;
                this.maxTokensValue.textContent = settings.maxTokens || 200;
            }
            
            if (this.temperatureInput && this.temperatureValue) {
                this.temperatureInput.value = settings.temperature || 0.7;
                this.temperatureValue.textContent = settings.temperature || 0.7;
            }
            
            if (this.systemPromptInput) {
                this.systemPromptInput.value = settings.systemPrompt || 'You are a helpful assistant.';
            }
            
            this.logger.info('Settings loaded');
        } catch (error) {
            this.logger.error('Error loading settings:', error);
        }
    }
    
    loadChatSettings() {
        const chat = this.chats.get(this.currentChatId);
        if (chat && chat.settings) {
            if (this.modelSelect) {
                this.modelSelect.value = chat.settings.model || '';
            }
            
            if (this.maxTokensInput && this.maxTokensValue) {
                this.maxTokensInput.value = chat.settings.maxTokens || 200;
                this.maxTokensValue.textContent = chat.settings.maxTokens || 200;
            }
            
            if (this.temperatureInput && this.temperatureValue) {
                this.temperatureInput.value = chat.settings.temperature || 0.7;
                this.temperatureValue.textContent = chat.settings.temperature || 0.7;
            }
            
            if (this.systemPromptInput) {
                this.systemPromptInput.value = chat.settings.systemPrompt || 'You are a helpful assistant.';
            }
        }
    }
    
    saveSettings() {
        try {
            const settings = this.getCurrentSettings();
            localStorage.setItem('chatSettings', JSON.stringify(settings));
            
            // Update current chat settings
            if (this.currentChatId) {
                const chat = this.chats.get(this.currentChatId);
                if (chat) {
                    chat.settings = settings;
                    this.saveChats();
                }
            }
            
            this.logger.debug('Settings saved:', settings);
        } catch (error) {
            this.logger.error('Error saving settings:', error);
        }
    }
    
    async loadModels() {
        try {
            const response = await fetch('/api/models');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }
            
            const data = await response.json();
            
            if (this.modelSelect) {
                this.modelSelect.innerHTML = '';
                
                if (data.models && data.models.length > 0) {
                    data.models.forEach(model => {
                        const option = document.createElement('option');
                        option.value = model.path;
                        option.textContent = `${model.name} (${model.sizeMB}MB)`;
                        this.modelSelect.appendChild(option);
                    });
                } else {
                    this.loadFallbackModels();
                }
                
                // Restore selected model
                const settings = JSON.parse(localStorage.getItem('chatSettings')) || {};
                if (settings.model) {
                    this.modelSelect.value = settings.model;
                }
            }
            
            this.logger.info('Models loaded:', { count: data.models?.length || 0 });
        } catch (error) {
            this.logger.error('Error loading models:', error);
            this.loadFallbackModels();
            this.showToast('Using fallback model list', 'warning');
        }
    }
    
    loadFallbackModels() {
        if (!this.modelSelect) return;
        
        this.modelSelect.innerHTML = '';
        
        const fallbackModels = [
            { name: 'Llama 3.2 1B Instruct', path: './../models/Llama-3.2-1B-Instruct-Q4_K_M.gguf', sizeMB: 600 },
            { name: 'Llama 3.2 3B Instruct', path: './../models/Llama-3.2-3B-Instruct-Q4_K_M.gguf', sizeMB: 1800 },
            { name: 'Mistral 7B Instruct', path: './../models/mistral-7b-instruct-v0.2.Q4_K_M.gguf', sizeMB: 4000 }
        ];
        
        fallbackModels.forEach(model => {
            const option = document.createElement('option');
            option.value = model.path;
            option.textContent = `${model.name} (${model.sizeMB}MB)`;
            this.modelSelect.appendChild(option);
        });
        
        // Select first model by default
        if (fallbackModels.length > 0) {
            this.modelSelect.value = fallbackModels[0].path;
        }
    }
    
    /**
     * UI Helpers
     */
    
    toggleSidebar() {
        if (!this.sidebar) return;
        
        this.sidebar.classList.toggle('open');
        this.updateSidebarIcons();
    }
    
    closeSidebar() {
        if (!this.sidebar) return;
        
        this.sidebar.classList.remove('open');
        this.updateSidebarIcons();
    }
    
    updateSidebarIcons() {
        const isOpen = this.sidebar?.classList.contains('open');
        
        // Update hamburger icon in sidebar
        if (this.toggleSidebarBtn) {
            this.toggleSidebarBtn.innerHTML = isOpen 
                ? '<i class="fas fa-times"></i>'
                : '<i class="fas fa-bars"></i>';
        }
        
        // Update hamburger icon in mobile top bar
        if (this.mobileSidebarToggle) {
            this.mobileSidebarToggle.innerHTML = isOpen
                ? '<i class="fas fa-times"></i>'
                : '<i class="fas fa-bars"></i>';
        }
    }
    
    clearInput() {
        if (this.messageInput) {
            this.messageInput.value = '';
            this.adjustTextareaHeight();
            this.messageInput.focus();
            this.uploadedFile = null;
        }
    }
    
    adjustTextareaHeight() {
        if (!this.messageInput) return;
        
        this.messageInput.style.height = 'auto';
        const newHeight = Math.min(this.messageInput.scrollHeight, 120);
        this.messageInput.style.height = newHeight + 'px';
    }
    
    updateChatTitle() {
        if (!this.currentChatTitle) return;
        
        const chat = this.chats.get(this.currentChatId);
        if (chat) {
            this.currentChatTitle.textContent = chat.title;
        } else {
            this.currentChatTitle.textContent = 'OpenChatMobile';
        }
    }
    
    updateConnectionStatus(status) {
        if (!this.statusDot || !this.statusText || !this.wsStatus) return;
        
        const statusMap = {
            connected: { text: 'Connected', class: 'connected' },
            connecting: { text: 'Connecting', class: 'connecting' },
            disconnected: { text: 'Disconnected', class: 'disconnected' }
        };
        
        const info = statusMap[status] || statusMap.disconnected;
        
        this.statusDot.className = 'status-dot ' + info.class;
        this.statusText.textContent = info.text;
        this.wsStatus.textContent = `WS: ${info.text}`;
    }
    
    updateTokenCount() {
        if (!this.tokenCount) return;
        
        const chat = this.chats.get(this.currentChatId);
        if (!chat) return;
        
        const totalTokens = chat.messages.reduce((sum, msg) => {
            // Simple token estimation (4 chars ≈ 1 token)
            return sum + Math.ceil(msg.content.length / 4);
        }, 0);
        
        this.tokenCount.textContent = `Tokens: ${totalTokens}`;
    }
    
    showToast(message, type = 'info') {
        if (!this.toastContainer) return;
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        
        const icons = {
            success: 'check-circle',
            error: 'exclamation-circle',
            warning: 'exclamation-triangle',
            info: 'info-circle'
        };
        
        toast.innerHTML = `
            <i class="fas fa-${icons[type] || 'info-circle'}"></i>
            <span>${this.escapeHtml(message)}</span>
            <button class="toast-close">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        this.toastContainer.appendChild(toast);
        
        // Add close button functionality
        const closeBtn = toast.querySelector('.toast-close');
        closeBtn?.addEventListener('click', () => {
            toast.remove();
        });
        
        // Auto-remove after delay
        setTimeout(() => {
            if (toast.parentNode) {
                toast.style.opacity = '0';
                toast.style.transform = 'translateX(100%)';
                setTimeout(() => toast.remove(), 300);
            }
        }, 4000);
    }
    
    toggleDarkMode(enabled) {
        document.body.classList.toggle('dark-theme', enabled);
        localStorage.setItem('darkMode', enabled.toString());
        this.logger.info('Theme toggled:', { darkMode: enabled });
    }
    
    handleResize() {
        // Adjust sidebar for mobile
        if (window.innerWidth >= 768 && this.sidebar) {
            this.closeSidebar();
        }
        
        // Adjust textarea height
        this.adjustTextareaHeight();
        
        // Re-render messages if needed
        this.renderMessages();
    }
    
    saveCurrentState() {
        this.saveChats();
        this.saveSettings();
        this.logger.info('Application state saved');
    }
    
    /**
     * Export & Copy Functions
     */
    
    exportCurrentChat() {
        const chat = this.chats.get(this.currentChatId);
        if (!chat || chat.messages.length === 0) {
            this.showToast('No messages to export', 'warning');
            return;
        }
        
        try {
            let content = `# ${chat.title}\n\n`;
            content += `**Exported:** ${new Date().toLocaleString()}\n`;
            content += `**Model:** ${chat.settings.model || 'Default'}\n`;
            content += `**Temperature:** ${chat.settings.temperature || 0.7}\n`;
            content += `**Max Tokens:** ${chat.settings.maxTokens || 200}\n`;
            content += `**System Prompt:** ${chat.settings.systemPrompt || 'Default'}\n\n`;
            content += '---\n\n';
            
            chat.messages.forEach(msg => {
                const role = msg.role === 'user' ? 'User' : 'Assistant';
                const time = new Date(msg.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit'
                });
                
                content += `### ${role} (${time})\n\n`;
                content += `${msg.content}\n\n`;
                content += '---\n\n';
            });
            
            const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `chat-${chat.title.replace(/[^a-z0-9]/gi, '-').toLowerCase()}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showToast('Chat exported successfully', 'success');
            this.logger.info('Chat exported:', { chatId: chat.id, title: chat.title });
            
        } catch (error) {
            this.logger.error('Error exporting chat:', error);
            this.showToast('Failed to export chat', 'error');
        }
    }
    
    async copyChatToClipboard(chatId) {
        const chat = this.chats.get(chatId);
        if (!chat) return;
        
        let content = '';
        chat.messages.forEach(msg => {
            const role = msg.role === 'user' ? 'User' : 'Assistant';
            const time = new Date(msg.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit'
            });
            content += `[${time}] ${role}: ${msg.content}\n\n`;
        });
        
        try {
            await navigator.clipboard.writeText(content);
            this.showToast('Chat copied to clipboard', 'success');
            this.logger.info('Chat copied to clipboard:', { chatId });
        } catch (error) {
            this.logger.error('Error copying chat:', error);
            this.showToast('Failed to copy chat', 'error');
        }
    }
    
    async copyMessageToClipboard(messageId) {
        const chat = this.chats.get(this.currentChatId);
        if (!chat) return;
        
        const message = chat.messages.find(m => m.id === messageId);
        if (!message) return;
        
        try {
            await navigator.clipboard.writeText(message.content);
            this.showToast('Message copied to clipboard', 'success');
            this.logger.info('Message copied to clipboard:', { messageId });
        } catch (error) {
            this.logger.error('Error copying message:', error);
            this.showToast('Failed to copy message', 'error');
        }
    }
    
    async regenerateResponse(messageId) {
        if (this.isGenerating) {
            this.showToast('Please wait for current generation to complete', 'warning');
            return;
        }
        
        const chat = this.chats.get(this.currentChatId);
        if (!chat) return;
        
        // Find the message and remove all messages after it
        const messageIndex = chat.messages.findIndex(m => m.id === messageId);
        if (messageIndex === -1) return;
        
        // Keep only messages up to the selected one
        chat.messages = chat.messages.slice(0, messageIndex + 1);
        
        // If the selected message is from the bot, regenerate it
        const message = chat.messages[messageIndex];
        if (message.role === 'bot') {
            // Remove the bot message and regenerate
            chat.messages.pop();
            this.saveChats();
            this.renderMessages();
            
            // Trigger new generation with the last user message
            const lastUserMessage = chat.messages[chat.messages.length - 1];
            if (lastUserMessage && lastUserMessage.role === 'user') {
                this.messageInput.value = lastUserMessage.content;
                this.sendMessage();
            }
        }
    }
    
    /**
     * Utility Functions
     */
    
    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    markdownToHtml(text) {
        if (!text) return '';
        
        // Escape HTML first
        let html = this.escapeHtml(text);
        
        // Convert markdown-like syntax
        html = html
            .replace(/\n/g, '<br>')
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
        
        return html;
    }
    
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    getTimeAgo(date) {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (diffMins < 1) return 'just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        
        return date.toLocaleDateString();
    }
    
    /**
     * Public API for debugging
     */
    getDebugInfo() {
        return {
            currentChatId: this.currentChatId,
            chatCount: this.chats.size,
            isGenerating: this.isGenerating,
            isConnected: this.isConnected,
            websocketState: this.ws?.readyState,
            serverHealth: this.serverHealth,
            serverConfig: this.serverConfig,
            uploadedFile: this.uploadedFile,
            reconnectAttempts: this.reconnectAttempts,
            pendingTokens: this.pendingTokens.size,
            accumulatedContent: this.accumulatedContent.size
        };
    }
    
    /**
     * Cleanup on page unload
     */
    cleanup() {
        // Limpiar timeouts
        if (this.renderTimeout) {
            clearTimeout(this.renderTimeout);
        }
        
        // Cerrar WebSocket
        if (this.ws) {
            this.ws.close(1000, 'Page unloading');
        }
        
        // Guardar estado
        this.saveCurrentState();
        this.logger.info('Application cleanup completed');
    }
}

// Initialize application when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    // Create global app instance
    window.app = new OpenChatMobile();
    
    // Make debug info available globally
    window.getChatDebugInfo = () => window.app?.getDebugInfo();
    
    // Cleanup on page unload
    window.addEventListener('unload', () => {
        window.app?.cleanup();
    });
    
    // Handle service worker for PWA capabilities
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    }
});

// Export for module usage if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = OpenChatMobile;
}