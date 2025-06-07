"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const jsx_runtime_1 = require("react/jsx-runtime");
const react_1 = require("react");
require("./App.css"); // We'll create this for App-specific styles
const applyPixelationEffect = (imageData, pixelSize) => {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;
    for (let y = 0; y < height; y += pixelSize) {
        for (let x = 0; x < width; x += pixelSize) {
            const blockStartIndex = (y * width + x) * 4;
            const r = data[blockStartIndex];
            const g = data[blockStartIndex + 1];
            const b = data[blockStartIndex + 2];
            const a = data[blockStartIndex + 3];
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
};
const PIXELATION_SIZE = 10;
const App = () => {
    const [screenshotDataUrl, setScreenshotDataUrl] = (0, react_1.useState)(null);
    const [annotations, setAnnotations] = (0, react_1.useState)([]);
    const [currentTool, setCurrentTool] = (0, react_1.useState)(null);
    const [isPinned, setIsPinned] = (0, react_1.useState)(false);
    const [isDrawing, setIsDrawing] = (0, react_1.useState)(false);
    const [drawingColor, setDrawingColor] = (0, react_1.useState)('#FF0000'); // Default to red
    const imageRef = (0, react_1.useRef)(null);
    const canvasRef = (0, react_1.useRef)(null);
    const drawingStateRef = (0, react_1.useRef)({ startX: 0, startY: 0 });
    // --- IPC Handlers ---
    (0, react_1.useEffect)(() => {
        if (window.electronAPI && window.electronAPI.receive) {
            const unlisten = window.electronAPI.receive('screenshot-captured', (dataURL) => {
                console.log('Screenshot data received in React App');
                setScreenshotDataUrl(dataURL);
                setAnnotations([]); // Clear annotations for new image
                setCurrentTool(null);
            });
            // Cleanup on unmount
            return () => {
                // Need a way to unregister the listener if electronAPI.receive returns a function to do so.
                // Assuming the preload script's ipcRenderer.on is used, there's no direct unlisten from here
                // without modifying preload. For now, this is a known limitation or area for preload improvement.
                // If `unlisten` is a function returned by `receive`, call it: if (typeof unlisten === 'function') unlisten();
            };
        }
    }, []);
    // --- Canvas Resizing and Redrawing ---
    const redrawAllAnnotations = (0, react_1.useCallback)(() => {
        const canvas = canvasRef.current;
        const ctx = canvas?.getContext('2d');
        const image = imageRef.current;
        if (!ctx || !canvas || !image)
            return;
        // Match canvas size to image display size
        canvas.width = image.offsetWidth;
        canvas.height = image.offsetHeight;
        // Position canvas exactly over the image (assuming image is direct child of a relative container)
        const imgRect = image.getBoundingClientRect();
        const containerRect = image.parentElement.getBoundingClientRect(); // Ensure parentElement exists and is a an HTMLElement
        canvas.style.position = 'absolute';
        canvas.style.top = `${imgRect.top - containerRect.top}px`;
        canvas.style.left = `${imgRect.left - containerRect.left}px`;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        annotations.forEach(annotation => {
            ctx.strokeStyle = annotation.color;
            ctx.fillStyle = annotation.color;
            ctx.lineWidth = annotation.lineWidth || 2;
            switch (annotation.type) {
                case 'rect':
                    if (annotation.w && annotation.h) {
                        ctx.strokeRect(annotation.x, annotation.y, annotation.w, annotation.h);
                    }
                    break;
                case 'circle':
                    if (annotation.radius) {
                        ctx.beginPath();
                        ctx.arc(annotation.x, annotation.y, annotation.radius, 0, 2 * Math.PI);
                        ctx.stroke();
                    }
                    break;
                case 'text':
                    if (annotation.text) {
                        ctx.font = annotation.font || "16px Arial";
                        ctx.fillText(annotation.text, annotation.x, annotation.y);
                    }
                    break;
                case 'pencil':
                    if (annotation.points && annotation.points.length > 1) {
                        ctx.beginPath();
                        ctx.moveTo(annotation.points[0].x, annotation.points[0].y);
                        for (let i = 1; i < annotation.points.length; i++) {
                            ctx.lineTo(annotation.points[i].x, annotation.points[i].y);
                        }
                        ctx.stroke();
                    }
                    break;
                case 'pixelate':
                    if (annotation.w && annotation.h && image && canvas) {
                        const actualX = annotation.w < 0 ? annotation.x + annotation.w : annotation.x;
                        const actualY = annotation.h < 0 ? annotation.y + annotation.h : annotation.y;
                        const actualW = Math.abs(annotation.w);
                        const actualH = Math.abs(annotation.h);
                        if (actualW > 0 && actualH > 0) {
                            const tempCanvas = document.createElement('canvas');
                            tempCanvas.width = actualW;
                            tempCanvas.height = actualH;
                            const tempCtx = tempCanvas.getContext('2d');
                            if (tempCtx) {
                                const sx = (image.naturalWidth / image.offsetWidth) * actualX;
                                const sy = (image.naturalHeight / image.offsetHeight) * actualY;
                                const sWidth = (image.naturalWidth / image.offsetWidth) * actualW;
                                const sHeight = (image.naturalHeight / image.offsetHeight) * actualH;
                                tempCtx.drawImage(image, sx, sy, sWidth, sHeight, 0, 0, actualW, actualH);
                                let regionImageData = tempCtx.getImageData(0, 0, actualW, actualH);
                                regionImageData = applyPixelationEffect(regionImageData, annotation.pixelSize || PIXELATION_SIZE);
                                tempCtx.putImageData(regionImageData, 0, 0);
                                ctx.drawImage(tempCanvas, actualX, actualY);
                            }
                        }
                    }
                    break;
            }
        });
    }, [annotations, screenshotDataUrl]); // Dependency on screenshotDataUrl to trigger redraw when image changes
    (0, react_1.useEffect)(() => {
        redrawAllAnnotations();
        // Add resize listener for window to redraw canvas if window size changes image display size
        const handleResize = () => redrawAllAnnotations();
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [redrawAllAnnotations]);
    // --- Event Handlers for Controls ---
    const handleTakeScreenshot = () => {
        if (window.electronAPI)
            window.electronAPI.send('open-selector-window');
    };
    const handleTogglePin = () => {
        if (window.electronAPI)
            window.electronAPI.send('toggle-pin');
        setIsPinned(!isPinned);
    };
    const handleSaveScreenshot = () => {
        // TODO: Implement saving with annotations. For now, saves original.
        if (window.electronAPI && screenshotDataUrl) {
            // This needs to be more advanced: draw image + canvas to a new canvas
            // then get dataURL from that.
            const canvas = canvasRef.current;
            const image = imageRef.current;
            if (!image || !canvas) {
                alert('Cannot save: image or canvas not ready.');
                return;
            }
            const offscreenCanvas = document.createElement('canvas');
            offscreenCanvas.width = image.naturalWidth; // Use natural image dimensions for full quality
            offscreenCanvas.height = image.naturalHeight;
            const offscreenCtx = offscreenCanvas.getContext('2d');
            if (!offscreenCtx) {
                alert('Cannot save: failed to create offscreen canvas context.');
                return;
            }
            // Draw the original image
            offscreenCtx.drawImage(image, 0, 0, image.naturalWidth, image.naturalHeight);
            // Scale annotations to match natural image dimensions
            const scaleX = image.naturalWidth / image.offsetWidth;
            const scaleY = image.naturalHeight / image.offsetHeight;
            annotations.forEach(annotation => {
                offscreenCtx.strokeStyle = annotation.color;
                offscreenCtx.fillStyle = annotation.color;
                offscreenCtx.lineWidth = (annotation.lineWidth || 2) * Math.min(scaleX, scaleY); // Scale line width too
                switch (annotation.type) {
                    case 'rect':
                        if (annotation.w && annotation.h) {
                            offscreenCtx.strokeRect(annotation.x * scaleX, annotation.y * scaleY, annotation.w * scaleX, annotation.h * scaleY);
                        }
                        break;
                    case 'circle':
                        if (annotation.radius) {
                            offscreenCtx.beginPath();
                            offscreenCtx.arc(annotation.x * scaleX, annotation.y * scaleY, annotation.radius * Math.min(scaleX, scaleY), 0, 2 * Math.PI);
                            offscreenCtx.stroke();
                        }
                        break;
                    case 'text':
                        if (annotation.text) {
                            // Basic font scaling - might need more sophisticated handling
                            const originalFontSize = parseInt(annotation.font || "16px Arial", 10) || 16;
                            const scaledFontSize = Math.round(originalFontSize * Math.min(scaleX, scaleY));
                            offscreenCtx.font = `${scaledFontSize}px Arial`; // Keep font family simple for now
                            offscreenCtx.fillText(annotation.text, annotation.x * scaleX, annotation.y * scaleY);
                        }
                        break;
                    case 'pencil':
                        if (annotation.points && annotation.points.length > 1) {
                            offscreenCtx.beginPath();
                            offscreenCtx.moveTo(annotation.points[0].x * scaleX, annotation.points[0].y * scaleY);
                            for (let i = 1; i < annotation.points.length; i++) {
                                offscreenCtx.lineTo(annotation.points[i].x * scaleX, annotation.points[i].y * scaleY);
                            }
                            offscreenCtx.stroke();
                        }
                        break;
                    case 'pixelate':
                        if (annotation.w && annotation.h && offscreenCtx) {
                            const scaledX = annotation.w < 0 ? (annotation.x + annotation.w) * scaleX : annotation.x * scaleX;
                            const scaledY = annotation.h < 0 ? (annotation.y + annotation.h) * scaleY : annotation.y * scaleY;
                            const scaledW = Math.abs(annotation.w) * scaleX;
                            const scaledH = Math.abs(annotation.h) * scaleY;
                            if (scaledW > 0 && scaledH > 0) {
                                try {
                                    let regionImageData = offscreenCtx.getImageData(Math.floor(scaledX), Math.floor(scaledY), Math.ceil(scaledW), Math.ceil(scaledH));
                                    regionImageData = applyPixelationEffect(regionImageData, annotation.pixelSize || PIXELATION_SIZE);
                                    offscreenCtx.putImageData(regionImageData, Math.floor(scaledX), Math.floor(scaledY));
                                }
                                catch (e) {
                                    console.error("Error processing pixelation for save:", e, { scaledX, scaledY, scaledW, scaledH });
                                }
                            }
                        }
                        break;
                }
            });
            const dataURLWithAnnotations = offscreenCanvas.toDataURL('image/png');
            window.electronAPI.send('save-screenshot', dataURLWithAnnotations);
        }
        else {
            alert('No screenshot to save.');
        }
    };
    const handleClearAnnotations = () => setAnnotations([]);
    const selectTool = (tool) => setCurrentTool(tool);
    // --- Canvas Mouse Handlers ---
    const getMousePos = (e) => {
        const canvas = canvasRef.current;
        if (!canvas)
            return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    };
    const handleMouseDown = (e) => {
        if (!currentTool)
            return;
        const { x, y } = getMousePos(e);
        drawingStateRef.current = { startX: x, startY: y };
        setIsDrawing(true);
        const newAnnotationId = Date.now().toString();
        drawingStateRef.current.tempAnnotationId = newAnnotationId;
        if (currentTool === 'text') {
            const text = prompt("Enter text:", "");
            if (text) {
                setAnnotations(prev => [...prev, {
                        id: newAnnotationId, type: 'text', text, x, y, color: drawingColor, font: '16px Arial'
                    }]);
            }
            setIsDrawing(false); // Text is immediate
        }
        else if (currentTool === 'pencil') {
            drawingStateRef.current.currentPoints = [{ x, y }];
            // Add temporary pencil annotation
            setAnnotations(prev => [...prev, {
                    id: newAnnotationId, type: 'pencil', x, y, points: [{ x, y }], color: drawingColor, lineWidth: 2
                }]);
        }
        else if (currentTool === 'rect' || currentTool === 'circle' || currentTool === 'pixelate') {
            // Add a temporary annotation for visual feedback during drag
            const tempAnnotation = {
                id: newAnnotationId,
                type: currentTool,
                x, y, w: 0, h: 0, // Initial zero size
                color: drawingColor,
            };
            if (currentTool === 'circle')
                tempAnnotation.radius = 0;
            setAnnotations(prev => [...prev, tempAnnotation]);
        }
    };
    const handleMouseMove = (e) => {
        if (!isDrawing || !currentTool || !drawingStateRef.current.tempAnnotationId)
            return;
        const { x, y } = getMousePos(e);
        const { startX, startY } = drawingStateRef.current;
        const tempId = drawingStateRef.current.tempAnnotationId;
        setAnnotations(prev => prev.map(ann => {
            if (ann.id !== tempId)
                return ann;
            let updatedAnn = { ...ann };
            if (currentTool === 'pencil' && drawingStateRef.current.currentPoints) {
                drawingStateRef.current.currentPoints.push({ x, y });
                updatedAnn.points = [...drawingStateRef.current.currentPoints];
            }
            else if (currentTool === 'rect' || currentTool === 'pixelate') {
                updatedAnn.w = x - startX;
                updatedAnn.h = y - startY;
            }
            else if (currentTool === 'circle') {
                const dx = x - startX;
                const dy = y - startY;
                updatedAnn.x = startX + dx / 2; // Center of circle
                updatedAnn.y = startY + dy / 2;
                updatedAnn.radius = Math.sqrt(dx * dx + dy * dy) / 2;
            }
            return updatedAnn;
        }));
    };
    const handleMouseUp = () => {
        if (!isDrawing || !currentTool)
            return;
        // Finalize the current annotation by removing temporary properties if any
        // Or, if using the preview-then-add approach, this is where you'd add the final shape
        // The current approach (add then update) might need normalization for width/height here.
        const tempId = drawingStateRef.current.tempAnnotationId;
        if (currentTool === 'rect' || currentTool === 'pixelate') {
            setAnnotations(prev => prev.map(ann => {
                if (ann.id === tempId && ann.w && ann.h) {
                    const newAnn = { ...ann };
                    if (ann.w < 0) {
                        newAnn.x = ann.x + ann.w;
                        newAnn.w = -ann.w;
                    }
                    if (ann.h < 0) {
                        newAnn.y = ann.y + ann.h;
                        newAnn.h = -ann.h;
                    }
                    return newAnn;
                }
                return ann;
            }));
        }
        setIsDrawing(false);
        drawingStateRef.current = { startX: 0, startY: 0, currentPoints: [], tempAnnotationId: undefined };
        // setCurrentTool(null); // Optionally deselect tool after drawing
    };
    const handleMouseLeave = () => {
        // Optional: if drawing, finalize or cancel
        if (isDrawing) {
            handleMouseUp();
        }
    };
    return ((0, jsx_runtime_1.jsxs)("div", { className: "App", children: [(0, jsx_runtime_1.jsx)("header", { className: "App-header", children: (0, jsx_runtime_1.jsx)("h1", { children: "Screen Capture (React)" }) }), (0, jsx_runtime_1.jsxs)("div", { className: "controls", children: [(0, jsx_runtime_1.jsx)("button", { onClick: handleTakeScreenshot, children: "Take Screenshot" }), (0, jsx_runtime_1.jsxs)("button", { onClick: handleTogglePin, children: [isPinned ? 'Unpin' : 'Pin', " Window"] }), (0, jsx_runtime_1.jsx)("button", { onClick: handleSaveScreenshot, disabled: !screenshotDataUrl, children: "Save Screenshot" }), (0, jsx_runtime_1.jsx)("button", { onClick: handleClearAnnotations, disabled: annotations.length === 0, children: "Clear Annotations" }), (0, jsx_runtime_1.jsx)("hr", {}), "Tools:", (0, jsx_runtime_1.jsx)("button", { onClick: () => selectTool('rect'), className: currentTool === 'rect' ? 'active' : '', children: "Rectangle" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => selectTool('circle'), className: currentTool === 'circle' ? 'active' : '', children: "Circle" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => selectTool('pencil'), className: currentTool === 'pencil' ? 'active' : '', children: "Pencil" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => selectTool('text'), className: currentTool === 'text' ? 'active' : '', children: "Text" }), (0, jsx_runtime_1.jsx)("button", { onClick: () => selectTool('pixelate'), className: currentTool === 'pixelate' ? 'active' : '', children: "Pixelate" }), (0, jsx_runtime_1.jsx)("input", { type: "color", value: drawingColor, onChange: (e) => setDrawingColor(e.target.value), title: "Drawing Color" })] }), (0, jsx_runtime_1.jsxs)("div", { className: "screenshot-container", style: { position: 'relative' }, children: [screenshotDataUrl ? ((0, jsx_runtime_1.jsx)("img", { ref: imageRef, src: screenshotDataUrl, alt: "Screenshot", onLoad: redrawAllAnnotations, style: { maxWidth: '100%', maxHeight: '70vh', display: 'block' } })) : ((0, jsx_runtime_1.jsx)("p", { children: "Click \"Take Screenshot\" to capture your screen." })), screenshotDataUrl && ((0, jsx_runtime_1.jsx)("canvas", { ref: canvasRef, onMouseDown: handleMouseDown, onMouseMove: handleMouseMove, onMouseUp: handleMouseUp, onMouseLeave: handleMouseLeave, style: { position: 'absolute', top: 0, left: 0, cursor: currentTool ? 'crosshair' : 'default' } }))] })] }));
};
exports.default = App;
//# sourceMappingURL=App.js.map