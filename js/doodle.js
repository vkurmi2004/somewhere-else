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
    
    const initialMessage = document.getElementById('initial-message');
    
    const brushSizeButtons = document.querySelectorAll('.brush-size');
    const colorButtons = document.querySelectorAll('.color-btn');

    let prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Drawing State
    let isDrawing = false;
    let isDirty = false;
    let lastX = 0;
    let lastY = 0;
    
    let brushColor = '#E0D8CC'; // Default warm beige
    let brushSize = 4; // Default small

    // History stacks
    let undoStack = [];
    let redoStack = [];
    const MAX_HISTORY = 20;

    /* =========================================
       CANVAS SETUP & RESIZING
       ========================================= */
    function resizeCanvas() {
        // Save current canvas contents
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.drawImage(canvas, 0, 0);

        const dpr = window.devicePixelRatio || 1;
        const displayWidth = window.innerWidth;
        const displayHeight = window.innerHeight;

        // Resize canvas elements with high DPI support
        canvas.width = displayWidth * dpr;
        canvas.height = displayHeight * dpr;
        
        ctx.scale(dpr, dpr);
        
        // Restore contents
        ctx.drawImage(tempCanvas, 0, 0, tempCanvas.width / dpr, tempCanvas.height / dpr);
        
        // Re-setup context variables
        setupContext();
    }

    function setupContext() {
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.strokeStyle = brushColor;
        ctx.lineWidth = brushSize;
    }

    // Set initial size
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    /* =========================================
       DRAWING LOGIC (Pointer Events)
       ========================================= */
    function getCoordinates(e) {
        const rect = canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    function startDrawing(e) {
        // Only allow primary pointer (left mouse click, touch, pen tip)
        if (e.button !== undefined && e.button !== 0) return;

        isDrawing = true;
        isDirty = true;
        const coords = getCoordinates(e);
        lastX = coords.x;
        lastY = coords.y;

        // Save canvas state BEFORE starting the new path
        saveState();

        // Draw a single dot immediately on click/tap
        drawSegment(lastX, lastY, coords.x, coords.y);
    }

    function draw(e) {
        if (!isDrawing) return;
        
        const coords = getCoordinates(e);
        drawSegment(lastX, lastY, coords.x, coords.y);
        
        lastX = coords.x;
        lastY = coords.y;
    }

    function drawSegment(x1, y1, x2, y2) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.stroke();
    }

    function stopDrawing() {
        isDrawing = false;
    }

    // Pointer Event Listeners (Mouse, Touch, Stylus)
    canvas.addEventListener('pointerdown', startDrawing);
    canvas.addEventListener('pointermove', draw);
    canvas.addEventListener('pointerup', stopDrawing);
    canvas.addEventListener('pointercancel', stopDrawing);
    canvas.addEventListener('pointerout', stopDrawing);

    /* =========================================
       HISTORY ENGINE (Undo / Redo / Clear)
       ========================================= */
    function saveState() {
        if (undoStack.length >= MAX_HISTORY) {
            undoStack.shift();
        }
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        // Clear redo stack on new action
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
        // Reset transform to paint pixel-for-pixel on backing store
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.restore();
    }

    function undo() {
        if (undoStack.length === 0) return;
        
        // Save current state to redo stack
        redoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        
        // Restore previous state
        const previousState = undoStack.pop();
        restoreState(previousState);
        
        updateHistoryButtons();
        
        // If undo history is empty, check if we're technically clean again
        isDirty = undoStack.length > 0;
    }

    function redo() {
        if (redoStack.length === 0) return;
        
        // Save current state to undo stack
        undoStack.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
        
        // Restore next state
        const nextState = redoStack.pop();
        restoreState(nextState);
        
        isDirty = true;
        updateHistoryButtons();
    }

    function clearCanvas() {
        // Save state so clear can be undone
        saveState();
        
        // Clear canvas
        ctx.clearRect(0, 0, canvas.width / (window.devicePixelRatio || 1), canvas.height / (window.devicePixelRatio || 1));
        
        // We cleared, so the canvas is empty now (no warning needed on exit)
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
       TOOLBAR CONTROLS (Size & Color)
       ========================================= */
    // Brush Size selection
    brushSizeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            brushSizeButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            
            brushSize = parseInt(btn.dataset.size);
            ctx.lineWidth = brushSize;
        });
    });

    // Color Palette selection
    colorButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            colorButtons.forEach(b => {
                b.classList.remove('active');
                b.setAttribute('aria-pressed', 'false');
            });
            btn.classList.add('active');
            btn.setAttribute('aria-pressed', 'true');
            
            brushColor = btn.dataset.color;
            ctx.strokeStyle = brushColor;
        });
    });

    /* =========================================
       INTRO MESSAGE & CONFIRMATION MODAL
       ========================================= */
    // Fade out initial message
    setTimeout(() => {
        initialMessage.classList.remove('fade-in');
        initialMessage.classList.add('fade-out');
    }, 3000);

    // Leave room navigation
    btnLeave.addEventListener('click', () => {
        if (isDirty) {
            leaveModal.classList.remove('hidden');
        } else {
            window.location.href = '../index.html';
        }
    });

    btnCancelLeave.addEventListener('click', () => {
        leaveModal.classList.add('hidden');
    });

    btnConfirmLeave.addEventListener('click', () => {
        window.location.href = '../index.html';
    });

    // Close modal on escape key
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !leaveModal.classList.contains('hidden')) {
            leaveModal.classList.add('hidden');
        }
    });
});
