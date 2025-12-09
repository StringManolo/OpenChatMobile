/**
 * OpenChatMobile Utilities
 * Reusable utility functions for the application
 */

class ChatUtils {
    /**
     * Format date to readable string
     * @param {Date|string|number} date - Date to format
     * @param {Object} options - Formatting options
     * @returns {string} Formatted date string
     */
    static formatDate(date, options = {}) {
        const d = new Date(date);
        const now = new Date();
        const diffMs = now - d;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);
        
        if (options.relative) {
            if (diffMins < 1) return 'just now';
            if (diffMins < 60) return `${diffMins}m ago`;
            if (diffHours < 24) return `${diffHours}h ago`;
            if (diffDays < 7) return `${diffDays}d ago`;
        }
        
        if (options.timeOnly) {
            return d.toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
                hour12: true
            });
        }
        
        if (options.dateOnly) {
            return d.toLocaleDateString();
        }
        
        // Default format: "MM/DD/YYYY, HH:MM AM/PM"
        return d.toLocaleString();
    }
    
    /**
     * Format file size to human readable string
     * @param {number} bytes - File size in bytes
     * @returns {string} Formatted file size
     */
    static formatFileSize(bytes) {
        if (typeof bytes !== 'number' || bytes < 0) return '0 Bytes';
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        const size = parseFloat((bytes / Math.pow(k, i)).toFixed(2));
        return `${size} ${sizes[i]}`;
    }
    
    /**
     * Truncate text with ellipsis
     * @param {string} text - Text to truncate
     * @param {number} maxLength - Maximum length
     * @param {boolean} keepWords - Whether to keep whole words
     * @returns {string} Truncated text
     */
    static truncateText(text, maxLength = 100, keepWords = true) {
        if (!text || text.length <= maxLength) return text;
        
        if (keepWords) {
            let truncated = text.substring(0, maxLength);
            const lastSpace = truncated.lastIndexOf(' ');
            
            if (lastSpace > 0) {
                truncated = truncated.substring(0, lastSpace);
            }
            
            return truncated + '...';
        }
        
        return text.substring(0, maxLength) + '...';
    }
    
    /**
     * Generate a unique ID
     * @param {string} prefix - ID prefix
     * @returns {string} Unique ID
     */
    static generateId(prefix = '') {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substring(2, 9);
        return `${prefix}${timestamp}_${random}`;
    }
    
    /**
     * Debounce function
     * @param {Function} func - Function to debounce
     * @param {number} wait - Wait time in milliseconds
     * @returns {Function} Debounced function
     */
    static debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Throttle function
     * @param {Function} func - Function to throttle
     * @param {number} limit - Time limit in milliseconds
     * @returns {Function} Throttled function
     */
    static throttle(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    /**
     * Check if string is a valid URL
     * @param {string} string - String to check
     * @returns {boolean} Whether string is a valid URL
     */
    static isValidUrl(string) {
        try {
            const url = new URL(string);
            return url.protocol === 'http:' || url.protocol === 'https:';
        } catch (_) {
            return false;
        }
    }
    
    /**
     * Copy text to clipboard
     * @param {string} text - Text to copy
     * @returns {Promise<void>}
     */
    static async copyToClipboard(text) {
        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(text);
                return true;
            } else {
                // Fallback for older browsers and non-HTTPS contexts
                const textArea = document.createElement('textarea');
                textArea.value = text;
                textArea.style.position = 'fixed';
                textArea.style.left = '-999999px';
                textArea.style.top = '-999999px';
                document.body.appendChild(textArea);
                textArea.focus();
                textArea.select();
                
                const success = document.execCommand('copy');
                document.body.removeChild(textArea);
                
                return success;
            }
        } catch (error) {
            console.error('Failed to copy text:', error);
            return false;
        }
    }
    
    /**
     * Read file as text
     * @param {File} file - File to read
     * @returns {Promise<string>} File content
     */
    static async readFileAsText(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsText(file);
        });
    }
    
    /**
     * Read file as DataURL
     * @param {File} file - File to read
     * @returns {Promise<string>} DataURL
     */
    static async readFileAsDataURL(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = (error) => reject(error);
            reader.readAsDataURL(file);
        });
    }
    
    /**
     * Create DOM element from HTML string
     * @param {string} htmlString - HTML string
     * @returns {HTMLElement} DOM element
     */
    static createElementFromHTML(htmlString) {
        const template = document.createElement('template');
        htmlString = htmlString.trim();
        template.innerHTML = htmlString;
        return template.content.firstChild;
    }
    
    /**
     * Get scroll parent of element
     * @param {HTMLElement} element - Element to check
     * @returns {HTMLElement} Scroll parent
     */
    static getScrollParent(element) {
        while (element) {
            const { overflow, overflowY } = getComputedStyle(element);
            if (overflow === 'auto' || overflow === 'scroll' || 
                overflowY === 'auto' || overflowY === 'scroll') {
                return element;
            }
            element = element.parentElement;
        }
        return document.scrollingElement || document.documentElement;
    }
    
    /**
     * Smooth scroll to element
     * @param {HTMLElement} element - Element to scroll to
     * @param {Object} options - Scroll options
     */
    static scrollToElement(element, options = {}) {
        const defaultOptions = {
            behavior: 'smooth',
            block: 'start',
            inline: 'nearest'
        };
        
        element.scrollIntoView({ ...defaultOptions, ...options });
    }
    
    /**
     * Escape HTML special characters
     * @param {string} text - Text to escape
     * @returns {string} Escaped text
     */
    static escapeHtml(text) {
        if (!text) return '';
        
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        
        return text.replace(/[&<>"']/g, char => map[char]);
    }
    
    /**
     * Convert markdown-like syntax to HTML
     * @param {string} text - Text to convert
     * @returns {string} HTML string
     */
    static markdownToHtml(text) {
        if (!text) return '';
        
        // Escape HTML first
        let html = this.escapeHtml(text);
        
        // Convert markdown-like syntax
        html = html
            // Line breaks
            .replace(/\n/g, '<br>')
            
            // Inline code
            .replace(/`([^`]+)`/g, '<code>$1</code>')
            
            // Bold
            .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
            .replace(/__([^_]+)__/g, '<strong>$1</strong>')
            
            // Italic
            .replace(/\*([^*]+)\*/g, '<em>$1</em>')
            .replace(/_([^_]+)_/g, '<em>$1</em>')
            
            // Headers
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
            
            // Auto-link URLs
            .replace(/(https?:\/\/[^\s]+)/g, '<a href="$1" target="_blank" rel="noopener noreferrer">$1</a>')
            
            // Lists
            .replace(/^\s*[-*]\s+(.*$)/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
            .replace(/<\/ul>\n<ul>/g, '')
            
            // Paragraphs (wrap consecutive non-list lines)
            .replace(/^(?!<[hlu])(.*)$/gm, '<p>$1</p>');
        
        return html;
    }
    
    /**
     * Validate email address
     * @param {string} email - Email to validate
     * @returns {boolean} Whether email is valid
     */
    static isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
    
    /**
     * Validate file type
     * @param {File} file - File to validate
     * @param {Array<string>} allowedTypes - Allowed MIME types
     * @returns {boolean} Whether file type is allowed
     */
    static isValidFileType(file, allowedTypes) {
        if (!allowedTypes || allowedTypes.length === 0) return true;
        
        return allowedTypes.some(type => {
            if (type.endsWith('/*')) {
                const category = type.slice(0, -2);
                return file.type.startsWith(category);
            }
            return file.type === type;
        });
    }
    
    /**
     * Validate file size
     * @param {File} file - File to validate
     * @param {number} maxSize - Maximum size in bytes
     * @returns {boolean} Whether file size is valid
     */
    static isValidFileSize(file, maxSize) {
        return file.size <= maxSize;
    }
    
    /**
     * Get file extension
     * @param {string} filename - Filename
     * @returns {string} File extension
     */
    static getFileExtension(filename) {
        return filename.slice((filename.lastIndexOf('.') - 1 >>> 0) + 2);
    }
    
    /**
     * Get MIME type from extension
     * @param {string} extension - File extension
     * @returns {string} MIME type
     */
    static getMimeType(extension) {
        const mimeTypes = {
            'txt': 'text/plain',
            'md': 'text/markdown',
            'html': 'text/html',
            'htm': 'text/html',
            'json': 'application/json',
            'csv': 'text/csv',
            'pdf': 'application/pdf',
            'jpg': 'image/jpeg',
            'jpeg': 'image/jpeg',
            'png': 'image/png',
            'gif': 'image/gif',
            'webp': 'image/webp',
            'svg': 'image/svg+xml'
        };
        
        return mimeTypes[extension.toLowerCase()] || 'application/octet-stream';
    }
    
    /**
     * Generate random color
     * @returns {string} Hex color code
     */
    static generateRandomColor() {
        const letters = '0123456789ABCDEF';
        let color = '#';
        for (let i = 0; i < 6; i++) {
            color += letters[Math.floor(Math.random() * 16)];
        }
        return color;
    }
    
    /**
     * Generate avatar initials
     * @param {string} name - Name to generate initials from
     * @returns {string} Initials
     */
    static generateInitials(name) {
        if (!name) return '?';
        
        const parts = name.split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
        }
        
        return name.substring(0, 2).toUpperCase();
    }
    
    /**
     * Deep clone object
     * @param {Object} obj - Object to clone
     * @returns {Object} Cloned object
     */
    static deepClone(obj) {
        if (obj === null || typeof obj !== 'object') return obj;
        if (obj instanceof Date) return new Date(obj);
        if (obj instanceof Array) return obj.map(item => this.deepClone(item));
        if (typeof obj === 'object') {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
        return obj;
    }
    
    /**
     * Merge objects deeply
     * @param {Object} target - Target object
     * @param {Object} source - Source object
     * @returns {Object} Merged object
     */
    static deepMerge(target, source) {
        const output = this.deepClone(target);
        
        if (this.isObject(target) && this.isObject(source)) {
            Object.keys(source).forEach(key => {
                if (this.isObject(source[key])) {
                    if (!(key in target)) {
                        Object.assign(output, { [key]: source[key] });
                    } else {
                        output[key] = this.deepMerge(target[key], source[key]);
                    }
                } else {
                    Object.assign(output, { [key]: source[key] });
                }
            });
        }
        
        return output;
    }
    
    /**
     * Check if value is an object
     * @param {*} value - Value to check
     * @returns {boolean} Whether value is an object
     */
    static isObject(value) {
        return value && typeof value === 'object' && !Array.isArray(value);
    }
    
    /**
     * Get query parameter from URL
     * @param {string} name - Parameter name
     * @returns {string|null} Parameter value
     */
    static getQueryParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    }
    
    /**
     * Set query parameter in URL
     * @param {string} name - Parameter name
     * @param {string} value - Parameter value
     */
    static setQueryParam(name, value) {
        const url = new URL(window.location);
        url.searchParams.set(name, value);
        window.history.pushState({}, '', url);
    }
    
    /**
     * Remove query parameter from URL
     * @param {string} name - Parameter name
     */
    static removeQueryParam(name) {
        const url = new URL(window.location);
        url.searchParams.delete(name);
        window.history.pushState({}, '', url);
    }
    
    /**
     * Check if device is mobile
     * @returns {boolean} Whether device is mobile
     */
    static isMobile() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
               window.innerWidth <= 768;
    }
    
    /**
     * Check if device is touch capable
     * @returns {boolean} Whether device is touch capable
     */
    static isTouchDevice() {
        return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    }
    
    /**
     * Format number with commas
     * @param {number} number - Number to format
     * @returns {string} Formatted number
     */
    static formatNumber(number) {
        return number.toLocaleString();
    }
    
    /**
     * Sleep for specified time
     * @param {number} ms - Time to sleep in milliseconds
     * @returns {Promise<void>}
     */
    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Retry async function with exponential backoff
     * @param {Function} fn - Async function to retry
     * @param {number} maxRetries - Maximum retries
     * @param {number} initialDelay - Initial delay in milliseconds
     * @returns {Promise<any>} Function result
     */
    static async retry(fn, maxRetries = 3, initialDelay = 1000) {
        let lastError;
        
        for (let i = 0; i < maxRetries; i++) {
            try {
                return await fn();
            } catch (error) {
                lastError = error;
                if (i < maxRetries - 1) {
                    const delay = initialDelay * Math.pow(2, i);
                    await this.sleep(delay);
                }
            }
        }
        
        throw lastError;
    }
    
    /**
     * Measure execution time of function
     * @param {Function} fn - Function to measure
     * @param {string} label - Measurement label
     * @returns {Promise<any>} Function result
     */
    static async measureTime(fn, label = 'Execution') {
        const start = performance.now();
        const result = await fn();
        const end = performance.now();
        console.debug(`${label} took ${(end - start).toFixed(2)}ms`);
        return result;
    }
    
    /**
     * Create a UUID v4
     * @returns {string} UUID
     */
    static uuidv4() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    }
    
    /**
     * Hash string
     * @param {string} str - String to hash
     * @returns {string} Hash
     */
    static hashString(str) {
        let hash = 0;
        for (let i = 0; i < str.length; i++) {
            const char = str.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return Math.abs(hash).toString(16);
    }
    
    /**
     * Get browser information
     * @returns {Object} Browser info
     */
    static getBrowserInfo() {
        const ua = navigator.userAgent;
        let browser = 'Unknown';
        let version = 'Unknown';
        
        // Detect Chrome
        if (ua.indexOf('Chrome') > -1 && ua.indexOf('Edge') === -1) {
            browser = 'Chrome';
            const match = ua.match(/Chrome\/(\d+)/);
            version = match ? match[1] : 'Unknown';
        }
        // Detect Firefox
        else if (ua.indexOf('Firefox') > -1) {
            browser = 'Firefox';
            const match = ua.match(/Firefox\/(\d+)/);
            version = match ? match[1] : 'Unknown';
        }
        // Detect Safari
        else if (ua.indexOf('Safari') > -1 && ua.indexOf('Chrome') === -1) {
            browser = 'Safari';
            const match = ua.match(/Version\/(\d+)/);
            version = match ? match[1] : 'Unknown';
        }
        // Detect Edge
        else if (ua.indexOf('Edge') > -1) {
            browser = 'Edge';
            const match = ua.match(/Edge\/(\d+)/);
            version = match ? match[1] : 'Unknown';
        }
        
        return {
            browser,
            version,
            userAgent: ua,
            language: navigator.language,
            platform: navigator.platform,
            isOnline: navigator.onLine,
            cookieEnabled: navigator.cookieEnabled
        };
    }
    
    /**
     * Detect dark mode preference
     * @returns {boolean} Whether dark mode is preferred
     */
    static prefersDarkMode() {
        return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    
    /**
     * Register service worker
     * @param {string} path - Service worker path
     * @returns {Promise<ServiceWorkerRegistration>}
     */
    static async registerServiceWorker(path = '/service-worker.js') {
        if ('serviceWorker' in navigator) {
            try {
                return await navigator.serviceWorker.register(path);
            } catch (error) {
                console.error('Service worker registration failed:', error);
                throw error;
            }
        }
        throw new Error('Service workers are not supported');
    }
    
    /**
     * Create download link for file
     * @param {string} content - File content
     * @param {string} filename - Filename
     * @param {string} type - MIME type
     */
    static downloadFile(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
    
    /**
     * Parse CSV string
     * @param {string} csv - CSV string
     * @param {string} delimiter - Delimiter
     * @returns {Array<Array<string>>} Parsed CSV data
     */
    static parseCSV(csv, delimiter = ',') {
        const lines = csv.split('\n');
        return lines.map(line => line.split(delimiter).map(cell => cell.trim()));
    }
    
    /**
     * Stringify data to CSV
     * @param {Array<Array<string>>} data - Data to stringify
     * @param {string} delimiter - Delimiter
     * @returns {string} CSV string
     */
    static stringifyToCSV(data, delimiter = ',') {
        return data.map(row => row.join(delimiter)).join('\n');
    }
    
    /**
     * Check if storage is available
     * @param {string} type - Storage type ('localStorage' or 'sessionStorage')
     * @returns {boolean} Whether storage is available
     */
    static isStorageAvailable(type = 'localStorage') {
        try {
            const storage = window[type];
            const x = '__storage_test__';
            storage.setItem(x, x);
            storage.removeItem(x);
            return true;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Get storage with namespace
     * @param {string} namespace - Storage namespace
     * @param {string} type - Storage type
     * @returns {Object} Storage interface
     */
    static getNamespacedStorage(namespace, type = 'localStorage') {
        if (!this.isStorageAvailable(type)) {
            console.warn(`${type} is not available`);
            return {
                getItem: () => null,
                setItem: () => {},
                removeItem: () => {},
                clear: () => {}
            };
        }
        
        const storage = window[type];
        const prefix = `${namespace}:`;
        
        return {
            getItem: (key) => {
                return storage.getItem(prefix + key);
            },
            setItem: (key, value) => {
                storage.setItem(prefix + key, value);
            },
            removeItem: (key) => {
                storage.removeItem(prefix + key);
            },
            clear: () => {
                const keys = [];
                for (let i = 0; i < storage.length; i++) {
                    const key = storage.key(i);
                    if (key.startsWith(prefix)) {
                        keys.push(key);
                    }
                }
                keys.forEach(key => storage.removeItem(key));
            }
        };
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ChatUtils;
} else {
    // Make available globally
    window.ChatUtils = ChatUtils;
    
    // Add global helper functions
    window.$utils = ChatUtils;
}