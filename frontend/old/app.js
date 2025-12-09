class LlamaChat {
  constructor() {
    this.ws = null;
    this.currentChatId = null;
    this.chats = new Map();
    this.isTyping = false;
    this.isStreaming = false;
    this.currentModel = 'llama-3.2-1b';

    this.initializeApp();
  }

  initializeApp() {
    this.bindElements();
    this.bindEvents();
    this.loadChatHistory();
    this.connectWebSocket();
    this.checkServerStatus();

    // Cargar tema
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    this.updateThemeIcon(savedTheme);
  }

  bindElements() {
    this.elements = {
      messageInput: document.getElementById('messageInput'),
      sendBtn: document.getElementById('sendBtn'),
      messagesContainer: document.getElementById('messagesContainer'),
      chatHistory: document.getElementById('chatHistory'),
      newChatBtn: document.getElementById('newChat'),
      themeToggle: document.getElementById('themeToggle'),
      settingsModal: document.getElementById('settingsModal'),
      settingsToggle: document.getElementById('settingsToggle'),
      modelSelect: document.getElementById('modelSelect'),
      temperature: document.getElementById('temperature'),
      maxTokens: document.getElementById('maxTokens'),
      tempValue: document.getElementById('tempValue'),
      tokensValue: document.getElementById('tokensValue'),
      typingIndicator: document.getElementById('typingIndicator'),
      statusText: document.getElementById('statusText'),
      menuToggle: document.getElementById('menuToggle'),
      welcomeMessage: document.getElementById('welcomeMessage')
    };
  }

  bindEvents() {
    // Envío de mensajes
    this.elements.messageInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    this.elements.sendBtn.addEventListener('click', () => this.sendMessage());

    // Input auto-resize
    this.elements.messageInput.addEventListener('input', (e) => {
      e.target.style.height = 'auto';
      e.target.style.height = e.target.scrollHeight + 'px';
    });

    // Nuevo chat
    this.elements.newChatBtn.addEventListener('click', () => this.createNewChat());

    // Tema claro/oscuro
    this.elements.themeToggle.addEventListener('click', () => this.toggleTheme());

    // Configuración
    this.elements.settingsToggle.addEventListener('click', () => {
      this.elements.settingsModal.classList.add('active');
    });

    document.querySelector('.close-modal').addEventListener('click', () => {
      this.elements.settingsModal.classList.remove('active');
    });

    // Sliders
    this.elements.temperature.addEventListener('input', (e) => {
      this.elements.tempValue.textContent = e.target.value;
    });

    this.elements.maxTokens.addEventListener('input', (e) => {
      this.elements.tokensValue.textContent = e.target.value;
    });

    // Model selection
    this.elements.modelSelect.addEventListener('change', (e) => {
      this.currentModel = e.target.value;
      this.updateModelTag();
    });

    // Menu toggle (mobile)
    this.elements.menuToggle.addEventListener('click', () => {
      document.querySelector('.sidebar').classList.toggle('active');
    });

    // Quick prompts
    document.querySelectorAll('.quick-prompt').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const prompt = e.target.dataset.prompt;
        this.elements.messageInput.value = prompt;
        this.elements.messageInput.focus();
        this.elements.messageInput.style.height = 'auto';
        this.elements.messageInput.style.height = this.elements.messageInput.scrollHeight + 'px';
      });
    });
  }

  connectWebSocket() {
    this.ws = new WebSocket('ws://localhost:8081');

    this.ws.onopen = () => {
      console.log('✅ Conectado al WebSocket');
      this.updateStatus('Conectado', 'success');
    };

    this.ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      this.handleWebSocketMessage(data);
    };

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      this.updateStatus('Error de conexión', 'error');
    };

    this.ws.onclose = () => {
      console.log('WebSocket cerrado, reconectando...');
      this.updateStatus('Reconectando...', 'warning');
      setTimeout(() => this.connectWebSocket(), 3000);
    };
  }

  async sendMessage() {
    const message = this.elements.messageInput.value.trim();
    if (!message || this.isTyping) return;

    // Crear nuevo chat si no existe
    if (!this.currentChatId) {
      this.createNewChat();
    }

    // Limpiar input
    this.elements.messageInput.value = '';
    this.elements.messageInput.style.height = 'auto';

    // Deshabilitar input durante el envío
    this.setTypingState(true);
    this.elements.sendBtn.disabled = true;
    this.elements.typingIndicator.classList.add('active');

    // Agregar mensaje del usuario
    this.addMessage('user', message);

    // Obtener historial del chat actual
    const chat = this.chats.get(this.currentChatId);
    const history = chat?.messages || [];

    try {
      // Enviar al WebSocket para streaming
      this.ws.send(JSON.stringify({
        type: 'chat',
        message: message,
        history: history,
        temperature: parseFloat(this.elements.temperature.value),
        maxTokens: parseInt(this.elements.maxTokens.value)
      }));

      // Agregar placeholder para la respuesta
      const messageId = Date.now();
      this.addMessage('assistant', '', messageId);

    } catch (error) {
      console.error('Error sending message:', error);
      this.addMessage('assistant', `Error: ${error.message}`);
      this.setTypingState(false);
    }
  }

  handleWebSocketMessage(data) {
    switch (data.type) {
      case 'token':
        this.appendToLastMessage(data.token);
        break;

      case 'done':
        this.finalizeMessage();
        this.setTypingState(false);
        this.saveChatHistory();
        break;

      case 'error':
        this.addMessage('assistant', `Error: ${data.message}`);
        this.setTypingState(false);
        break;

      case 'stopped':
        this.finalizeMessage();
        this.setTypingState(false);
        break;
    }
  }

  addMessage(role, content, messageId = null) {
    if (!this.currentChatId) return;

    const chat = this.chats.get(this.currentChatId);
    if (!chat) return;

    const id = messageId || Date.now();
    const timestamp = new Date();

    const message = {
      id,
      role,
      content,
      timestamp
    };

    chat.messages.push(message);

    // Si no hay messageId, es un mensaje completo
    if (!messageId) {
      this.renderMessage(message);
    }

    // Actualizar historial en sidebar
    this.updateChatHistory();

    return id;
  }

  renderMessage(message) {
    // Ocultar mensaje de bienvenida si existe
    if (this.elements.welcomeMessage) {
      this.elements.welcomeMessage.style.display = 'none';
    }

    const messageDiv = document.createElement('div');
    messageDiv.className = `message ${message.role}`;
    messageDiv.dataset.messageId = message.id;

    const time = message.timestamp.toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    messageDiv.innerHTML = `
            <div class="message-bubble">
                <div class="message-header">
                    <i class="fas ${message.role === 'user' ? 'fa-user' : 'fa-robot'}"></i>
                    <span class="message-time">${time}</span>
                </div>
                <div class="message-content">${this.escapeHtml(message.content)}</div>
                <div class="message-footer">
                    <span class="message-model">${this.currentModel}</span>
                    <div class="message-actions">
                        <button class="message-action" onclick="chat.copyMessage('${message.id}')" title="Copiar">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="message-action" onclick="chat.regenerateMessage('${message.id}')" title="Regenerar">
                            <i class="fas fa-redo"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;

    this.elements.messagesContainer.appendChild(messageDiv);
    messageDiv.scrollIntoView({ behavior: 'smooth' });
  }

  appendToLastMessage(token) {
    const lastMessage = this.elements.messagesContainer.querySelector('.message.assistant:last-child');
    if (lastMessage) {
      const contentDiv = lastMessage.querySelector('.message-content');
      if (contentDiv) {
        contentDiv.innerHTML += this.escapeHtml(token);
        lastMessage.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }

  finalizeMessage() {
    const lastMessage = this.elements.messagesContainer.querySelector('.message.assistant:last-child');
    if (lastMessage) {
      const contentDiv = lastMessage.querySelector('.message-content');
      if (contentDiv) {
        // Actualizar el chat en memoria con el contenido completo
        const chat = this.chats.get(this.currentChatId);
        if (chat && chat.messages.length > 0) {
          const lastMsg = chat.messages[chat.messages.length - 1];
          lastMsg.content = contentDiv.textContent;
        }
      }
    }
  }

  createNewChat() {
    const chatId = `chat_${Date.now()}`;
    const title = `Chat ${this.chats.size + 1}`;

    this.chats.set(chatId, {
      id: chatId,
      title: title,
      model: this.currentModel,
      createdAt: new Date(),
      messages: []
    });

    this.currentChatId = chatId;
    this.elements.messagesContainer.innerHTML = '';

    if (this.elements.welcomeMessage) {
      this.elements.welcomeMessage.style.display = 'block';
    }

    this.updateChatHistory();
    this.saveChatHistory();

    return chatId;
  }

  updateChatHistory() {
    this.elements.chatHistory.innerHTML = '';

    this.chats.forEach((chat, id) => {
      const chatItem = document.createElement('div');
      chatItem.className = `chat-item ${id === this.currentChatId ? 'active' : ''}`;
      chatItem.dataset.chatId = id;

      const lastMessage = chat.messages[chat.messages.length - 1];
      const preview = lastMessage 
        ? (lastMessage.content.substring(0, 30) + '...') 
        : 'Nuevo chat';

      chatItem.innerHTML = `
                <i class="fas fa-comment"></i>
                <div>
                    <div class="chat-title">${chat.title}</div>
                    <div class="chat-preview">${preview}</div>
                </div>
            `;

      chatItem.addEventListener('click', () => this.loadChat(id));
      this.elements.chatHistory.appendChild(chatItem);
    });
  }

  loadChat(chatId) {
    const chat = this.chats.get(chatId);
    if (!chat) return;

    this.currentChatId = chatId;
    this.currentModel = chat.model;

    // Actualizar UI
    this.elements.modelSelect.value = chat.model;
    this.updateModelTag();

    // Limpiar y cargar mensajes
    this.elements.messagesContainer.innerHTML = '';

    if (chat.messages.length === 0 && this.elements.welcomeMessage) {
      this.elements.welcomeMessage.style.display = 'block';
    } else {
      chat.messages.forEach(msg => this.renderMessage(msg));
    }

    // Actualizar historial
    this.updateChatHistory();

    // Cerrar sidebar en móvil
    document.querySelector('.sidebar').classList.remove('active');
  }

  loadChatHistory() {
    const saved = localStorage.getItem('llama_chats');
    if (saved) {
      try {
        const chatsData = JSON.parse(saved);
        chatsData.forEach(chatData => {
          chatData.createdAt = new Date(chatData.createdAt);
          chatData.messages.forEach(msg => {
            msg.timestamp = new Date(msg.timestamp);
          });
          this.chats.set(chatData.id, chatData);
        });

        // Cargar el último chat si existe
        if (this.chats.size > 0) {
          const lastChatId = Array.from(this.chats.keys()).pop();
          this.loadChat(lastChatId);
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    }
  }

  saveChatHistory() {
    const chatsArray = Array.from(this.chats.values());
    localStorage.setItem('llama_chats', JSON.stringify(chatsArray));
  }

  setTypingState(isTyping) {
    this.isTyping = isTyping;
    this.elements.sendBtn.disabled = isTyping;
    this.elements.messageInput.disabled = isTyping;
    this.elements.typingIndicator.classList.toggle('active', isTyping);

    if (isTyping) {
      this.updateStatus('Escribiendo...', 'warning');
    } else {
      this.updateStatus('Conectado', 'success');
    }
  }

  updateStatus(text, type = 'info') {
    this.elements.statusText.textContent = text;

    // Puedes agregar colores según el tipo
    const colors = {
      success: '#10b981',
      warning: '#f59e0b',
      error: '#ef4444',
      info: '#6d28d9'
    };

    this.elements.statusText.style.color = colors[type] || colors.info;
  }

  updateModelTag() {
    const modelTag = document.getElementById('currentModel');
    if (modelTag) {
      modelTag.textContent = this.currentModel;
    }
  }

  toggleTheme() {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    document.documentElement.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    this.updateThemeIcon(newTheme);
  }

  updateThemeIcon(theme) {
    const icon = this.elements.themeToggle.querySelector('i');
    if (icon) {
      icon.className = theme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    }
  }

  async checkServerStatus() {
    try {
      const response = await fetch('/api/health');
      const data = await response.json();

      const statusDot = document.querySelector('.status-dot');
      if (statusDot) {
        statusDot.className = `status-dot ${data.llama === 'running' ? 'active' : ''}`;
      }
    } catch (error) {
      console.error('Error checking server status:', error);
    }
  }

  copyMessage(messageId) {
    const chat = this.chats.get(this.currentChatId);
    if (!chat) return;

    const message = chat.messages.find(msg => msg.id === messageId);
    if (message) {
      navigator.clipboard.writeText(message.content)
        .then(() => this.showToast('Mensaje copiado'));
    }
  }

  regenerateMessage(messageId) {
    const chat = this.chats.get(this.currentChatId);
    if (!chat) return;

    // Encontrar el índice del mensaje
    const msgIndex = chat.messages.findIndex(msg => msg.id === messageId);
    if (msgIndex === -1) return;

    // Eliminar mensajes posteriores (si los hay)
    chat.messages.splice(msgIndex);

    // Recargar chat
    this.loadChat(this.currentChatId);

    // Re-enviar el último mensaje del usuario
    const userMessage = chat.messages[chat.messages.length - 1];
    if (userMessage && userMessage.role === 'user') {
      setTimeout(() => {
        this.elements.messageInput.value = userMessage.content;
        this.sendMessage();
      }, 500);
    }
  }

  showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('show');
    }, 10);

    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
}

// Inicializar la app cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
  window.chat = new LlamaChat();
});

// Estilos adicionales para toast
const toastStyles = document.createElement('style');
toastStyles.textContent = `
.toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%) translateY(100px);
    background: var(--accent-primary);
    color: white;
    padding: 12px 24px;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow);
    z-index: 9999;
    transition: transform 0.3s ease;
    font-weight: 500;
}
.toast.show {
    transform: translateX(-50%) translateY(0);
}
`;
document.head.appendChild(toastStyles);
