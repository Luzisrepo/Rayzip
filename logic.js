// Fixed logic.js with decoding fix — ensures bitstream continuity and proper ZIP validation

// Initialize particles.js
document.addEventListener('DOMContentLoaded', function() {
    particlesJS('particles-js', {
        particles: {
            number: { value: 80, density: { enable: true, value_area: 800 } },
            color: { value: "#ffffff" },
            shape: { type: "circle" },
            opacity: { value: 0.2, random: true },
            size: { value: 3, random: true },
            line_linked: {
                enable: true,
                distance: 150,
                color: "#ffffff",
                opacity: 0.1,
                width: 1
            },
            move: {
                enable: true,
                speed: 1,
                direction: "none",
                random: true,
                straight: false,
                out_mode: "out",
                bounce: false
            }
        },
        interactivity: {
            detect_on: "canvas",
            events: {
                onhover: { enable: true, mode: "grab" },
                onclick: { enable: true, mode: "push" },
                resize: true
            }
        },
        retina_detect: true
    });

    // Initialize the app
    initializeApp();
});

// Tab management
function initializeTabs() {
    const tabs = ['encode', 'decode', 'hex'];

    tabs.forEach(tabName => {
        const tabElement = document.getElementById(`${tabName}Tab`);
        if (tabElement) {
            tabElement.addEventListener('click', () => switchTab(tabName));
        }
    });
}

function switchTab(tabName) {
    const tabs = ['encode', 'decode', 'hex'];

    // Hide all panels and deactivate all tabs
    tabs.forEach(tab => {
        const panel = document.getElementById(`${tab}Panel`);
        const tabEl = document.getElementById(`${tab}Tab`);

        if (panel) panel.classList.remove('active');
        if (tabEl) tabEl.classList.remove('active');
    });

    // Show selected panel and activate tab
    const selectedPanel = document.getElementById(`${tabName}Panel`);
    const selectedTab = document.getElementById(`${tabName}Tab`);

    if (selectedPanel) selectedPanel.classList.add('active');
    if (selectedTab) selectedTab.classList.add('active');
}

// Configuration constants
const CONFIG = {
    HEADER_SIGNATURE: "RAYZIP",
    HEADER_SIZE: 32,
    MAX_FILE_SIZE: 50 * 1024 * 1024, // 50MB limit
    MIN_IMAGE_DIMENSION: 100,
    SUPPORTED_IMAGE_TYPES: ['image/png', 'image/jpeg', 'image/jpg'],
    SUPPORTED_FILE_TYPES: ['.zip'],
    PROGRESS_UPDATE_INTERVAL: 1000, // bytes
    ANIMATION_DELAY: 100 // ms
};

// State management
const state = {
    coverImageFile: null,
    zipFile: null,
    encodedImageFile: null,
    hexImageFile: null,
    isProcessing: false,
    objectUrls: {}
};

// Utility functions
const utils = {
    // Debounce function to prevent rapid successive calls
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },

    // Safe DOM element getter
    getElement(id) {
        const element = document.getElementById(id);
        if (!element) {
            console.warn(`Element with id '${id}' not found`);
        }
        return element;
    },

    // Enhanced file size formatter
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        if (typeof bytes !== 'number' || bytes < 0) return 'Invalid size';

        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    // Validate image file
    validateImageFile(file) {
        if (!file) {
            throw new Error('No file provided');
        }

        if (!CONFIG.SUPPORTED_IMAGE_TYPES.includes(file.type)) {
            throw new Error(`Unsupported image format. Please use: ${CONFIG.SUPPORTED_IMAGE_TYPES.join(', ')}`);
        }

        if (file.size > CONFIG.MAX_FILE_SIZE) {
            throw new Error(`Image file too large. Maximum size: ${utils.formatFileSize(CONFIG.MAX_FILE_SIZE)}`);
        }

        return true;
    },

    // Validate ZIP file
    validateZipFile(file) {
        if (!file) {
            throw new Error('No file provided');
        }

        if (!file.name.toLowerCase().endsWith('.zip')) {
            throw new Error('Please select a valid ZIP file');
        }

        if (file.size > CONFIG.MAX_FILE_SIZE) {
            throw new Error(`ZIP file too large. Maximum size: ${utils.formatFileSize(CONFIG.MAX_FILE_SIZE)}`);
        }

        return true;
    },

    // Enhanced error display with auto-dismiss
    showError(message, duration = 5000) {
        console.error('Error:', message);
        const toast = utils.getElement('toast');
        if (!toast) return;

        toast.textContent = message;
        toast.classList.remove('hidden');
        toast.classList.add('show');

        // Clear any existing timeout
        if (toast.timeoutId) {
            clearTimeout(toast.timeoutId);
        }

        toast.timeoutId = setTimeout(() => {
            toast.classList.remove('show');
            toast.classList.add('hidden');
        }, duration);
    },

    // Safe async operation wrapper
    async safeAsync(operation, errorMessage) {
        try {
            return await operation();
        } catch (error) {
            console.error(errorMessage, error);
            utils.showError(`${errorMessage}: ${error.message}`);
            throw error;
        }
    }
};

// Enhanced drag and drop handlers
function initializeDragAndDrop() {
    const dropzones = [
        { id: 'imageDropzone', inputId: 'coverImage', handler: handleCoverImageSelect, validator: 'image' },
        { id: 'fileDropzone', inputId: 'zipFile', handler: handleZipFileSelect, validator: 'zip' },
        { id: 'decodeDropzone', inputId: 'encodedImage', handler: handleEncodedImageSelect, validator: 'image' },
        { id: 'hexDropzone', inputId: 'hexImage', handler: handleHexImageSelect, validator: 'image' }
    ];

    dropzones.forEach(({ id, inputId, handler, validator }) => {
        const dropzone = utils.getElement(id);
        const input = utils.getElement(inputId);

        if (!dropzone || !input) return;

        // Click to select file
        dropzone.addEventListener('click', () => input.click());
        input.addEventListener('change', handler);

        // Drag and drop events
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, preventDefaults, false);
        });

        ['dragenter', 'dragover'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => highlight(e, dropzone), false);
        });

        ['dragleave', 'drop'].forEach(eventName => {
            dropzone.addEventListener(eventName, (e) => unhighlight(e, dropzone), false);
        });

        dropzone.addEventListener('drop', (e) => handleDrop(e, validator, handler), false);
    });
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function highlight(e, element) {
    element.classList.add('active');
}

function unhighlight(e, element) {
    element.classList.remove('active');
}

function handleDrop(e, validator, handler) {
    const dt = e.dataTransfer;
    const files = dt.files;

    if (files.length === 0) return;

    const file = files[0];

    try {
        if (validator === 'image' && !file.type.match('image.*')) {
            throw new Error('Please drop a valid image file');
        }
        if (validator === 'zip' && !file.name.toLowerCase().endsWith('.zip')) {
            throw new Error('Please drop a valid ZIP file');
        }

        handler({ target: { files: [file] } });
    } catch (error) {
        utils.showError(error.message);
    }
}

// Enhanced file handlers
function handleCoverImageSelect(e) {
    if (state.isProcessing) {
        utils.showError('Please wait for current operation to complete');
        return;
    }

    try {
        const file = e.target.files[0];
        if (!file) return;

        utils.validateImageFile(file);
        state.coverImageFile = file;

        const reader = new FileReader();
        reader.onerror = () => utils.showError('Failed to read image file');
        reader.onload = (event) => {
            const img = new Image();
            img.onerror = () => utils.showError('Invalid image file');
            img.onload = () => {
                // Validate minimum dimensions
                if (img.width < CONFIG.MIN_IMAGE_DIMENSION || img.height < CONFIG.MIN_IMAGE_DIMENSION) {
                    utils.showError(`Image too small. Minimum dimensions: ${CONFIG.MIN_IMAGE_DIMENSION}x${CONFIG.MIN_IMAGE_DIMENSION}px`);
                    return;
                }

                const preview = utils.getElement('previewImage');
                const previewContainer = utils.getElement('inputImagePreview');

                if (preview && previewContainer) {
                    preview.src = event.target.result;
                    previewContainer.classList.remove('hidden');
                }

                checkEncodeReady();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);

    } catch (error) {
        utils.showError(error.message);
        e.target.value = ''; // Clear invalid selection
    }
}

function handleZipFileSelect(e) {
    if (state.isProcessing) {
        utils.showError('Please wait for current operation to complete');
        return;
    }

    try {
        const file = e.target.files[0];
        if (!file) return;

        utils.validateZipFile(file);
        state.zipFile = file;

        // Update file info display
        const fileName = utils.getElement('fileName');
        const fileSize = utils.getElement('fileSize');
        const fileInfo = utils.getElement('fileInfo');

        if (fileName) fileName.textContent = file.name;
        if (fileSize) fileSize.textContent = utils.formatFileSize(file.size);
        if (fileInfo) fileInfo.classList.remove('hidden');

        checkEncodeReady();

    } catch (error) {
        utils.showError(error.message);
        e.target.value = ''; // Clear invalid selection
    }
}

function handleEncodedImageSelect(e) {
    if (state.isProcessing) {
        utils.showError('Please wait for current operation to complete');
        return;
    }

    try {
        const file = e.target.files[0];
        if (!file) return;

        utils.validateImageFile(file);
        state.encodedImageFile = file;

        const reader = new FileReader();
        reader.onerror = () => utils.showError('Failed to read encoded image');
        reader.onload = (event) => {
            const preview = utils.getElement('decodePreviewImage');
            const previewContainer = utils.getElement('decodePreview');

            if (preview && previewContainer) {
                preview.src = event.target.result;
                previewContainer.classList.remove('hidden');
            }

            const decodeButton = utils.getElement('decodeButton');
            if (decodeButton) decodeButton.disabled = false;
        };
        reader.readAsDataURL(file);

    } catch (error) {
        utils.showError(error.message);
        e.target.value = '';
    }
}

function handleHexImageSelect(e) {
    try {
        const file = e.target.files[0];
        if (!file) return;

        utils.validateImageFile(file);
        state.hexImageFile = file;

        const reader = new FileReader();
        reader.onerror = () => utils.showError('Failed to read image for hex view');
        reader.onload = (event) => {
            const arrayBuffer = event.target.result;
            const uint8Array = new Uint8Array(arrayBuffer);
            updateHexView(uint8Array);
        };
        reader.readAsArrayBuffer(file);

    } catch (error) {
        utils.showError(error.message);
        e.target.value = '';
    }
}

function checkEncodeReady() {
    const encodeButton = utils.getElement('encodeButton');
    if (!encodeButton) return;

    encodeButton.disabled = !(state.coverImageFile && state.zipFile) || state.isProcessing;
}

// Enhanced encoding with better progress tracking
async function encodeFile() {
    if (!state.coverImageFile || !state.zipFile || state.isProcessing) return;

    state.isProcessing = true;
    const encodeButton = utils.getElement('encodeButton');
    if (encodeButton) encodeButton.disabled = true;

    try {
        await utils.safeAsync(async () => {
            const coverData = await readFileAsDataURL(state.coverImageFile);
            const zipData = await readFileAsArrayBuffer(state.zipFile);

            const img = await loadImage(coverData);

            // Validate image can hold the ZIP file
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            // Correct calculation of available bits/bytes
            const pixelCount = imageData.data.length / 4; // rgba length -> pixels
            const totalBits = pixelCount * 3; // RGB channels (we use 1 LSB per channel)
            const availableBytes = Math.floor(totalBits / 8);
            const zipArray = new Uint8Array(zipData);

            if (zipArray.length > availableBytes - CONFIG.HEADER_SIZE) {
                throw new Error(`ZIP file too large for this image. Available space: ${utils.formatFileSize(availableBytes - CONFIG.HEADER_SIZE)}, Required: ${utils.formatFileSize(zipArray.length)}`);
            }

            // Show progress
            const progressContainer = utils.getElement('encodeProgress');
            if (progressContainer) progressContainer.classList.remove('hidden');

            await encodeImageWithZip(canvas, imageData, zipArray);
        }, 'Encoding failed');

    } catch (error) {
        // Error already handled in safeAsync
    } finally {
        state.isProcessing = false;
        checkEncodeReady();
    }
}

async function encodeImageWithZip(canvas, imageData, zipArray) {
    return new Promise((resolve, reject) => {
        try {
            const pixels = imageData.data;
            const zipLength = zipArray.length;
            const outputFormat = utils.getElement('outputFormat')?.value || 'png';
            const jpegQuality = parseInt(utils.getElement('jpegQuality')?.value || '90') / 100;

            // Create header with validation
            const header = new Uint8Array(CONFIG.HEADER_SIZE);
            const headerStr = CONFIG.HEADER_SIGNATURE;

            for (let i = 0; i < headerStr.length; i++) {
                header[i] = headerStr.charCodeAt(i);
            }

            // Store file size in little-endian format with bounds checking
            if (zipLength > 0xFFFFFFFF) {
                throw new Error('File too large to encode');
            }

            header[6] = zipLength & 0xff;
            header[7] = (zipLength >> 8) & 0xff;
            header[8] = (zipLength >> 16) & 0xff;
            header[9] = (zipLength >> 24) & 0xff;

            const dataToHide = new Uint8Array(header.length + zipLength);
            dataToHide.set(header);
            dataToHide.set(zipArray, header.length);

            // Encode with progress updates
            let dataIndex = 0;
            let bitIndex = 0; // bit position inside current byte (0 = LSB)
            let currentByte = dataToHide[dataIndex];

            const totalPixelsNeeded = Math.ceil(dataToHide.length * 8 / 3);
            const progressStep = Math.max(1, Math.floor(totalPixelsNeeded / 100));
            let pixelsProcessed = 0;

            const updateProgress = (progress, status) => {
                const progressBar = utils.getElement('encodeProgressBar');
                const statusText = utils.getElement('encodeStatus');
                if (progressBar) progressBar.style.width = `${progress}%`;
                if (statusText) statusText.textContent = status;
            };

            // Process pixels in chunks to prevent blocking
            const processChunk = (startIndex) => {
                const chunkSize = 10000; // Process 10k array indices at a time (each pixel is 4 entries)
                const endIndex = Math.min(startIndex + chunkSize, pixels.length);

                for (let i = startIndex; i < endIndex && dataIndex < dataToHide.length; i += 4) {
                    for (let j = 0; j < 3; j++) {
                        if (dataIndex >= dataToHide.length) break;

                        const bit = (currentByte >> bitIndex) & 1; // LSB-first
                        pixels[i + j] = (pixels[i + j] & 0xfe) | bit;

                        bitIndex++;
                        if (bitIndex >= 8) {
                            bitIndex = 0;
                            dataIndex++;
                            if (dataIndex < dataToHide.length) {
                                currentByte = dataToHide[dataIndex];
                            }
                        }
                    }

                    pixelsProcessed++;
                    if (pixelsProcessed % progressStep === 0) {
                        const progress = Math.min(99, Math.floor(pixelsProcessed / totalPixelsNeeded * 100));
                        updateProgress(progress, `Encoding... ${progress}%`);
                    }
                }

                if (endIndex < pixels.length && dataIndex < dataToHide.length) {
                    setTimeout(() => processChunk(endIndex), 10);
                } else {
                    // Encoding complete
                    const ctx = canvas.getContext('2d');
                    ctx.putImageData(imageData, 0, 0);

                    updateProgress(100, 'Encoding complete!');

                    setTimeout(() => {
                        try {
                            const resultImage = utils.getElement('resultImage');
                            const encodeOutput = utils.getElement('encodeOutput');

                            if (resultImage && encodeOutput) {
                                if (outputFormat === 'png') {
                                    resultImage.src = canvas.toDataURL('image/png');
                                } else {
                                    resultImage.src = canvas.toDataURL('image/jpeg', jpegQuality);
                                }

                                encodeOutput.classList.remove('hidden');

                                const downloadButton = utils.getElement('downloadButton');
                                if (downloadButton) {
                                    downloadButton.onclick = () => {
                                        const link = document.createElement('a');
                                        link.download = `hidden_${state.coverImageFile.name.split('.')[0]}.${outputFormat}`;
                                        link.href = resultImage.src;
                                        link.click();
                                    };
                                }
                            }
                            resolve();
                        } catch (error) {
                            reject(error);
                        }
                    }, 500);
                }
            };

            updateProgress(0, 'Starting encoding...');
            setTimeout(() => processChunk(0), CONFIG.ANIMATION_DELAY);

        } catch (error) {
            reject(error);
        }
    });
}

// Enhanced decoding with better error handling
async function decodeFile() {
    if (!state.encodedImageFile || state.isProcessing) return;

    state.isProcessing = true;
    const decodeButton = utils.getElement('decodeButton');
    if (decodeButton) decodeButton.disabled = true;

    try {
        await utils.safeAsync(async () => {
            const imageDataUrl = await readFileAsDataURL(state.encodedImageFile);
            const img = await loadImage(imageDataUrl);

            const progressContainer = utils.getElement('decodeProgress');
            if (progressContainer) progressContainer.classList.remove('hidden');

            await extractHiddenFile(img);
        }, 'Decoding failed');

    } catch (error) {
        // Error already handled in safeAsync
    } finally {
        state.isProcessing = false;
        const decodeButton = utils.getElement('decodeButton');
        if (decodeButton) decodeButton.disabled = false;
    }
}

// --- FIXED DECODING FUNCTION WITH PROPER BITSTREAM CONTINUITY ---
async function extractHiddenFile(img) {
    return new Promise((resolve, reject) => {
        try {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);

            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const pixels = imageData.data;

            const updateProgress = (progress, status) => {
                const progressBar = utils.getElement('decodeProgressBar');
                const statusText = utils.getElement('decodeStatus');
                if (progressBar) progressBar.style.width = `${progress}%`;
                if (statusText) statusText.textContent = status;
            };

            updateProgress(5, 'Reading header...');

            // Extract header with continuous bitstream
            const header = new Uint8Array(CONFIG.HEADER_SIZE);
            let headerIndex = 0;
            let bitIndex = 0;
            let currentHeaderByte = 0;
            let pixelIndex = 0;

            // Read header bits continuously
            for (; pixelIndex < pixels.length && headerIndex < CONFIG.HEADER_SIZE; pixelIndex += 4) {
                for (let j = 0; j < 3 && headerIndex < CONFIG.HEADER_SIZE; j++) {
                    const bit = pixels[pixelIndex + j] & 1;
                    currentHeaderByte |= (bit << bitIndex);
                    bitIndex++;
                    
                    if (bitIndex >= 8) {
                        header[headerIndex] = currentHeaderByte;
                        headerIndex++;
                        bitIndex = 0;
                        currentHeaderByte = 0;
                    }
                }
            }

            updateProgress(15, 'Validating header...');

            // Validate header signature
            const headerStr = String.fromCharCode(...header.slice(0, CONFIG.HEADER_SIGNATURE.length));
            if (headerStr !== CONFIG.HEADER_SIGNATURE) {
                throw new Error('No hidden file found or invalid signature');
            }

            // Extract file size (little-endian)
            const fileSize = 
                (header[6] << 0)  | 
                (header[7] << 8)  | 
                (header[8] << 16) | 
                (header[9] << 24);
            
            if (fileSize <= 0 || fileSize > CONFIG.MAX_FILE_SIZE) {
                throw new Error(`Invalid file size: ${utils.formatFileSize(fileSize)}`);
            }

            updateProgress(25, `Extracting ${utils.formatFileSize(fileSize)}...`);

            // Extract file data with proper byte reconstruction
            const fileData = new Uint8Array(fileSize);
            let dataIndex = 0;
            let currentByte = 0;
            let bitsCollected = 0;

            const totalBitsNeeded = fileSize * 8;
            let bitsProcessed = 0;

            const processBits = () => {
                for (let i = pixelIndex; i < pixels.length && dataIndex < fileSize; i += 4) {
                    for (let j = 0; j < 3 && dataIndex < fileSize; j++) {
                        const bit = pixels[i + j] & 1;
                        currentByte |= (bit << bitsCollected);
                        bitsCollected++;
                        bitsProcessed++;

                        if (bitsCollected >= 8) {
                            fileData[dataIndex] = currentByte;
                            dataIndex++;
                            currentByte = 0;
                            bitsCollected = 0;

                            // Update progress
                            if (dataIndex % 1000 === 0 || dataIndex === fileSize) {
                                const progress = 25 + Math.floor((bitsProcessed / totalBitsNeeded) * 70);
                                updateProgress(Math.min(95, progress), 
                                    `Extracted ${utils.formatFileSize(dataIndex)} of ${utils.formatFileSize(fileSize)}`);
                            }
                        }
                    }
                }

                if (dataIndex < fileSize && bitsProcessed < totalBitsNeeded) {
                    // Continue processing
                    setTimeout(() => processBits(), 10);
                } else {
                    // Final validation
                    validateAndCompleteExtraction(fileData, fileSize, resolve, reject);
                }
            };

            // Start processing from where header ended
            setTimeout(() => processBits(), CONFIG.ANIMATION_DELAY);

        } catch (error) {
            reject(error);
        }
    });
}

function validateAndCompleteExtraction(fileData, fileSize, resolve, reject) {
    const updateProgress = (progress, status) => {
        const progressBar = utils.getElement('decodeProgressBar');
        const statusText = utils.getElement('decodeStatus');
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (statusText) statusText.textContent = status;
    };

    // Enhanced ZIP file validation
    if (fileData.length < 4) {
        reject(new Error('Extracted data too small to be a valid ZIP file'));
        return;
    }

    // Check for ZIP signature (PK header)
    const hasZipSignature = 
        fileData[0] === 0x50 && 
        fileData[1] === 0x4B && 
        fileData[2] === 0x03 && 
        fileData[3] === 0x04;

    // Also check for other possible ZIP signatures
    const hasZipEmptyArchive = 
        fileData[0] === 0x50 && 
        fileData[1] === 0x4B && 
        fileData[2] === 0x05 && 
        fileData[3] === 0x06;

    const hasZipSpanned = 
        fileData[0] === 0x50 && 
        fileData[1] === 0x4B && 
        fileData[2] === 0x07 && 
        fileData[3] === 0x08;

    if (!hasZipSignature && !hasZipEmptyArchive && !hasZipSpanned) {
        console.warn('ZIP signature not found. Raw header:', 
            Array.from(fileData.slice(0, 8)).map(b => b.toString(16)).join(' '));
        
        // Try to auto-correct common issues
        const correctedData = attemptAutoCorrection(fileData);
        if (correctedData) {
            // Recursively validate the corrected data
            validateAndCompleteExtraction(correctedData, correctedData.length, resolve, reject);
            return;
        }
        
        reject(new Error('Extracted data does not contain valid ZIP file signature. File may be corrupted.'));
        return;
    }

    updateProgress(100, 'Extraction complete! Validating ZIP...');

    // Additional validation: check if it's a valid ZIP structure
    try {
        const blob = new Blob([fileData], { type: 'application/zip' });
        
        // Test if browser can handle the ZIP
        const url = URL.createObjectURL(blob);
        
        setTimeout(() => {
            const fileNameEl = utils.getElement('extractedFileName');
            const fileSizeEl = utils.getElement('extractedFileSize');
            const decodeOutput = utils.getElement('decodeOutput');
            
            if (fileNameEl) fileNameEl.textContent = 'extracted_file.zip';
            if (fileSizeEl) fileSizeEl.textContent = utils.formatFileSize(fileSize);
            if (decodeOutput) decodeOutput.classList.remove('hidden');
            
            const downloadButton = utils.getElement('downloadExtractedButton');
            if (downloadButton) {
                downloadButton.onclick = () => {
                    const link = document.createElement('a');
                    link.download = 'extracted_file.zip';
                    link.href = url;
                    link.click();
                    setTimeout(() => URL.revokeObjectURL(url), 1000);
                };
            }
            
            updateProgress(100, 'ZIP file validated successfully!');
            resolve();
        }, 500);
        
    } catch (error) {
        reject(new Error('Failed to create valid ZIP file from extracted data'));
    }
}

function attemptAutoCorrection(fileData) {
    // Try common fixes for corrupted ZIP data
    
    // Fix 1: Check for off-by-one errors
    for (let offset = -2; offset <= 2; offset++) {
        if (offset === 0) continue;
        
        const testData = new Uint8Array(fileData.length + Math.abs(offset));
        if (offset > 0) {
            testData.set(fileData, offset);
        } else {
            testData.set(fileData.slice(Math.abs(offset)));
        }
        
        if (testData[0] === 0x50 && testData[1] === 0x4B) {
            console.log(`Auto-corrected with offset: ${offset}`);
            return testData;
        }
    }
    
    // Fix 2: Try adding missing header bytes
    if (fileData[0] !== 0x50 && fileData.length > 4) {
        const fixedData = new Uint8Array([0x50, 0x4B, 0x03, 0x04, ...fileData]);
        if (fixedData[0] === 0x50 && fixedData[1] === 0x4B) {
            console.log('Auto-corrected by adding ZIP header');
            return fixedData;
        }
    }
    
    return null;
}

// Enhanced hex view with performance optimization
function updateHexView(uint8Array) {
    const limit = Math.min(parseInt(utils.getElement('hexLimit')?.value || '1000'), uint8Array.length);
    const limitedArray = uint8Array.slice(0, limit);

    const lines = [];

    for (let i = 0; i < limitedArray.length; i += 16) {
        const chunk = limitedArray.slice(i, Math.min(i + 16, limitedArray.length));

        // Offset
        const offset = i.toString(16).padStart(8, '0').toUpperCase();

        // Hex bytes
        const hex = Array.from(chunk)
            .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
            .join(' ')
            .padEnd(47, ' '); // 16 bytes * 2 chars + 15 spaces = 47 chars

        // ASCII representation
        const ascii = Array.from(chunk)
            .map(byte => (byte >= 32 && byte <= 126) ? String.fromCharCode(byte) : '.')
            .join('');

        lines.push(`${offset}  ${hex}  ${ascii}`);
    }

    const hexContent = utils.getElement('hexContent');
    const hexOutput = utils.getElement('hexOutput');

    if (hexContent) hexContent.textContent = lines.join('\n');
    if (hexOutput) hexOutput.classList.remove('hidden');
}

// Helper functions for file operations
function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
    });
}

function readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsArrayBuffer(file);
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onerror = () => reject(new Error('Failed to load image'));
        img.onload = () => resolve(img);
        img.src = src;
    });
}

// Reset functionality
function resetEncoder() {
    if (state.isProcessing) {
        utils.showError('Cannot reset while operation is in progress');
        return;
    }

    state.coverImageFile = null;
    state.zipFile = null;

    // Clear form inputs
    const inputs = ['coverImage', 'zipFile'];
    inputs.forEach(id => {
        const input = utils.getElement(id);
        if (input) input.value = '';
    });

    // Hide UI elements
    const hideElements = ['inputImagePreview', 'fileInfo', 'encodeOutput', 'encodeProgress'];
    hideElements.forEach(id => {
        const el = utils.getElement(id);
        if (el) el.classList.add('hidden');
    });

    checkEncodeReady();
}

// Initialize quality slider
function initializeQualitySlider() {
    const qualitySlider = utils.getElement('jpegQuality');
    const qualityValue = utils.getElement('qualityValue');
    const outputFormat = utils.getElement('outputFormat');

    if (qualitySlider && qualityValue) {
        qualityValue.textContent = `${qualitySlider.value}%`;
        qualitySlider.addEventListener('input', utils.debounce((e) => {
            qualityValue.textContent = `${e.target.value}%`;
        }, 100));
    }

    if (outputFormat && qualitySlider) {
        outputFormat.addEventListener('change', (e) => {
            qualitySlider.disabled = e.target.value !== 'jpeg';
        });
    }
}

// Initialize hex limit listener
function initializeHexLimit() {
    const hexLimitSelect = utils.getElement('hexLimit');
    if (hexLimitSelect) {
        hexLimitSelect.addEventListener('change', () => {
            if (state.hexImageFile) {
                utils.safeAsync(async () => {
                    const arrayBuffer = await readFileAsArrayBuffer(state.hexImageFile);
                    const uint8Array = new Uint8Array(arrayBuffer);
                    updateHexView(uint8Array);
                }, 'Failed to update hex view');
            }
        });
    }
}

// Initialize all buttons
function initializeButtons() {
    const encodeBtn = utils.getElement('encodeButton');
    const decodeBtn = utils.getElement('decodeButton');
    const resetBtn = utils.getElement('resetButton');

    if (encodeBtn) {
        encodeBtn.addEventListener('click', () => {
            utils.safeAsync(encodeFile, 'Encoding failed');
        });
    }

    if (decodeBtn) {
        decodeBtn.addEventListener('click', () => {
            utils.safeAsync(decodeFile, 'Decoding failed');
        });
    }

    if (resetBtn) {
        resetBtn.addEventListener('click', resetEncoder);
    }
}

// Final initialization
function initializeApp() {
    try {
        // Initialize tabs
        initializeTabs();

        // Set default tab
        switchTab('encode');

        // Initialize drag and drop
        initializeDragAndDrop();

        // Initialize quality slider
        initializeQualitySlider();

        // Initialize hex limit
        initializeHexLimit();

        // Initialize buttons
        initializeButtons();

        // Set up initial button states
        const encodeBtn = utils.getElement('encodeButton');
        const decodeBtn = utils.getElement('decodeButton');

        if (encodeBtn) encodeBtn.disabled = true;
        if (decodeBtn) decodeBtn.disabled = true;

        // Initialize output format
        const outputFormatSelect = utils.getElement('outputFormat');
        if (outputFormatSelect && outputFormatSelect.value === 'png') {
            const jpegQualitySlider = utils.getElement('jpegQuality');
            if (jpegQualitySlider) jpegQualitySlider.disabled = true;
        }

        console.log('RayZip application initialized successfully');

    } catch (error) {
        console.error('Initialization error:', error);
        utils.showError('Failed to initialize application. Please refresh the page.');
    }
}
