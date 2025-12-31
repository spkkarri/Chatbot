// Debounce function: Limits the rate at which a function can fire.
import { marked } from 'marked';

export const getPlainTextFromMarkdown = (markdown) => {
  if (!markdown) return '';
  try {
    const html = marked.parse(markdown);
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = html;
    // .textContent correctly extracts text and preserves line breaks from block elements
    return tempDiv.textContent || '';
  } catch (error) {
    console.error("Error converting markdown to plain text:", error);
    return markdown; // Fallback to raw markdown on error
  }
};


export const debounce = (func, delay) => {
    let timeoutId;
    return function(...args) {
        const context = this;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func.apply(context, args), delay);
    };
};

// Throttle function: Ensures a function is called at most once in a specified time period.
export const throttle = (func, limit) => {
    let inThrottle;
    let lastFunc;
    let lastRan;
    return function(...args) {
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            lastRan = Date.now();
            inThrottle = true;
            setTimeout(() => {
                inThrottle = false;
                if (lastFunc) {
                    lastFunc.apply(context, args); // Call with latest args if throttled
                    lastRan = Date.now();
                }
            }, limit);
        } else {
            lastFunc = func; // Store the latest call
        }
    };
};

// Simple function to format file size
export const formatFileSize = (bytes, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

// Function to generate a simple unique ID (for client-side list keys, etc.)
export const generateUniqueId = (prefix = 'id') => {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

// Function to safely get nested property
export const getNestedValue = (obj, path, defaultValue = undefined) => {
    const value = path.split('.').reduce((acc, part) => acc && acc[part], obj);
    return value === undefined ? defaultValue : value;
};

// Basic HTML escape (can be more comprehensive)
export const escapeHtml = (unsafe) => {
    if (typeof unsafe !== 'string') return '';
    return unsafe
         .replace(/&/g, "&")
         .replace(/</g, "<")
         .replace(/>/g, ">")
         .replace(/"/g, `"`)
         .replace(/'/g, "'");
};

// You can add more utility functions here as your project grows.
// For example, date formatting, string manipulation, etc.

// Example: Truncate text
export const truncateText = (text, maxLength = 100) => {
    if (!text || text.length <= maxLength) return text;
    return text.substring(0, maxLength) + '...';
};

// Function to copy text to the clipboard with a fallback for insecure contexts.
export const copyToClipboard = async (text) => {
  // Use modern clipboard API if available and in a secure context (HTTPS/localhost)
  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (err) {
      console.error('Async clipboard write failed:', err);
      // Don't automatically fall back, as this could be a permissions error.
      // The primary reason for the fallback is the API not being available at all.
      return false; 
    }
  }

  // Fallback for insecure contexts (e.g., HTTP over LAN) or older browsers
  console.warn('Using legacy document.execCommand for copy.');
  const textArea = document.createElement("textarea");
  textArea.value = text;

  // Make the textarea invisible and prevent screen from scrolling
  textArea.style.position = 'fixed';
  textArea.style.top = '-9999px';
  textArea.style.left = '-9999px';

  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();

  let success = false;
  try {
    // execCommand is deprecated but has widespread support.
    success = document.execCommand('copy');
  } catch (err) {
    console.error('Legacy clipboard copy failed:', err);
  }

  document.body.removeChild(textArea);
  return success;
};