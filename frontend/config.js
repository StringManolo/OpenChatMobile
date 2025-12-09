/**
 * OpenChatMobile Configuration
 * Centralized configuration for the frontend application
 */

// Application configuration
const CONFIG = {
    // Application Info
    APP_NAME: 'OpenChatMobile',
    APP_VERSION: '2.0.0',
    
    // API Configuration
    API_BASE_URL: window.location.origin,
    WS_BASE_URL: (() => {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const port = parseInt(window.location.port) + 1 || 8081;
        return `${protocol}//${window.location.hostname}:${port}`;
    })(),
    
    // Timeout Configuration (in milliseconds)
    TIMEOUTS: {
        CONNECTION: 10000,      // WebSocket connection timeout
        REQUEST: 30000,         // HTTP request timeout
        RECONNECT_DELAY: 3000,  // WebSocket reconnect delay
        TOAST_DURATION: 4000,   // Toast notification duration
        TYPING_INDICATOR: 1000  // Typing indicator animation
    },
    
    // UI Configuration
    UI: {
        MAX_MESSAGE_LENGTH: 5000,           // Maximum message length
        MAX_INPUT_HEIGHT: 200,              // Maximum input textarea height (px)
        MAX_CHATS_DISPLAYED: 20,            // Maximum chats to display in sidebar
        AUTO_SCROLL_DELAY: 100,             // Delay for auto-scroll (ms)
        DEBOUNCE_DELAY: 300,                // Debounce delay for input events
        ANIMATION_DURATION: 300             // Animation duration (ms)
    },
    
    // Model Configuration
    MODEL: {
        MAX_TOKENS_RANGE: { min: 1, max: 8192, default: 200 },
        TEMPERATURE_RANGE: { min: 0.1, max: 2.0, step: 0.1, default: 0.7 },
        CONTEXT_SIZES: [512, 1024, 2048, 4096, 8192, 16384]
    },
    
    // File Upload Configuration
    FILE_UPLOAD: {
        MAX_SIZE: 10 * 1024 * 1024, // 10MB
        ALLOWED_TYPES: [
            'text/plain',
            'text/markdown',
            'text/html',
            'application/json',
            'text/csv',
            'application/pdf',
            'image/jpeg',
            'image/png',
            'image/gif',
            'image/webp'
        ],
        CHUNK_SIZE: 1024 * 1024, // 1MB chunks
        MAX_PREVIEW_LENGTH: 1000 // Maximum preview characters
    },
    
    // Storage Configuration
    STORAGE: {
        KEYS: {
            CHAT_HISTORY: 'chatHistory',
            CHAT_SETTINGS: 'chatSettings',
            THEME_PREFERENCE: 'themePreference',
            RECENT_MODELS: 'recentModels',
            USER_PREFERENCES: 'userPreferences'
        },
        VERSION: '2.0',
        MIGRATION_KEY: 'storage_migrated'
    },
    
    // Default Settings
    DEFAULTS: {
        SETTINGS: {
            model: './../models/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
            maxTokens: 200,
            temperature: 0.7,
            systemPrompt: 'You are a helpful assistant. Answer questions concisely and accurately.',
            enableStreaming: true,
            autoScroll: true,
            showTimestamps: true,
            compactMode: false
        },
        THEME: 'light', // 'light' or 'dark'
        LANGUAGE: 'en'
    },
    
    // Feature Flags
    FEATURES: {
        ENABLE_FILE_UPLOAD: true,
        ENABLE_MULTIPLE_CHATS: true,
        ENABLE_THEME_TOGGLE: true,
        ENABLE_MODEL_SWITCHING: true,
        ENABLE_EXPORT: true,
        ENABLE_IMPORT: true,
        ENABLE_DEBUG_INFO: true,
        ENABLE_KEYBOARD_SHORTCUTS: true,
        ENABLE_QUICK_ACTIONS: true,
        ENABLE_ANIMATIONS: true
    },
    
    // Keyboard Shortcuts
    SHORTCUTS: {
        NEW_CHAT: { key: 'n', ctrl: true, description: 'New chat' },
        EXPORT_CHAT: { key: 'e', ctrl: true, shift: true, description: 'Export chat' },
        TOGGLE_SIDEBAR: { key: 'b', ctrl: true, description: 'Toggle sidebar' },
        TOGGLE_THEME: { key: 't', ctrl: true, shift: true, description: 'Toggle theme' },
        FOCUS_INPUT: { key: 'i', ctrl: true, description: 'Focus input' },
        CLEAR_INPUT: { key: 'k', ctrl: true, description: 'Clear input' },
        STOP_GENERATION: { key: 'Escape', description: 'Stop generation' }
    },
    
    // Error Messages
    ERRORS: {
        CONNECTION_FAILED: 'Failed to connect to server. Please check if the backend is running.',
        WEBSOCKET_FAILED: 'WebSocket connection failed. Using HTTP fallback mode.',
        FILE_TOO_LARGE: 'File is too large. Maximum size is 10MB.',
        INVALID_FILE_TYPE: 'File type not supported.',
        NETWORK_ERROR: 'Network error. Please check your connection.',
        SERVER_ERROR: 'Server error. Please try again later.',
        GENERATION_FAILED: 'Failed to generate response. Please try again.',
        UPLOAD_FAILED: 'File upload failed. Please try again.',
        EXPORT_FAILED: 'Failed to export chat. Please try again.',
        IMPORT_FAILED: 'Failed to import chat. Please check the file format.'
    },
    
    // Success Messages
    SUCCESS: {
        CONNECTION_ESTABLISHED: 'Connected to server successfully.',
        MESSAGE_SENT: 'Message sent successfully.',
        FILE_UPLOADED: 'File uploaded successfully.',
        SETTINGS_SAVED: 'Settings saved successfully.',
        CHAT_CREATED: 'New chat created.',
        CHAT_EXPORTED: 'Chat exported successfully.',
        CHAT_IMPORTED: 'Chat imported successfully.',
        HISTORY_CLEARED: 'Chat history cleared.'
    },
    
    // Warning Messages
    WARNINGS: {
        UNSAVED_CHANGES: 'You have unsaved changes. Are you sure you want to leave?',
        DELETE_CHAT: 'Are you sure you want to delete this chat? This action cannot be undone.',
        CLEAR_HISTORY: 'Are you sure you want to clear ALL chat history? This action cannot be undone.',
        LARGE_FILE: 'Large file detected. Upload may take longer.',
        SLOW_CONNECTION: 'Slow connection detected. Switching to fallback mode.'
    },
    
    // Animation Configuration
    ANIMATIONS: {
        DURATIONS: {
            FADE_IN: 300,
            SLIDE_IN: 300,
            SLIDE_OUT: 300,
            SCALE: 200,
            ROTATE: 500
        },
        EASING: {
            DEFAULT: 'cubic-bezier(0.4, 0, 0.2, 1)',
            BOUNCE: 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
            ELASTIC: 'cubic-bezier(0.68, -0.6, 0.32, 1.6)'
        }
    },
    
    // Performance Configuration
    PERFORMANCE: {
        MAX_MESSAGES_PER_CHAT: 1000,
        MESSAGE_CLEANUP_THRESHOLD: 500,
        DEBOUNCE_THRESHOLD: 100,
        MEMORY_CLEANUP_INTERVAL: 30000 // 30 seconds
    },
    
    // Localization
    LANGUAGES: {
        en: {
            name: 'English',
            nativeName: 'English',
            direction: 'ltr'
        },
        es: {
            name: 'Spanish',
            nativeName: 'Español',
            direction: 'ltr'
        }
    },
    
    // Accessibility
    ACCESSIBILITY: {
        SKIP_NAV_ID: 'skip-navigation',
        ARIA_LABELS: {
            SEND_BUTTON: 'Send message',
            STOP_BUTTON: 'Stop generation',
            NEW_CHAT_BUTTON: 'Create new chat',
            CLEAR_INPUT_BUTTON: 'Clear input',
            FILE_UPLOAD_BUTTON: 'Upload file',
            TOGGLE_THEME_BUTTON: 'Toggle theme'
        }
    }
};

// Fallback models in case API fails
const FALLBACK_MODELS = [
    {
        name: 'Llama 3.2 1B Instruct',
        path: './../models/Llama-3.2-1B-Instruct-Q4_K_M.gguf',
        size: 629145600, // 600MB in bytes
        sizeMB: 600,
        description: 'Lightweight model for fast responses',
        contextSize: 4096,
        tags: ['lightweight', 'fast', 'general']
    },
    {
        name: 'Llama 3.2 3B Instruct',
        path: './../models/Llama-3.2-3B-Instruct-Q4_K_M.gguf',
        size: 1887436800, // 1.8GB in bytes
        sizeMB: 1800,
        description: 'Balanced model for better quality',
        contextSize: 8192,
        tags: ['balanced', 'quality', 'general']
    },
    {
        name: 'Mistral 7B Instruct',
        path: './../models/mistral-7b-instruct-v0.2.Q4_K_M.gguf',
        size: 4294967296, // 4GB in bytes
        sizeMB: 4000,
        description: 'High quality model for complex tasks',
        contextSize: 8192,
        tags: ['high-quality', 'complex-tasks', 'advanced']
    }
];

// Export configuration for debugging
const DEBUG_CONFIG = {
    ENABLE_LOGGING: true,
    LOG_LEVEL: 'info', // 'debug', 'info', 'warn', 'error'
    ENABLE_PERFORMANCE_MONITORING: true,
    CAPTURE_ERRORS: true,
    SEND_ERROR_REPORTS: false
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        CONFIG,
        FALLBACK_MODELS,
        DEBUG_CONFIG
    };
} else {
    // Make available globally
    window.OpenChatMobileConfig = CONFIG;
    window.FALLBACK_MODELS = FALLBACK_MODELS;
    window.DEBUG_CONFIG = DEBUG_CONFIG;
    
    // Helper function to get config value with fallback
    window.getConfig = (path, defaultValue = null) => {
        const parts = path.split('.');
        let value = CONFIG;
        
        for (const part of parts) {
            if (value && typeof value === 'object' && part in value) {
                value = value[part];
            } else {
                return defaultValue;
            }
        }
        
        return value;
    };
    
    // Helper function to check if feature is enabled
    window.isFeatureEnabled = (feature) => {
        const featurePath = `FEATURES.${feature}`;
        return window.getConfig(featurePath, false);
    };
    
    // Log configuration for debugging
    if (DEBUG_CONFIG.ENABLE_LOGGING && DEBUG_CONFIG.LOG_LEVEL === 'debug') {
        console.debug('OpenChatMobile Configuration loaded:', CONFIG);
        console.debug('Fallback models:', FALLBACK_MODELS);
    }
}