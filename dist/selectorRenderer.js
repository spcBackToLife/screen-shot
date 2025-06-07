"use strict";
// This script runs in the renderer process of the selector window.
let canvas;
let ctx;
let backgroundImage = null;
let scaleFactor = 1; // For DPI scaling
let isSelecting = false;
let startX = 0, startY = 0;
let currentX = 0, currentY = 0;
function init() {
    canvas = document.getElementById('selector-canvas');
    if (!canvas) {
        console.error("Selector canvas not found!");
        return;
    }
    const context = canvas.getContext('2d');
    if (!context) {
        console.error("Failed to get 2D context for selector canvas!");
        return;
    }
    ctx = context;
    // Canvas should fill the screen
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    if (window.selectorAPI && window.selectorAPI.receive) {
        window.selectorAPI.receive('set-background', (dataUrl, receivedScaleFactor) => {
            backgroundImage = new Image();
            backgroundImage.onload = () => {
                scaleFactor = receivedScaleFactor; // Store the scale factor from main display
                draw(); // Initial draw with background
            };
            backgroundImage.src = dataUrl;
        });
    }
    else {
        console.error("selectorAPI not found. Check selectorPreload.js");
    }
    canvas.addEventListener('mousedown', (e) => {
        isSelecting = true;
        startX = e.clientX;
        startY = e.clientY;
        currentX = e.clientX;
        currentY = e.clientY;
    });
    canvas.addEventListener('mousemove', (e) => {
        if (!isSelecting)
            return;
        currentX = e.clientX;
        currentY = e.clientY;
        draw(); // Redraw with selection rectangle
    });
    canvas.addEventListener('mouseup', (e) => {
        if (!isSelecting)
            return;
        isSelecting = false;
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        if (width > 0 && height > 0) {
            if (window.selectorAPI && window.selectorAPI.send) {
                window.selectorAPI.send('region-selected', { x, y, width, height, scaleFactor });
            }
            else {
                console.error("selectorAPI.send not found for sending region.");
            }
        }
        else {
            // If selection is too small, consider it a cancellation or do nothing
            if (window.selectorAPI && window.selectorAPI.send) {
                window.selectorAPI.send('selection-cancelled');
            }
        }
        // Window will be closed by main process
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            if (window.selectorAPI && window.selectorAPI.send) {
                window.selectorAPI.send('selection-cancelled');
            }
        }
    });
    draw(); // Initial draw
}
function draw() {
    if (!ctx)
        return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // Draw the semi-transparent background image (desktop screenshot)
    if (backgroundImage) {
        ctx.globalAlpha = 0.5; // Make it a bit transparent
        ctx.drawImage(backgroundImage, 0, 0, canvas.width, canvas.height);
        ctx.globalAlpha = 1.0; // Reset alpha
    }
    else {
        // Fallback background if image not loaded yet
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    // Draw the selection rectangle
    if (isSelecting) {
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        const x = Math.min(startX, currentX);
        const y = Math.min(startY, currentY);
        const width = Math.abs(currentX - startX);
        const height = Math.abs(currentY - startY);
        ctx.strokeRect(x, y, width, height);
    }
}
window.onload = init;
//# sourceMappingURL=selectorRenderer.js.map