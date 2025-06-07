// ... (existing code at the top) ...

const annotationCanvas = document.getElementById('annotation-canvas');
const drawRectButton = document.getElementById('draw-rect-button');
const drawCircleButton = document.getElementById('draw-circle-button');
const clearAnnotationsButton = document.getElementById('clear-annotations-button'); // Added
const textToolButton = document.getElementById('text-tool-button');
const pixelateToolButton = document.getElementById('pixelate-tool-button');
const PIXELATION_SIZE = 10; // Size of pixel blocks

let ctx; // Canvas rendering context
let currentTool = null; // 'rect', 'circle', etc.
let isDrawing = false;
let startX, startY;
let lastMouseX, lastMouseY; // For dynamic drawing

// Store all drawn shapes to redraw them (simple approach)
let drawnAnnotations = [];

if (annotationCanvas) {
    ctx = annotationCanvas.getContext('2d');
} else {
    console.error('Annotation canvas not found');
}

function setActiveButton(button) {
    // Remove active class from all tool buttons
    [drawRectButton, drawCircleButton, textToolButton, pixelateToolButton /*, add other tool buttons here */].forEach(btn => {
        if (btn) btn.classList.remove('active');
    });
    if (button) {
        button.classList.add('active');
    }
}

if (drawRectButton) {
    drawRectButton.addEventListener('click', () => {
        currentTool = 'rect';
        setActiveButton(drawRectButton);
        console.log('Tool selected: Rectangle');
    });
}

if (pixelateToolButton) {
    pixelateToolButton.addEventListener('click', () => {
        currentTool = 'pixelate';
        setActiveButton(pixelateToolButton);
        console.log('Tool selected: Pixelate');
    });
}

if (textToolButton) {
    textToolButton.addEventListener('click', () => {
        currentTool = 'text';
        setActiveButton(textToolButton);
        console.log('Tool selected: Text');
        // No drawing on click for text tool selection, drawing happens on canvas click
    });
}

if (drawCircleButton) {
    drawCircleButton.addEventListener('click', () => {
        currentTool = 'circle';
        setActiveButton(drawCircleButton);
        console.log('Tool selected: Circle');
    });
}

if (clearAnnotationsButton) {
    clearAnnotationsButton.addEventListener('click', () => {
        clearCanvas();
        drawnAnnotations = []; // Clear stored annotations
        currentTool = null; // Deselect tool
        setActiveButton(null);
        console.log('Annotations cleared');
    });
}

function resizeCanvasToImage() {
    if (screenshotImage && annotationCanvas && ctx) {
        // Ensure image is loaded and has dimensions
        if (screenshotImage.offsetWidth > 0 && screenshotImage.offsetHeight > 0) {
            annotationCanvas.width = screenshotImage.offsetWidth;
            annotationCanvas.height = screenshotImage.offsetHeight;
            // Position canvas exactly over the image
            const imgRect = screenshotImage.getBoundingClientRect();
            const containerRect = screenshotImage.parentElement.getBoundingClientRect();
            annotationCanvas.style.top = (imgRect.top - containerRect.top) + 'px';
            annotationCanvas.style.left = (imgRect.left - containerRect.left) + 'px';
            console.log(`Canvas resized to: ${annotationCanvas.width}x${annotationCanvas.height}`);
            redrawAllAnnotations(); // Redraw existing annotations if canvas is resized
        } else {
            // Image might not be loaded yet, or no image displayed
            annotationCanvas.width = 0;
            annotationCanvas.height = 0;
        }
    }
}

function clearCanvas() {
    if (ctx && annotationCanvas) {
        ctx.clearRect(0, 0, annotationCanvas.width, annotationCanvas.height);
    }
}

// Helper function to get image data from the main screenshot image for a specific region
function getOriginalImageData(x, y, w, h) {
    if (!screenshotImage || !screenshotImage.src || !screenshotImage.complete || screenshotImage.naturalWidth === 0) {
        return null;
    }
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = screenshotImage.naturalWidth; // Use natural dimensions of the source image
    tempCanvas.height = screenshotImage.naturalHeight;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(screenshotImage, 0, 0, screenshotImage.naturalWidth, screenshotImage.naturalHeight);

    // Adjust x, y, w, h to be within the bounds of the image
    const sx = Math.max(0, Math.min(x, tempCanvas.width));
    const sy = Math.max(0, Math.min(y, tempCanvas.height));
    const sw = Math.max(0, Math.min(w, tempCanvas.width - sx));
    const sh = Math.max(0, Math.min(h, tempCanvas.height - sy));

    if (sw <= 0 || sh <= 0) return null;

    return tempCtx.getImageData(sx, sy, sw, sh);
}

// Pixelation function
function applyPixelation(imageData, pixelSize) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    for (let y = 0; y < height; y += pixelSize) {
        for (let x = 0; x < width; x += pixelSize) {
            // Get the color of the top-left pixel of the block
            const R_sum = 0, G_sum = 0, B_sum = 0, A_sum = 0;
            let count = 0;
            // More accurate: average color of the block
            for(let by = y; by < Math.min(y + pixelSize, height); by++) {
                for(let bx = x; bx < Math.min(x + pixelSize, width); bx++) {
                    const i = (by * width + bx) * 4;
                    // R_sum += data[i]; G_sum += data[i+1]; B_sum += data[i+2]; A_sum += data[i+3];
                    // count++;
                     if (count === 0) { // Or just sample the first pixel of the block for simplicity
                        data[i] = data[i]; // R
                        data[i+1] = data[i+1]; // G
                        data[i+2] = data[i+2]; // B
                        data[i+3] = data[i+3]; // A
                     }
                }
            }
            // const avgR = R_sum / count; const avgG = G_sum / count; const avgB = B_sum / count; const avgA = A_sum / count;

            const i = (y * width + x) * 4; // Index of the first pixel in the block
            const r = data[i];
            const g = data[i+1];
            const b = data[i+2];
            const a = data[i+3]; // Alpha

            // Set all pixels in the block to this color
            for (let blockY = 0; blockY < pixelSize && y + blockY < height; blockY++) {
                for (let blockX = 0; blockX < pixelSize && x + blockX < width; blockX++) {
                    const pixelIndex = ((y + blockY) * width + (x + blockX)) * 4;
                    data[pixelIndex] = r;
                    data[pixelIndex + 1] = g;
                    data[pixelIndex + 2] = b;
                    data[pixelIndex + 3] = a;
                }
            }
        }
    }
    return imageData;
}


// --- Update redrawAllAnnotations function ---
function redrawAllAnnotations() {
    if (!ctx || !annotationCanvas) return;
    clearCanvas();
    drawnAnnotations.forEach(annotation => {
        // Common styles (can be overridden by specific annotation types)
        ctx.strokeStyle = annotation.color || 'black';
        ctx.fillStyle = annotation.color || 'black';
        ctx.lineWidth = annotation.lineWidth || 2;

        if (annotation.type === 'rect') {
            ctx.strokeStyle = annotation.color || 'red'; // Ensure specific color for rect
            drawRectangle(annotation.x, annotation.y, annotation.w, annotation.h, annotation.color, false, true);
        } else if (annotation.type === 'circle') {
            ctx.strokeStyle = annotation.color || 'blue'; // Ensure specific color for circle
            drawCircle(annotation.x, annotation.y, annotation.radius, annotation.color, false, true);
        } else if (annotation.type === 'text') {
            ctx.font = annotation.font || "16px Arial";
            ctx.fillStyle = annotation.color || "green"; // Ensure specific color for text
            ctx.fillText(annotation.text, annotation.x, annotation.y);
        } else if (annotation.type === 'pixelate') {
            // Re-apply pixelation. This requires getting the original image data for the region.
            const originalRegionData = getOriginalImageData(annotation.x, annotation.y, annotation.w, annotation.h);
            if (originalRegionData) {
                const pixelatedRegion = applyPixelation(originalRegionData, annotation.pixelSize || PIXELATION_SIZE);
                // Need a way to draw this ImageData at annotation.x, annotation.y on the main canvas ctx.
                // Create a temporary canvas for the pixelated region
                const tempPixelCanvas = document.createElement('canvas');
                tempPixelCanvas.width = annotation.w;
                tempPixelCanvas.height = annotation.h;
                const tempPixelCtx = tempPixelCanvas.getContext('2d');
                tempPixelCtx.putImageData(pixelatedRegion, 0, 0);
                ctx.drawImage(tempPixelCanvas, annotation.x, annotation.y);
            }
        }
    });
}

// Override the screenshot received handler to also setup canvas
if (window.electronAPI && window.electronAPI.receive) {
  // Unregister previous listener if any (important for hot-reloading scenarios or multiple calls)
  // This is a bit simplistic; a robust solution might involve managing listeners more formally.
  // For now, assuming it's set up once. If issues arise, this might need refinement.

  window.electronAPI.receive('screenshot-captured', (dataURL) => {
    console.log('Screenshot data received (for canvas setup)');
    if (screenshotImage) {
      if (dataURL) {
        screenshotImage.onload = () => { // Wait for image to load before getting its dimensions
            console.log('Screenshot image loaded, resizing canvas.');
            resizeCanvasToImage();
            clearCanvas(); // Clear previous drawings
            drawnAnnotations = []; // Reset annotations for new image
            currentTool = null; // Deselect tool
            setActiveButton(null);
        };
        screenshotImage.src = dataURL;
      } else {
        screenshotImage.src = ''; // Clear image if no dataURL
        resizeCanvasToImage(); // This will effectively hide/clear canvas
      }
    } else {
      console.error('Screenshot image element not found for canvas setup');
    }
  });
}

// --- Drawing functions ---
// Modify drawRectangle
function drawRectangle(x, y, w, h, color = 'red', isPreview = false, isRedraw = false) {
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2; // Or make this a parameter/global setting
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.stroke();
    // No storage logic here, it's handled in mouseup or when initially adding
}

// Modify drawCircle
function drawCircle(x, y, radius, color = 'blue', isPreview = false, isRedraw = false) {
    if (!ctx) return;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2; // Or make this a parameter/global setting
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, 2 * Math.PI);
    ctx.stroke();
    // No storage logic here
}


// --- Mouse event handlers for drawing on canvas ---
// --- Modify canvas mouse event handlers ---
// mousedown: (largely the same, just ensure pixelate tool sets isDrawing = true)
if (annotationCanvas) {
    annotationCanvas.addEventListener('mousedown', (e) => {
        if (!ctx) return;
        startX = e.offsetX;
        startY = e.offsetY;
        lastMouseX = e.offsetX;
        lastMouseY = e.offsetY;

        if (!currentTool) return;

        if (currentTool === 'text') {
            // ... (text logic remains the same) ...
            const text = prompt("Enter text:", "");
            if (text) {
                const textAnnotation = {
                    type: 'text', text: text, x: startX, y: startY,
                    font: "16px Arial", color: "green"
                };
                drawnAnnotations.push(textAnnotation);
                redrawAllAnnotations();
                console.log('Text added and stored:', textAnnotation);
            }
            isDrawing = false;
        } else if (currentTool === 'pixelate' || currentTool === 'rect' || currentTool === 'circle') {
            isDrawing = true; // Pixelate will use rect-like drawing selection
        }
    });

    // mousemove: (pixelate tool will show a rectangle preview, like 'rect' tool)
    annotationCanvas.addEventListener('mousemove', (e) => {
        if (!isDrawing || !currentTool || !ctx || currentTool === 'text') return;

        const currentX = e.offsetX;
        const currentY = e.offsetY;
        redrawAllAnnotations(); // Redraw all stored annotations first
        const width = currentX - startX;
        const height = currentY - startY;

        if (currentTool === 'rect' || currentTool === 'pixelate') { // Pixelate shows rect preview
            // For pixelate, maybe a semi-transparent fill? For now, just like rect.
            const previewColor = currentTool === 'pixelate' ? 'rgba(100, 100, 100, 0.5)' : 'red';
            drawRectangle(startX, startY, width, height, previewColor, true);
        } else if (currentTool === 'circle') {
            const radius = Math.sqrt(Math.pow(width, 2) + Math.pow(height, 2)) / 2;
            const centerX = startX + width / 2;
            const centerY = startY + height / 2;
            drawCircle(centerX, centerY, radius, 'blue', true);
        }
        lastMouseX = currentX;
        lastMouseY = currentY;
    });

    // mouseup: (handle pixelate finalization)
    annotationCanvas.addEventListener('mouseup', (e) => {
        if (!isDrawing || !currentTool || !ctx || currentTool === 'text') return;
        isDrawing = false;

        const endX = e.offsetX;
        const endY = e.offsetY;
        let width = endX - startX;
        let height = endY - startY;

        // Normalize width/height for negative drags
        let finalX = startX;
        let finalY = startY;

        if (width < 0) {
            finalX = endX;
            width = Math.abs(width);
        }
        if (height < 0) {
            finalY = endY;
            height = Math.abs(height);
        }

        redrawAllAnnotations(); // Redraw existing annotations first

        let newAnnotation;
        if (currentTool === 'rect') {
            if (width > 0 && height > 0) {
                newAnnotation = { type: 'rect', x: finalX, y: finalY, w: width, h: height, color: 'red' };
                drawRectangle(finalX, finalY, width, height, 'red', false);
            }
        } else if (currentTool === 'circle') {
            // Circle logic already handles center calculation from start/end
            const circleWidth = endX - startX; // Use original drag for circle calculation
            const circleHeight = endY - startY;
            if (circleWidth !== 0 || circleHeight !== 0) {
                const radius = Math.sqrt(Math.pow(circleWidth, 2) + Math.pow(circleHeight, 2)) / 2;
                const centerX = startX + circleWidth / 2;
                const centerY = startY + circleHeight / 2;
                if (radius > 0) {
                    newAnnotation = { type: 'circle', x: centerX, y: centerY, radius: radius, color: 'blue' };
                    drawCircle(centerX, centerY, radius, 'blue', false);
                }
            }
        } else if (currentTool === 'pixelate') {
            if (width > 0 && height > 0) {
                // The actual pixelation happens during redrawAllAnnotations based on stored info
                newAnnotation = { type: 'pixelate', x: finalX, y: finalY, w: width, h: height, pixelSize: PIXELATION_SIZE };
                // No immediate drawing here for pixelate, relies on redrawAllAnnotations to perform it
                console.log('Pixelate area defined:', newAnnotation);
            }
        }

        if (newAnnotation) {
            drawnAnnotations.push(newAnnotation);
            console.log(`Stored ${newAnnotation.type} annotation.`);
            redrawAllAnnotations(); // Redraw everything to include the new annotation
        }
    });

    annotationCanvas.addEventListener('mouseleave', (e) => {
        // Optional: if isDrawing is true and mouse leaves, you might want to finalize or cancel the drawing.
        // For now, we'll only finalize on mouseup within the canvas.
        // if (isDrawing) {
        //     isDrawing = false;
        //     console.log('Drawing stopped due to mouse leave');
        //     redrawAllAnnotations(); // Clear any preview
        // }
    });
}

// Ensure canvas is resized when window is resized (if image is present)
// This is a simplified version; robust resizing can be complex.
window.addEventListener('resize', () => {
    if (screenshotImage && screenshotImage.src && screenshotImage.src.startsWith('data:image')) {
        // Delay slightly to allow layout to settle
        setTimeout(resizeCanvasToImage, 100);
    }
});

// Initial setup if an image is already there (e.g. if HTML is reloaded with src already set)
// This is less likely with current flow but good for robustness.
if (screenshotImage && screenshotImage.complete && screenshotImage.src) {
    console.log('Image already loaded, resizing canvas on script load.');
    resizeCanvasToImage();
}

// --- Existing code from previous steps for screenshot button, pin button, save button ---
// Ensure this existing code is still present and functional.
// The new screenshot-captured listener above replaces the old one.
// It's crucial that other functionalities (take screenshot, pin, save) are not broken.

console.log('Renderer.js loaded (with annotation features)');

const screenshotButton = document.getElementById('screenshot-button');
const screenshotImage = document.getElementById('screenshot-image'); // Already defined above, ensure no conflict

if (screenshotButton) {
  screenshotButton.addEventListener('click', () => {
    console.log('Screenshot button clicked');
    window.electronAPI.send('take-screenshot');
  });
} else {
  console.error('Screenshot button not found');
}

// The screenshot-captured listener is now the new one that handles canvas resizing.
// The old one is removed/replaced.

const pinButton = document.getElementById('pin-button');
let isPinned = false;

if (pinButton) {
  pinButton.addEventListener('click', () => {
    console.log('Pin button clicked');
    window.electronAPI.send('toggle-pin');
    isPinned = !isPinned;
    pinButton.textContent = isPinned ? 'Unpin Window' : 'Pin Window';
  });
} else {
  console.error('Pin button not found');
}

const saveButton = document.getElementById('save-button');

if (saveButton) {
  saveButton.addEventListener('click', () => {
    console.log('Save button clicked');
    // IMPORTANT: This save logic currently only saves the original screenshot.
    // It needs to be updated to merge annotations onto the image before saving.
    // This will be a future step.
    if (screenshotImage && screenshotImage.src && screenshotImage.src.startsWith('data:image')) {
      const dataURL = screenshotImage.src; // This is just the base image
      window.electronAPI.send('save-screenshot', dataURL);
    } else {
      console.error('No screenshot to save or image source is invalid.');
      alert('Please take a screenshot first!');
    }
  });
} else {
  console.error('Save button not found');
}

// Ensure electronAPI.receive is still generally available for other IPC messages if needed,
// though 'screenshot-captured' is the primary one modified here.
if (!window.electronAPI || !window.electronAPI.receive) {
  console.error('electronAPI.receive not found. Check preload.js');
}
