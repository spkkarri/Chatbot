// script.js - Frontend Logic for Local AI Tutor

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM ready.");

    // --- Configuration ---
    const API_BASE_URL = window.location.origin;
    const STATUS_CHECK_INTERVAL = 10000; // Check backend status every 10 seconds
    const ERROR_MESSAGE_DURATION = 8000; // Auto-hide error messages (ms)
    const MAX_CHAT_HISTORY_MESSAGES = 100; // Limit displayed messages (optional)

    // --- DOM Elements ---
    const uploadInput = document.getElementById('pdf-upload');
    const uploadButton = document.getElementById('upload-button');
    const uploadStatus = document.getElementById('upload-status');
    const uploadSpinner = uploadButton?.querySelector('.spinner-border');

    const analysisFileSelect = document.getElementById('analysis-file-select');
    const analysisButtons = document.querySelectorAll('.analysis-btn');
    const analysisOutputContainer = document.getElementById('analysis-output-container');
    const analysisOutput = document.getElementById('analysis-output');
    const analysisOutputTitle = document.getElementById('analysis-output-title');
    const analysisStatus = document.getElementById('analysis-status');
    // --- MODIFIED: Get references to new reasoning elements ---
    const analysisReasoningContainer = document.getElementById('analysis-reasoning-container');
    const analysisReasoningOutput = document.getElementById('analysis-reasoning-output');
    // --- END MODIFICATION ---

    const mindmapContainer = document.getElementById('mindmap-container');
    const mindmapSvg = document.getElementById('mindmap-svg');

    const chatHistory = document.getElementById('chat-history');
    const chatInput = document.getElementById('chat-input');
    const sendButton = document.getElementById('send-button');
    const sendSpinner = sendButton?.querySelector('.spinner-border');
    const voiceInputButton = document.getElementById('voice-input-button');
    const chatStatus = document.getElementById('chat-status'); // Element reference for chat status text

    const statusMessage = document.getElementById('status-message');
    const statusMessageButton = statusMessage?.querySelector('.btn-close'); // Get close button inside
    const connectionStatus = document.getElementById('connection-status');
    const sessionIdDisplay = document.getElementById('session-id-display');

    // --- State ---
    let sessionId = localStorage.getItem('aiTutorSessionId') || null;
    let currentMarkmapInstance = null;
    let currentMarkmapToolbar = null;
    let allFiles = { default: [], uploaded: [] };
    let backendStatus = { // Detailed status object
        db: false,
        ai: false,
        vectorStore: false,
        vectorCount: 0,
        error: null
    };
    let isListening = false;
    let statusCheckTimer = null;
    let statusMessageTimerId = null; // Timer for auto-hiding status messages

    // --- Web Speech API ---
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    let recognition = null;

    if (SpeechRecognition) {
        try {
            recognition = new SpeechRecognition();
            recognition.continuous = false; // Stop after first utterance
            recognition.lang = 'en-US';
            recognition.interimResults = false;
            recognition.maxAlternatives = 1;

            recognition.onresult = (event) => {
                const transcript = event.results[0][0].transcript;
                chatInput.value = transcript;
                stopListeningUI();
                // Automatically send after successful recognition
                 handleSendMessage();
            };
            recognition.onerror = (event) => {
                console.error('Speech recognition error:', event.error, event.message);
                setChatStatus(`Speech error: ${event.error}`, 'warning'); // Use the new function
                stopListeningUI();
            };
            recognition.onend = () => {
                // Only update UI if it was actively listening and didn't stop due to result/error already
                if (isListening) stopListeningUI();
            };
            // Initial state is disabled, enable later based on backend status
        } catch (e) {
             console.error("Error initializing SpeechRecognition:", e);
             recognition = null;
             if (voiceInputButton) voiceInputButton.title = "Voice input failed to initialize";
        }
    } else {
        console.warn("Speech Recognition not supported by this browser.");
        if (voiceInputButton) voiceInputButton.title = "Voice input not supported by browser";
    }


    // --- Initialization ---
    function initializeApp() {
        console.log("Initializing App...");
        showInitialLoading();
        setupEventListeners();
        checkBackendStatus(true); // Initial check, forces UI update
        // Start periodic checks
        if (statusCheckTimer) clearInterval(statusCheckTimer);
        statusCheckTimer = setInterval(() => checkBackendStatus(false), STATUS_CHECK_INTERVAL);
    }

    function showInitialLoading() {
        clearChatHistory();
        addMessageToChat('bot', "Connecting to AI Tutor backend...", [], null, 'loading-msg');
        setConnectionStatus('Initializing...', 'secondary');
        updateControlStates(); // Disable controls initially
    }

    function onBackendReady() {
         console.log("Backend is ready.");
         loadAndPopulateDocuments(); // Load file lists

         if (sessionId) {
             console.log("Existing session ID found:", sessionId);
             setSessionIdDisplay(sessionId);
             loadChatHistory(sessionId);
         } else {
             console.log("No session ID found. Will generate on first message.");
             clearChatHistory(); // Ensure chat is clear
             addMessageToChat('bot', "Welcome! Ask questions about the documents, or upload your own using the controls.");
             setSessionIdDisplay(null);
         }
         // Enable controls now backend is confirmed ready
         updateControlStates();
    }

     function onBackendUnavailable(errorMsg = "Backend connection failed.") {
         console.error("Backend is unavailable:", errorMsg);
         clearChatHistory();
         addMessageToChat('bot', `Error: ${errorMsg} Please check the server logs and ensure Ollama is running. Features will be limited.`);
         updateControlStates(); // Ensure controls are disabled
     }

    // Updates button/input enabled states based on backend status
    function updateControlStates() {
        const isDbReady = backendStatus.db;
        const isAiReady = backendStatus.ai;
        // Upload needs AI for processing
        const canUpload = isAiReady;
        // Analysis selection needs files (implies DB ok), execution needs AI
        const canSelectAnalysis = isDbReady && (allFiles.default.length > 0 || allFiles.uploaded.length > 0);
        const canExecuteAnalysis = isAiReady && analysisFileSelect && analysisFileSelect.value;
        // Chat needs AI
        const canChat = isAiReady;

        // Chat Input
        disableChatInput(!canChat);

        // Upload Button
        if (uploadButton) uploadButton.disabled = !(canUpload && uploadInput?.files?.length > 0);

        // Analysis Select & Buttons
        if (analysisFileSelect) analysisFileSelect.disabled = !canSelectAnalysis;
        disableAnalysisButtons(!canExecuteAnalysis);

        // Voice Button
        if (voiceInputButton) {
            voiceInputButton.disabled = !(canChat && recognition); // Enable only if chat & voice API ready
            voiceInputButton.title = (canChat && recognition) ? "Start Voice Input" : (recognition ? "Chat disabled" : "Voice input not supported/initialized");
        }

        // Update status texts using the correct functions
        setChatStatus(canChat ? "Ready" : (isDbReady ? "AI Offline" : "Backend Offline"), canChat ? 'muted' : 'warning'); // <<< CORRECTED: Uses setChatStatus
        if (uploadStatus) setElementStatus(uploadStatus, canUpload ? "Select a PDF to upload." : (isDbReady ? "AI Offline" : "Backend Offline"), canUpload ? 'muted' : 'warning');
        if (analysisStatus) {
             if (!canSelectAnalysis) setElementStatus(analysisStatus, "Backend Offline or No Docs", 'warning');
             else if (!analysisFileSelect?.value) setElementStatus(analysisStatus, "Select document & analysis type.", 'muted');
             else if (!isAiReady) setElementStatus(analysisStatus, "AI Offline", 'warning');
             else setElementStatus(analysisStatus, `Ready to analyze ${escapeHtml(analysisFileSelect.value)}.`, 'muted');
        }
    }

    function setupEventListeners() {
        if (uploadButton) uploadButton.addEventListener('click', handleUpload);
        analysisButtons.forEach(button => button?.addEventListener('click', () => handleAnalysis(button.dataset.analysisType)));
        if (sendButton) sendButton.addEventListener('click', handleSendMessage);
        if (chatInput) chatInput.addEventListener('keypress', (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (!sendButton?.disabled) handleSendMessage(); } });
        if (recognition && voiceInputButton) voiceInputButton.addEventListener('click', toggleListening);
        if (analysisFileSelect) analysisFileSelect.addEventListener('change', handleAnalysisFileSelection); // Keep this listener
        if (uploadInput) uploadInput.addEventListener('change', handleFileInputChange);
        if (statusMessageButton) statusMessageButton.addEventListener('click', () => clearTimeout(statusMessageTimerId)); // Clear timer on manual close

        console.log("Event listeners setup.");
    }

    // --- Backend Status Check ---
    async function checkBackendStatus(isInitialCheck = false) {
        if (!connectionStatus || !API_BASE_URL) return;

        const previousStatus = { ...backendStatus }; // Shallow copy

        try {
            const response = await fetch(`${API_BASE_URL}/status?t=${Date.now()}`); // Prevent caching
            const data = await response.json();

            if (!response.ok) throw new Error(data.error || `Status check failed: ${response.status}`);

            // Update state
            backendStatus.db = data.database_initialized;
            backendStatus.ai = data.ai_components_loaded;
            backendStatus.vectorStore = data.vector_store_loaded;
            backendStatus.vectorCount = data.vector_store_entries || 0;
            backendStatus.error = null; // Clear previous error on success

            // Update UI only on initial check or if status *changed*
            const statusChanged = JSON.stringify(backendStatus) !== JSON.stringify(previousStatus);

            if (isInitialCheck || statusChanged) {
                console.log("Status changed or initial check:", data);
                updateConnectionStatusUI(); // Update badge and potentially show/hide messages

                if (isInitialCheck) {
                    if (backendStatus.db) onBackendReady(); // DB is minimum requirement to start
                    else onBackendUnavailable("Database initialization failed.");
                } else {
                    // If status recovered, hide persistent error messages
                    if ((backendStatus.db && !previousStatus.db) || (backendStatus.ai && !previousStatus.ai)) {
                         hideStatusMessage();
                    }
                    // If AI came back online, refresh docs in case they loaded while AI was down
                    if (backendStatus.ai && !previousStatus.ai) {
                        loadAndPopulateDocuments();
                    }
                }
                updateControlStates(); // Refresh controls based on new status
            }

        } catch (error) {
            console.error("Backend connection check failed:", error);
            const errorMsg = `Backend connection error: ${error.message || 'Unknown reason'}.`;
            // Only update state/UI if status changed to offline or on initial check
            if (backendStatus.db || backendStatus.ai || isInitialCheck) {
                 backendStatus.db = false;
                 backendStatus.ai = false;
                 backendStatus.vectorStore = false;
                 backendStatus.vectorCount = 0;
                 backendStatus.error = errorMsg;

                 updateConnectionStatusUI(); // Show error state

                 if (isInitialCheck) onBackendUnavailable(errorMsg);
                 updateControlStates(); // Disable controls
            }
        }
    }

    // --- UI Update Helpers ---

    function updateConnectionStatusUI() {
         if (!connectionStatus) return;
         let statusText = 'Unknown';
         let statusType = 'secondary';
         let persistentMessage = null;
         let messageType = 'danger';

         if (backendStatus.ai) { // AI ready implies DB ok
             const vectorText = backendStatus.vectorStore ? `(${backendStatus.vectorCount} vectors)` : '(Index Error)';
             statusText = `Ready ${vectorText}`;
             statusType = 'success';
             if (!backendStatus.vectorStore) { // AI ok, but index failed to load
                 persistentMessage = "AI Ready, but Vector Store failed to load. RAG context unavailable.";
                 messageType = 'warning';
             }
         } else if (backendStatus.db) { // DB ok, but AI failed
             statusText = 'AI Offline';
             statusType = 'warning';
             persistentMessage = "Backend running, but AI components failed. Chat/Analysis/Upload unavailable.";
             messageType = 'warning';
         } else { // DB failed (critical)
             statusText = 'Backend Offline';
             statusType = 'danger';
             persistentMessage = backendStatus.error || "Cannot connect to backend or database failed. Check server.";
             messageType = 'danger';
         }

         setConnectionStatus(statusText, statusType);
         if(persistentMessage) {
             showStatusMessage(persistentMessage, messageType, 0); // Show persistent message (duration 0)
         } else {
             // If status recovered, ensure persistent message is hidden
             // Check if the current message is persistent (no timerId) and not hidden
             if (statusMessage?.style.display !== 'none' && !statusMessageTimerId) {
                  hideStatusMessage();
             }
         }
    }

    function setConnectionStatus(text, type = 'info') {
         if (!connectionStatus) return;
         connectionStatus.textContent = text;
         connectionStatus.className = `badge bg-${type}`; // Base classes
    }

    function showStatusMessage(message, type = 'info', duration = ERROR_MESSAGE_DURATION) {
        if (!statusMessage) return;
        // Sanitize message before inserting? Basic escape for now.
        statusMessage.childNodes[0].nodeValue = message; // Set text node content directly
        statusMessage.className = `alert alert-${type} alert-dismissible fade show ms-3`; // Reset classes
        statusMessage.style.display = 'block';

        // Clear existing timer
        if (statusMessageTimerId) clearTimeout(statusMessageTimerId);
        statusMessageTimerId = null; // Reset timer ID

        if (duration > 0) {
            statusMessageTimerId = setTimeout(() => {
                const bsAlert = bootstrap.Alert.getInstance(statusMessage);
                if (bsAlert) bsAlert.close();
                else statusMessage.style.display = 'none'; // Fallback hide
                statusMessageTimerId = null; // Clear timer ID after execution
            }, duration);
        }
        // If duration is 0 or less, it persists (timerId remains null)
    }

    function hideStatusMessage() {
        if (!statusMessage) return;
        const bsAlert = bootstrap.Alert.getInstance(statusMessage);
        if (bsAlert) bsAlert.close();
        else statusMessage.style.display = 'none';
        if (statusMessageTimerId) clearTimeout(statusMessageTimerId);
        statusMessageTimerId = null;
    }

    function setChatStatus(message, type = 'muted') {
        if (!chatStatus) return; // Check if the element exists
        chatStatus.textContent = message;
        // Keep the base classes and add the type class
        chatStatus.className = `mb-1 small text-center text-${type}`;
    }

    function setElementStatus(element, message, type = 'muted') {
        if (!element) return;
        element.textContent = message;
        element.className = `small text-${type}`; // Keep small, set text color class
    }

    function setSessionIdDisplay(sid) {
        if (sessionIdDisplay) {
            sessionIdDisplay.textContent = sid ? `Session: ${sid.substring(0, 8)}...` : '';
        }
    }

    function clearChatHistory() {
        if (chatHistory) chatHistory.innerHTML = '';
    }

    // Basic HTML escaping
     function escapeHtml(unsafe) {
         if (typeof unsafe !== 'string') {
             if (unsafe === null || typeof unsafe === 'undefined') return '';
             try { unsafe = String(unsafe); } catch (e) { return ''; }
         }
         return unsafe
              .replace(/&/g, "&amp;")
              .replace(/</g, "&lt;")
              .replace(/>/g, "&gt;")
              .replace(/"/g, "&quot;") // Use proper HTML entity
              .replace(/'/g, "&#39;");
      }

    function addMessageToChat(sender, text, references = [], thinking = null, messageId = null) {
        if (!chatHistory) return;

        // Optional: Limit number of messages displayed
        while (chatHistory.children.length >= MAX_CHAT_HISTORY_MESSAGES) {
            chatHistory.removeChild(chatHistory.firstChild);
        }

        const messageWrapper = document.createElement('div');
        messageWrapper.classList.add('message-wrapper', `${sender}-wrapper`);
        if(messageId) messageWrapper.dataset.messageId = messageId;

        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', sender === 'user' ? 'user-message' : 'bot-message');

        // Render Markdown for bot messages, escape user messages
        if (sender === 'bot' && text) {
            try {
                if (typeof marked === 'undefined') {
                    console.warn("marked.js not loaded. Displaying raw text.");
                    const pre = document.createElement('pre');
                    pre.textContent = text;
                    messageDiv.appendChild(pre); // Wrap in pre for basic formatting
                } else {
                    marked.setOptions({ breaks: true, gfm: true, sanitize: false }); // sanitize: false - BE CAREFUL
                    // --- SECURITY WARNING ---
                    // Setting sanitize: false is dangerous if the LLM can be prompted
                    // to produce malicious HTML/JS. For a truly secure application,
                    // use a sanitizer like DOMPurify after marked.parse().
                    // Example:
                    // const unsafeHtml = marked.parse(text);
                    // const safeHtml = (typeof DOMPurify !== 'undefined') ? DOMPurify.sanitize(unsafeHtml) : unsafeHtml;
                    // messageDiv.innerHTML = safeHtml;
                    // For this local setup, we accept the risk for better rendering.
                    messageDiv.innerHTML = marked.parse(text);
                }
            } catch (e) {
                console.error("Error rendering Markdown:", e);
                const pre = document.createElement('pre');
                pre.textContent = text; // Fallback to preformatted text
                messageDiv.appendChild(pre);
            }
        } else if (text) {
            messageDiv.textContent = text; // User message - escape handled by textContent
        } else {
            messageDiv.textContent = `[${sender === 'bot' ? 'Empty Bot Response' : 'Empty User Message'}]`;
        }

        messageWrapper.appendChild(messageDiv);

        // Display Thinking/Reasoning (CoT) - Create dynamically
        if (sender === 'bot' && thinking) {
            const thinkingDiv = document.createElement('div');
            thinkingDiv.classList.add('message-thinking');
            thinkingDiv.innerHTML = `
                <details>
                    <summary class="text-info small fw-bold">Show Reasoning</summary>
                    <pre><code>${escapeHtml(thinking)}</code></pre>
                </details>`;
            messageWrapper.appendChild(thinkingDiv);
        }

        // Display References - Create dynamically
        if (sender === 'bot' && references && references.length > 0) {
            const referencesDiv = document.createElement('div');
            referencesDiv.classList.add('message-references');
            let refHtml = '<strong class="small text-warning">References:</strong><ul class="list-unstyled mb-0 small">';
            references.forEach(ref => {
                // Check if ref is valid object with expected properties
                if (ref && typeof ref === 'object') {
                    const source = escapeHtml(ref.source || 'Unknown Source');
                    const preview = escapeHtml(ref.content_preview || 'No preview available');
                    const number = escapeHtml(ref.number || '?');
                    refHtml += `<li class="ref-item">[${number}] <span class="ref-source" title="Preview: ${preview}">${source}</span></li>`;
                } else {
                    console.warn("Invalid reference item found:", ref);
                }
            });
            refHtml += '</ul>';
            referencesDiv.innerHTML = refHtml;
            messageWrapper.appendChild(referencesDiv);
        }

        chatHistory.appendChild(messageWrapper);
        // Scroll to bottom smoothly
        chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'smooth' });
    }

    function updateAnalysisDropdown() {
        if (!analysisFileSelect) return;
        const previouslySelected = analysisFileSelect.value;
        analysisFileSelect.innerHTML = ''; // Clear

        const createOption = (filename, isUploaded = false) => {
            const option = document.createElement('option');
            option.value = filename; // Use filename as value
            option.textContent = filename;
            option.classList.add('file-option');
            if (isUploaded) option.classList.add('uploaded');
            return option;
        };

        const hasFiles = allFiles.default.length > 0 || allFiles.uploaded.length > 0;

        // Add placeholder
        const placeholder = document.createElement('option');
        placeholder.textContent = hasFiles ? "Select a document..." : "No documents available";
        placeholder.disabled = true;
        placeholder.selected = !previouslySelected || !hasFiles; // Select placeholder if nothing was selected before OR no files
        placeholder.value = "";
        analysisFileSelect.appendChild(placeholder);

        if (!hasFiles) {
            analysisFileSelect.disabled = true;
            disableAnalysisButtons(true);
            return; // Nothing more to add
        }

        // Add Optgroups and Options
        if (allFiles.default.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = "Default Documents";
            allFiles.default.forEach(f => optgroup.appendChild(createOption(f, false)));
            analysisFileSelect.appendChild(optgroup);
        }
        if (allFiles.uploaded.length > 0) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = "Uploaded Documents";
            allFiles.uploaded.forEach(f => optgroup.appendChild(createOption(f, true)));
            analysisFileSelect.appendChild(optgroup);
        }

        analysisFileSelect.disabled = !backendStatus.db; // Enable select if DB ready

        // Restore selection if possible and the option still exists
        const previousOptionExists = Array.from(analysisFileSelect.options).some(opt => opt.value === previouslySelected);
        if (previouslySelected && previousOptionExists) {
            analysisFileSelect.value = previouslySelected;
        } else {
            // If previous selection gone or wasn't set, reset to placeholder
             analysisFileSelect.value = "";
        }

        // Enable/disable buttons based on current selection and AI status
        handleAnalysisFileSelection();
    }

    function handleAnalysisFileSelection() {
        const fileSelected = analysisFileSelect && analysisFileSelect.value;
        const shouldEnable = fileSelected && backendStatus.ai;
        disableAnalysisButtons(!shouldEnable);
         if (!fileSelected) {
             setElementStatus(analysisStatus, "Select document & analysis type.", 'muted');
         } else if (!backendStatus.ai) {
             setElementStatus(analysisStatus, "AI components offline.", 'warning');
         } else {
             setElementStatus(analysisStatus, `Ready to analyze ${escapeHtml(analysisFileSelect.value)}.`, 'muted');
         }
         // Hide previous results when selection changes
         if (analysisOutputContainer) analysisOutputContainer.style.display = 'none';
         if (mindmapContainer) mindmapContainer.style.display = 'none';
         if (analysisReasoningContainer) analysisReasoningContainer.style.display = 'none';
    }

     function handleFileInputChange() {
         const canUpload = backendStatus.ai;
         if (uploadButton) uploadButton.disabled = !(uploadInput.files.length > 0 && canUpload);
         if (uploadInput.files.length > 0) {
              setElementStatus(uploadStatus, `Selected: ${escapeHtml(uploadInput.files[0].name)}`, 'muted');
         } else {
              setElementStatus(uploadStatus, canUpload ? 'No file selected.' : 'AI Offline', canUpload ? 'muted' : 'warning');
         }
     }

    function disableAnalysisButtons(disabled = true) {
        analysisButtons.forEach(button => button && (button.disabled = disabled));
    }

    function disableChatInput(disabled = true) {
        if (chatInput) chatInput.disabled = disabled;
        if (sendButton) sendButton.disabled = disabled;
        // Disable voice based on chat state AND recognition availability
        if (voiceInputButton) voiceInputButton.disabled = disabled || !recognition;
    }

    function showSpinner(spinnerElement, show = true) {
         if (spinnerElement) spinnerElement.style.display = show ? 'inline-block' : 'none';
    }

    // --- API Calls ---

    async function loadAndPopulateDocuments() {
        if (!API_BASE_URL || !analysisFileSelect) return;
        console.log("Loading document list...");
        analysisFileSelect.disabled = true;
        analysisFileSelect.innerHTML = '<option selected disabled value="">Loading...</option>';

        try {
            const response = await fetch(`${API_BASE_URL}/documents?t=${Date.now()}`);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            if(data.errors) {
                 console.warn("Errors loading document lists:", data.errors);
                 showStatusMessage(`Warning: Could not load some document lists: ${data.errors.join(', ')}`, 'warning');
            }
            allFiles.default = data.default_files || [];
            allFiles.uploaded = data.uploaded_files || [];
            console.log(`Loaded ${allFiles.default.length} default, ${allFiles.uploaded.length} uploaded docs.`);
            updateAnalysisDropdown(); // This now handles enabling/disabling based on files found

        } catch (error) {
            console.error("Error loading document list:", error);
            showStatusMessage("Could not load the list of available documents.", 'warning');
            analysisFileSelect.innerHTML = '<option selected disabled value="">Error loading</option>';
            disableAnalysisButtons(true);
        } finally {
            // Update controls based on whether files were loaded and AI status
            updateControlStates();
        }
    }

    async function handleUpload() {
        if (!uploadInput || !uploadStatus || !uploadButton || !uploadSpinner || !API_BASE_URL || !backendStatus.ai) return;
        const file = uploadInput.files[0];
        if (!file) { setElementStatus(uploadStatus, "Select a PDF first.", 'warning'); return; }
        if (!file.name.toLowerCase().endsWith(".pdf")) { setElementStatus(uploadStatus, "Invalid file: PDF only.", 'warning'); return; }

        setElementStatus(uploadStatus, `Uploading ${escapeHtml(file.name)}...`);
        uploadButton.disabled = true;
        showSpinner(uploadSpinner, true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/upload`, { method: 'POST', body: formData });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || `Upload failed: ${response.status}`);

            // Success
            const successMsg = result.message || `Processed ${escapeHtml(result.filename)}.`;
            setElementStatus(uploadStatus, successMsg, 'success');
            showStatusMessage(`File '${escapeHtml(result.filename)}' added. KB: ${result.vector_count >= 0 ? result.vector_count : 'N/A'} vectors.`, 'success');
            await loadAndPopulateDocuments(); // Refresh dropdown
            uploadInput.value = ''; // Clear file input on success
            handleFileInputChange(); // Update button state after clearing input

        } catch (error) {
            console.error("Upload error:", error);
            const errorMsg = error.message || "Unknown upload error.";
            setElementStatus(uploadStatus, `Error: ${errorMsg}`, 'danger');
            showStatusMessage(`Upload Error: ${errorMsg}`, 'danger');
             // Keep file selected in input for retry? Or clear? Current behavior keeps it.
             uploadButton.disabled = !backendStatus.ai; // Re-enable if AI still ok
        } finally {
             showSpinner(uploadSpinner, false);
             // Reset status after a delay?
             // setTimeout(() => handleFileInputChange(), 5000);
        }
    }

    // --- MODIFIED: handleAnalysis function ---
    async function handleAnalysis(analysisType) {
        // Ensure all required elements exist, including new reasoning ones
        if (!analysisFileSelect || !analysisStatus || !analysisOutputContainer || !analysisOutput || !mindmapContainer || !mindmapSvg || !analysisReasoningContainer || !analysisReasoningOutput || !API_BASE_URL || !backendStatus.ai) {
             console.error("Analysis prerequisites missing or AI offline.");
             return;
        }
        const filename = analysisFileSelect.value;
        if (!filename) { setElementStatus(analysisStatus, "Select a document.", 'warning'); return; }

        console.log(`Starting analysis: Type=${analysisType}, File=${filename}`);
        setElementStatus(analysisStatus, `Generating ${analysisType} for ${escapeHtml(filename)}...`);
        disableAnalysisButtons(true); // Disable buttons during analysis

        // Hide previous results and clear outputs
        analysisOutputContainer.style.display = 'none';
        mindmapContainer.style.display = 'none';
        analysisOutput.innerHTML = '';
        analysisReasoningOutput.textContent = ''; // Clear previous reasoning
        analysisReasoningContainer.style.display = 'none'; // Hide reasoning container

        // Check if DOM elements exist (for debugging)
        console.log("DOM Elements Check:", {
            analysisOutput, analysisReasoningOutput, analysisOutputContainer, analysisReasoningContainer, mindmapContainer, mindmapSvg
        });

        // Markmap Cleanup
        if (currentMarkmapToolbar?.el?.parentNode) currentMarkmapToolbar.el.parentNode.removeChild(currentMarkmapToolbar.el);
        if (currentMarkmapInstance && typeof currentMarkmapInstance.destroy === 'function') currentMarkmapInstance.destroy();
        else if(mindmapSvg) mindmapSvg.innerHTML = ''; // Manual clear fallback
        currentMarkmapInstance = null; currentMarkmapToolbar = null;

        try {
            const response = await fetch(`${API_BASE_URL}/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ filename, analysis_type: analysisType }),
            });

            console.log("Analysis Response Status:", response.status); // Log status

            const result = await response.json();
            console.log("Analysis Result Received (Parsed JSON):", result); // Log the parsed result

            if (!response.ok) throw new Error(result.error || `Analysis failed: ${response.status}`);

            // --- Success ---
            setElementStatus(analysisStatus, `Analysis complete for ${escapeHtml(filename)}.`, 'success');

            // Display Reasoning (if provided)
            console.log("Checking for thinking content:", result.thinking);
            if (result.thinking) {
                console.log("Analysis reasoning received. Assigning to DOM.");
                analysisReasoningOutput.textContent = result.thinking; // Use textContent for pre tag
                analysisReasoningContainer.style.display = 'block'; // Show reasoning container
                console.log("Reasoning container display set to block.");
            } else {
                 analysisReasoningContainer.style.display = 'none'; // Ensure hidden if no reasoning
                 console.log("No thinking content found or container hidden.");
            }

            // Display Main Content
            analysisOutputContainer.style.display = 'block'; // Show the main output container
            console.log("Analysis output container display set to block.");
            if (analysisOutputTitle) analysisOutputTitle.textContent = `${analysisType.charAt(0).toUpperCase() + analysisType.slice(1)} Analysis:`;

            const analysisContent = result.content || "[No content generated]";
            console.log("Analysis Main Content:", analysisContent); // Log the content itself

            // Render based on type
            mindmapContainer.style.display = 'none'; // Hide mindmap by default
            analysisOutput.innerHTML = ''; // Clear previous content

            if (analysisType === 'faq' || analysisType === 'topics') {
                if (typeof marked !== 'undefined') {
                    console.log("Rendering analysis content with marked.js...");
                    marked.setOptions({ breaks: true, gfm: true, sanitize: false }); // sanitize: false - BE CAREFUL
                    // See warning in addMessageToChat about sanitization
                    analysisOutput.innerHTML = marked.parse(analysisContent); // Use innerHTML for Markdown
                    console.log("Assigned marked content to analysisOutput.innerHTML");
                } else {
                    console.warn("marked.js not found. Using textContent.");
                    analysisOutput.textContent = analysisContent; // Fallback
                }
            }
            else if (analysisType === 'mindmap') {
                console.log("Processing mindmap analysis...");
                // Display raw markdown source in the main output area (optional, can be hidden)
                // Use escapeHtml ONLY for displaying the raw source safely
                analysisOutput.innerHTML = `<pre class="mindmap-markdown-source"><code>${escapeHtml(analysisContent)}</code></pre>`; // Show source safely
                console.log("Displayed raw mindmap source.");
                mindmapContainer.style.display = 'block'; // Show the SVG container
                console.log("Mindmap container display set to block.");
                try {
                    if (typeof window.markmap !== 'object' || !window.markmap.Markmap || !window.markmap.Toolbar || !window.d3 || !window.markmap.Transformer) {
                         throw new Error("Markmap library, D3, or Transformer not loaded.");
                    }
                    const { Markmap, Toolbar, Transformer } = window.markmap; // Get Transformer too

                     // Transform markdown to markmap data structure
                     const transformer = new Transformer();
                     // Handle potential errors during transformation
                     let root, features;
                     try {
                         console.log("Attempting to transform Markmap markdown...");
                         const transformed = transformer.transform(analysisContent); // Pass the raw analysisContent
                         root = transformed.root;
                         features = transformed.features;
                         if (!root) throw new Error("Transformation resulted in empty root node.");
                         console.log("Markmap transformation successful.");
                     } catch (transformError) {
                         console.error("Markmap transformation error:", transformError);
                         throw new Error(`Mindmap Markdown invalid: ${transformError.message}`);
                     }

                     mindmapSvg.innerHTML = ''; // Clear SVG before rendering
                     console.log("Attempting to create Markmap instance...");
                     currentMarkmapInstance = Markmap.create(mindmapSvg, null, root); // Pass root data
                     console.log("Markmap instance created.");

                     // Toolbar needs the Markmap *instance*
                     console.log("Attempting to create Markmap Toolbar...");
                     currentMarkmapToolbar = Toolbar.create(currentMarkmapInstance);
                     if (currentMarkmapToolbar?.el) {
                         mindmapContainer.insertBefore(currentMarkmapToolbar.el, mindmapSvg);
                         console.log("Markmap Toolbar created and inserted.");
                     } else {
                         console.warn("Failed to create Markmap Toolbar.");
                     }

                } catch (e) {
                     console.error("Error rendering Mind Map:", e);
                     setElementStatus(analysisStatus, "Analysis complete, Mind Map render failed.", 'warning');
                     mindmapContainer.style.display = 'none';
                     // Show error in main output area
                     analysisOutput.innerHTML = `<div class="text-danger">Error rendering Mind Map: ${escapeHtml(e.message)}</div><pre><code>${escapeHtml(analysisContent)}</code></pre>`;
                     showStatusMessage(`Mind Map Error: ${e.message}`, 'warning');
                }
            } else { // Default: plain text (shouldn't happen with current types)
                console.log("Rendering analysis content as plain text.");
                analysisOutput.textContent = analysisContent;
            }

        } catch (error) {
            console.error("Analysis error in JS:", error); // Log JS errors
            const errorMsg = error.message || "Unknown analysis error.";
            setElementStatus(analysisStatus, `Error: ${errorMsg}`, 'danger');
            showStatusMessage(`Analysis Error: ${errorMsg}`, 'danger');
            analysisOutputContainer.style.display = 'none'; // Hide output containers on error
            mindmapContainer.style.display = 'none';
            analysisReasoningContainer.style.display = 'none'; // Hide reasoning on error too
        } finally {
            // --- MODIFIED: Only re-enable buttons, don't call handleAnalysisFileSelection() ---
            const fileSelected = analysisFileSelect && analysisFileSelect.value;
            const shouldEnable = fileSelected && backendStatus.ai;
            disableAnalysisButtons(!shouldEnable); // Re-enable buttons if file still selected and AI is ready
            console.log("Analysis process finished. Buttons re-enabled based on state:", shouldEnable);
            // --- END MODIFICATION ---
        }
    }
    // --- END MODIFIED handleAnalysis function ---


    async function handleSendMessage() {
        if (!chatInput || !sendButton || !sendSpinner || !API_BASE_URL || !backendStatus.ai) return;
        const query = chatInput.value.trim();
        if (!query) return;

        addMessageToChat('user', query);
        chatInput.value = '';
        setChatStatus('AI Tutor is thinking...'); // Use the new function
        disableChatInput(true);
        showSpinner(sendSpinner, true);

        try {
            const response = await fetch(`${API_BASE_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: query, session_id: sessionId }),
            });
            const result = await response.json(); // Always try to parse JSON

            if (!response.ok) {
                 const errorDetail = result.error || `Request failed: ${response.status}`;
                 // Use answer field if provided by backend error, fallback to detail
                 const displayError = result.answer || `Sorry, error: ${errorDetail}`;
                 // Pass thinking and references even on error if backend provides them
                 addMessageToChat('bot', displayError, result.references || [], result.thinking || null);
                 throw new Error(errorDetail);
            }

            // Success
            if (result.session_id && sessionId !== result.session_id) {
                sessionId = result.session_id;
                localStorage.setItem('aiTutorSessionId', sessionId);
                setSessionIdDisplay(sessionId);
                console.log("Session ID updated:", sessionId);
            }
            // Pass all relevant fields to addMessageToChat
            addMessageToChat('bot', result.answer, result.references || [], result.thinking || null);
            setChatStatus('Ready'); // Use the new function

        } catch (error) {
            console.error("Chat error:", error);
            const errorMsg = error.message || "Unknown network/server error.";
             // Avoid adding a duplicate error message if already added by !response.ok block
             const lastBotMessage = chatHistory?.querySelector('.bot-wrapper:last-child .bot-message');
             if (!lastBotMessage || !lastBotMessage.textContent?.includes("Sorry, error:")) {
                  addMessageToChat('bot', `Sorry, could not get response: ${errorMsg}`);
             }
            setChatStatus(`Error: ${errorMsg.substring(0, 50)}...`, 'danger'); // Use the new function
        } finally {
            disableChatInput(!backendStatus.ai); // Re-enable based on AI status
            showSpinner(sendSpinner, false);
            if(backendStatus.ai && chatInput) chatInput.focus();
        }
    }

    async function loadChatHistory(sid) {
        if (!sid || !chatHistory || !API_BASE_URL || !backendStatus.db) {
             addMessageToChat('bot', 'Cannot load history: Missing session ID or database unavailable.');
             return;
        }

        setChatStatus('Loading history...'); // Use the new function
        disableChatInput(true);
        clearChatHistory();

        try {
            const response = await fetch(`${API_BASE_URL}/history?session_id=${sid}&t=${Date.now()}`);
             if (!response.ok) {
                 if (response.status === 404 || response.status === 400) {
                     console.warn(`History not found or invalid session ID (${sid}, Status: ${response.status}). Clearing local session.`);
                     localStorage.removeItem('aiTutorSessionId');
                     sessionId = null;
                     setSessionIdDisplay(null);
                     addMessageToChat('bot', "Couldn't load previous session. Starting fresh.");
                 } else {
                     const result = await response.json().catch(() => ({}));
                     throw new Error(result.error || `Failed to load history: ${response.status}`);
                 }
                 return; // Exit after handling non-ok response
             }

             const history = await response.json();
             if (history.length > 0) {
                 // Pass all fields from the history object
                 history.forEach(msg => addMessageToChat(
                     msg.sender,
                     msg.message_text,
                     msg.references || [], // Ensure references is an array
                     msg.thinking || null, // Pass thinking content
                     msg.message_id
                 ));
                 console.log(`Loaded ${history.length} messages for session ${sid}`);
                 addMessageToChat('bot', "--- Previous chat restored ---");
             } else {
                  addMessageToChat('bot', "Welcome back! Continue your chat.");
             }
             // Scroll after a short delay to allow rendering
             setTimeout(() => chatHistory.scrollTo({ top: chatHistory.scrollHeight, behavior: 'auto' }), 100);

        } catch (error) {
            console.error("Error loading chat history:", error);
             clearChatHistory();
             addMessageToChat('bot', `Error loading history: ${error.message}. Starting new chat.`);
             localStorage.removeItem('aiTutorSessionId');
             sessionId = null;
             setSessionIdDisplay(null);
        } finally {
            setChatStatus(backendStatus.ai ? 'Ready' : 'AI Offline', backendStatus.ai ? 'muted' : 'warning'); // Use the new function
            disableChatInput(!backendStatus.ai); // Re-enable based on AI status
        }
    }

    // --- Voice Input ---
    function toggleListening() {
        if (!recognition || !voiceInputButton || voiceInputButton.disabled) return;
        if (isListening) {
            recognition.stop();
            console.log("Speech recognition stopped manually.");
            // stopListeningUI() will be called by 'onend' event
        } else {
            try {
                recognition.start();
                startListeningUI();
                console.log("Speech recognition started.");
            } catch (error) {
                console.error("Error starting speech recognition:", error);
                setChatStatus("Voice input error. Check mic?", 'warning'); // Use the new function
                stopListeningUI(); // Reset UI if start fails
            }
        }
    }

    function startListeningUI() {
        isListening = true;
        if (voiceInputButton) {
            voiceInputButton.classList.add('listening', 'btn-danger');
            voiceInputButton.classList.remove('btn-outline-secondary');
            voiceInputButton.title = "Stop Listening";
            voiceInputButton.innerHTML = '🛑'; // Stop icon
        }
        setChatStatus('Listening...'); // Use the new function
    }

    function stopListeningUI() {
        isListening = false;
        if (voiceInputButton) {
            voiceInputButton.classList.remove('listening', 'btn-danger');
            voiceInputButton.classList.add('btn-outline-secondary');
            voiceInputButton.title = "Start Voice Input";
            voiceInputButton.innerHTML = '🎤'; // Mic icon
        }
        // Reset status only if it was 'Listening...'
        if (chatStatus && chatStatus.textContent === 'Listening...') {
             setChatStatus(backendStatus.ai ? 'Ready' : 'AI Offline', backendStatus.ai ? 'muted' : 'warning'); // Use the new function
        }
    }

    // --- Start ---
    initializeApp();

}); // End DOMContentLoaded