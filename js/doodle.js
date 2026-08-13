document.addEventListener('DOMContentLoaded', () => {
    /* =========================================
       DOM ELEMENTS & STATE
       ========================================= */
    const canvas = document.getElementById('doodle-canvas');
    const ctx = canvas.getContext('2d');

    const btnLeave = document.getElementById('btn-leave');
    const leaveModal = document.getElementById('leave-modal');
    const btnConfirmLeave = document.getElementById('btn-confirm-leave');
    const btnCancelLeave = document.getElementById('btn-cancel-leave');
    const btnUndo = document.getElementById('btn-undo');
    const btnRedo = document.getElementById('btn-redo');
    const btnClear = document.getElementById('btn-clear');
    const btnSave = document.getElementById('btn-save');
    const initialMessage = document.getElementById('initial-message');
    const cursorRing = document.getElementById('cursor-ring');
    const mirrorIndicator = document.getElementById('mirror-indicator');
    const glowIndicator = document.getElementById('glow-indicator');

    const brushSizeButtons = document.querySelectorAll('.brush-size');
    const colorButtons = document.querySelectorAll('.color-btn');
    const modeBtns = document.querySelectorAll('.mode-btn[data-mode]');
    const toggleGlow = document.getElementById('toggle-glow');
    const toggleMirror = document.getElementById('toggle-mirror');

    let prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Drawing State
    let isDrawing = false;
    let isDirty = false;
    let lastX = 0;
    let lastY = 0;

    // Tool settings
    let currentMode = 'pen';  // 'pen' | 'spray' | 'eraser'
    let brushColor = '#E0D8CC';
    let brushSize = 4;
    let glowMode = false;
    let mirrorMode = false;

    // Spray settings
    let sprayInterval = null;
    const SPRAY_DENSITY = 30;

    // History
    let undoStack = [];
    let redoStack = [];
    const MAX_HISTORY = 25;

    /* =========================================
       CANVAS SETUP & RESIZING
       ========================================= */
    function resizeCanvas() {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0);

        const dpr = window.devicePixelRatio || 1;
        canvas.width = window.innerWidth * dpr;
        canvas.height = window.innerHeight * dpr;
        ctx.scale(dpr, dpr);
        ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width / dpr, tempCanvas.height / dpr);
        setupContext();
    }

    function setupContext() {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    /* =========================================
       CURSOR RING PREVIEW
       ========================================= */
    document.addEventListener('pointermove', (e) => {
        const size = currentMode === 'eraser' ? brushSize * 3 : brushSize;
        cursorRing.style.left = `${e.clientX}px`;
        cursorRing.style.top = `${e.clientY}px`;
        cursorRing.style.width = `${size}px`;
        cursorRing.style.height = `${size}px`;
        cursorRing.style.display = 'block';
    });
    canvas.addEventListener('pointerleave', () => {
        cursorRing.style.display = 'none';
    });

    /* =========================================
       DRAWING HELPERS
       ========================================= */
    function getCoords(e) {
        const rect = canvas.getBoundingClientRect();
        return { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    function applyGlowStyle() {
        if (glowMode) {
            ctx.shadowBlur = brushSize * 4;
            ctx.shadowColor = brushColor;
        } else {
            ctx.shadowBlur = 0;
            ctx.shadowColor = 'transparent';
        }
    }

    function drawPen(x1, y1, x2, y2) {
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
        applyGlowStyle();
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();

        if (mirrorMode) {
            const mx = canvas.width / (window.devicePixelRatio || 1) - x1;
            const mx2 = canvas.width / (window.devicePixelRatio || 1) - x2;
            ctx.beginPath();
            ctx.moveTo(mx, y1);
            ctx.lineTo(mx2, y2);
            ctx.stroke();
        }
    }

    function drawSpray(x, y) {
        ctx.globalCompositeOperation = 'source-over';
        applyGlowStyle();
        const radius = brushSize * 3;
        for (let i = 0; i < SPRAY_DENSITY; i++) {
            const angle = Math.random() * Math.PI * 2;
            const dist = Math.random() * radius;
            const sx = x + Math.cos(angle) * dist;
            const sy = y + Math.sin(angle) * dist;
            ctx.fillStyle = brushColor;
            ctx.globalAlpha = Math.random() * 0.4 + 0.1;
            ctx.beginPath();
            ctx.arc(sx, sy, Math.random() * 1.5 + 0.3, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;

        if (mirrorMode) {
            const w = canvas.width / (window.devicePixelRatio || 1);
            for (let i = 0; i < SPRAY_DENSITY; i++) {
                const angle = Math.random() * Math.PI * 2;
                const dist = Math.random() * radius;
                const sx = (w - x) + Math.cos(angle) * dist;
                const sy = y + Math.sin(angle) * dist;
                ctx.fillStyle = brushColor;
                ctx.globalAlpha = Math.random() * 0.4 + 0.1;
                ctx.beginPath();
                ctx.arc(sx, sy, Math.random() * 1.5 + 0.3, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.globalAlpha = 1;
        }
    }

    function drawEraser(x1, y1, x2, y2) {
        ctx.shadowBlur = 0;
        ctx.globalCompositeOperation = 'destination-out';
        ctx.strokeStyle = 'rgba(0,0,0,1)';
        ctx.lineWidth = brushSize * 3;
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
        ctx.globalCompositeOperation = 'source-over';
    }

    /* =========================================
       POINTER EVENTS
       ========================================= */
    function startDrawing(e) {
        if (e.button !== undefined && e.button !== 0) return;
        if (e.target !== canvas) return;

        isDrawing = true;
        isDirty = true;
        const coords = getCoords(e);
        lastX = coords.x;
        lastY = coords.y;
        saveState();

        if (currentMode === 'spray') {
            drawSpray(lastX, lastY);
            sprayInterval = setInterval(() => {
                if (isDrawing) drawSpray(lastX, lastY);
            }, 30);
        } else if (currentMode === 'eraser') {
            drawEraser(lastX, lastY, lastX, lastY);
        } else {
            drawPen(lastX, lastY, lastX + 0.1, lastY + 0.1);
        }
    }

    function continueDrawing(e) {
        if (!isDrawing) return;
        const coords = getCoords(e);
        const x = coords.x;
        const y = coords.y;

        if (currentMode === 'spray') {
            lastX = x; lastY = y; // spray interval handles drawing
        } else if (currentMode === 'eraser') {
            drawEraser(lastX, lastY, x, y);
            lastX = x; lastY = y;
        } else {
            drawPen(lastX, lastY, x, y);
            lastX = x; lastY = y;
        }

        // Update cursor ring position
        cursorRing.style.left = `${e.clientX}px`;
        cursorRing.style.top = `${e.clientY}px`;
    }

    function stopDrawing() {
        isDrawing = false;
        if (sprayInterval) { clearInterval(sprayInterval); sprayInterval = null; }
    }

    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', continueDrawing);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
    canvas.addEventListener('pointerout', stopDrawing);
    canvas.setPointerCapture; // Let pointermove work outside canvas

    /* =========================================
       HISTORY (Undo / Redo)
       ========================================= */
    function saveState() {
        if (undoStack.length >= MAX_HISTORY) undoStack.shift();
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        redoStack = [];
        updateHistoryButtons();
    }

    function restoreState(state) {
        if (!state) return;
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = state.width;
        tempCanvas.height = state.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(state, 0, 0);
        ctx.save();
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
    }

    function undo() {
        if (undoStack.length === 0) return;
        redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        restoreState(undoStack.pop());
        updateHistoryButtons();
        isDirty = undoStack.length > 0;
    }

    function redo() {
        if (redoStack.length === 0) return;
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        restoreState(redoStack.pop());
        isDirty = true;
        updateHistoryButtons();
    }

    function clearCanvas() {
        saveState();
        const dpr = window.devicePixelRatio || 1;
        ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
        isDirty = false;
        updateHistoryButtons();
    }

    function updateHistoryButtons() {
        btnUndo.disabled = undoStack.length === 0;
        btnRedo.disabled = redoStack.length === 0;
    }

    btnUndo.addEventListener('click', undo);
    btnRedo.addEventListener('click', redo);
    btnClear.addEventListener('click', clearCanvas);

    /* =========================================
       SAVE AS PNG
       ========================================= */
    btnSave.addEventListener('click', () => {
        // Export the canvas as PNG and auto-download
        const link = document.createElement('a');
        link.download = `somewhere-else-doodle-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
    });

    /* =========================================
       TOOLBAR: TOOLS
       ========================================= */
    modeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            modeBtns.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
            btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true');
            currentMode = btn.dataset.mode;
            updateCursorStyle();
        });
    });

    function updateCursorStyle() {
        canvas.style.cursor = currentMode === 'eraser' ? 'cell' : 'crosshair';
    }

    /* =========================================
       TOOLBAR: BRUSH SIZE
       ========================================= */
    brushSizeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            brushSizeButtons.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
            btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true');
            brushSize = parseInt(btn.dataset.size);
        });
    });

    /* =========================================
       TOOLBAR: COLORS
       ========================================= */
    colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            colorButtons.forEach(b => { b.classList.remove('active'); b.setAttribute('aria-pressed', 'false'); });
            btn.classList.add('active'); btn.setAttribute('aria-pressed', 'true');
            brushColor = btn.dataset.color;
            // If in eraser, switch back to pen
            if (currentMode === 'eraser') {
                currentMode = 'pen';
                document.querySelectorAll('.mode-btn[data-mode]').forEach(b => {
                    b.classList.remove('active'); b.setAttribute('aria-pressed', 'false');
                });
                document.getElementById('tool-pen').classList.add('active');
                document.getElementById('tool-pen').setAttribute('aria-pressed', 'true');
            }
        });
    });

    /* =========================================
       SPECIAL MODES: GLOW & MIRROR
       ========================================= */
    toggleGlow.addEventListener('click', () => {
        glowMode = !glowMode;
        toggleGlow.setAttribute('aria-pressed', glowMode);
        toggleGlow.classList.toggle('active', glowMode);
        glowIndicator.style.display = glowMode ? 'flex' : 'none';
    });

    toggleMirror.addEventListener('click', () => {
        mirrorMode = !mirrorMode;
        toggleMirror.setAttribute('aria-pressed', mirrorMode);
        toggleMirror.classList.toggle('active', mirrorMode);
        mirrorIndicator.style.display = mirrorMode ? 'flex' : 'none';
    });

    /* =========================================
       KEYBOARD SHORTCUTS
       ========================================= */
    document.addEventListener('keydown', (e) => {
        // Don't intercept when typing in inputs
        if (e.target.tagName === 'INPUT') return;

        if ((e.ctrlKey || e.metaKey) && e.key === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 'y') { e.preventDefault(); redo(); }
        if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); btnSave.click(); }
        if (e.key === 'p') { document.getElementById('tool-pen').click(); }
        if (e.key === 's') { document.getElementById('tool-spray').click(); }
        if (e.key === 'e') { document.getElementById('tool-eraser').click(); }
        if (e.key === 'g') { toggleGlow.click(); }
        if (e.key === 'm') { toggleMirror.click(); }
        if (e.key === 'Escape' && !leaveModal.classList.contains('hidden')) {
            leaveModal.classList.add('hidden');
        }
    });

    /* =========================================
       INTRO MESSAGE & LEAVE MODAL
       ========================================= */
    setTimeout(() => {
        if (initialMessage) initialMessage.classList.add('fade-out');
    }, 3500);

    btnLeave.addEventListener('click', () => {
        if (isDirty) { leaveModal.classList.remove('hidden'); }
        else { window.location.href = '../index.html'; }
    });

    btnCancelLeave.addEventListener('click', () => leaveModal.classList.add('hidden'));
    btnConfirmLeave.addEventListener('click', () => { window.location.href = '../index.html'; });
});
