document.addEventListener('DOMContentLoaded', () => {
    /* =========================================
       UI ELEMENTS & STATE
       ========================================= */
    const canvas = document.getElementById('rain-canvas');
    const ctx = canvas.getContext('2d');
    
    const settingsToggle = document.getElementById('settings-toggle');
    const settingsPanel = document.getElementById('settings-panel');
    const volumeControl = document.getElementById('volume-control');
    const thunderToggle = document.getElementById('thunder-toggle');
    const timerBtns = document.querySelectorAll('.timer-btn');
    
    const initialMessage = document.getElementById('initial-message');
    const completionModal = document.getElementById('completion-modal');
    const btnStay = document.getElementById('btn-stay');
    const roomContainer = document.querySelector('.room-container');

    let prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* =========================================
       CANVAS & RAIN SIMULATION
       ========================================= */
    let width, height;
    let drops = [];
    let animationId = null;

    // Configuration
    const DROP_COUNT = prefersReducedMotion ? 20 : 100;
    const LAYERS = 3; 

    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        // Optimize for high DPI displays by scaling canvas
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
    }

    function initDrops() {
        drops = [];
        for (let i = 0; i < DROP_COUNT; i++) {
            drops.push(createDrop());
        }
    }

    function createDrop() {
        const layer = Math.floor(Math.random() * LAYERS); // 0 (bg), 1 (mid), 2 (fg)
        
        // Slower drops for background, faster for foreground
        let speedY = Math.random() * 2 + 1; // base
        if (layer === 1) speedY += 2;
        if (layer === 2) speedY += 4;
        
        if (prefersReducedMotion) {
            speedY *= 0.2; // Significantly slower
        }

        const length = Math.random() * (layer * 5 + 5) + 5;
        const opacity = Math.random() * 0.3 + (layer * 0.1);
        
        return {
            x: Math.random() * width,
            y: Math.random() * height - height, // Start above screen
            length: length,
            speedY: speedY,
            speedX: (Math.random() - 0.5) * 0.5, // Slight wind
            opacity: opacity,
            thickness: layer * 0.5 + 0.5
        };
    }

    function draw() {
        // Clear canvas
        ctx.clearRect(0, 0, width, height);
        
        // Draw drops
        ctx.lineCap = 'round';
        
        for (let i = 0; i < drops.length; i++) {
            const drop = drops[i];
            
            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x + drop.speedX * 2, drop.y + drop.length);
            
            // Soft blueish-white color
            ctx.strokeStyle = `rgba(168, 185, 204, ${drop.opacity})`;
            ctx.lineWidth = drop.thickness;
            ctx.stroke();
            
            // Update position
            drop.y += drop.speedY;
            drop.x += drop.speedX;
            
            // Reset if out of bounds
            if (drop.y > height) {
                drop.y = -drop.length;
                drop.x = Math.random() * width;
            }
        }
        
        animationId = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => {
        resize();
        // Distribute drops instantly across new dimensions
        drops.forEach(drop => drop.x = Math.random() * width);
    });

    resize();
    initDrops();
    draw();

    /* =========================================
       AUDIO SYNTHESIS (No external files)
       ========================================= */
    let audioCtx = null;
    let rainGainNode = null;
    let masterGainNode = null;
    
    let isAudioInitialized = false;
    let isThunderEnabled = false;
    let volumeLevel = parseInt(volumeControl.value) / 100; // 0.0 to 1.0
    let nextThunderTime = 0;

    function initAudio() {
        if (isAudioInitialized) return;
        
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGainNode = audioCtx.createGain();
        masterGainNode.gain.value = volumeLevel;
        masterGainNode.connect(audioCtx.destination);
        
        // Rain Synth (Filtered White Noise)
        const bufferSize = audioCtx.sampleRate * 2; // 2 seconds of noise
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = buffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1; // White noise
        }
        
        const whiteNoise = audioCtx.createBufferSource();
        whiteNoise.buffer = buffer;
        whiteNoise.loop = true;
        
        // Filter to make it sound like rain (lowpass/bandpass)
        const rainFilter = audioCtx.createBiquadFilter();
        rainFilter.type = 'lowpass';
        rainFilter.frequency.value = 1000;
        
        rainGainNode = audioCtx.createGain();
        rainGainNode.gain.value = 0.5; // Base rain volume
        
        whiteNoise.connect(rainFilter);
        rainFilter.connect(rainGainNode);
        rainGainNode.connect(masterGainNode);
        
        whiteNoise.start(0);
        
        isAudioInitialized = true;
        scheduleThunder();
    }

    function scheduleThunder() {
        if (!isAudioInitialized) return;
        
        // Random interval between 15 and 45 seconds
        const delay = (Math.random() * 30 + 15) * 1000;
        
        setTimeout(() => {
            if (isThunderEnabled && !prefersReducedMotion) {
                playThunder();
            }
            scheduleThunder();
        }, delay);
    }

    function playThunder() {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        // Visual flash (subtle)
        document.body.classList.add('flash');
        setTimeout(() => document.body.classList.remove('flash'), 400);

        // Audio Synth
        const osc = audioCtx.createOscillator();
        const rumbleFilter = audioCtx.createBiquadFilter();
        const rumbleGain = audioCtx.createGain();

        osc.type = 'square'; // Harsh wave
        osc.frequency.setValueAtTime(40, audioCtx.currentTime); // Low freq rumble
        osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 3);

        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.setValueAtTime(200, audioCtx.currentTime);

        rumbleGain.gain.setValueAtTime(0, audioCtx.currentTime);
        // Soft attack
        rumbleGain.gain.linearRampToValueAtTime(0.8, audioCtx.currentTime + 0.5);
        // Long decay
        rumbleGain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 4);

        osc.connect(rumbleFilter);
        rumbleFilter.connect(rumbleGain);
        rumbleGain.connect(masterGainNode);

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 4);
    }

    /* =========================================
       UI INTERACTIONS
       ========================================= */

    // Fade out initial message after 3 seconds
    setTimeout(() => {
        initialMessage.classList.remove('fade-in');
        initialMessage.classList.add('fade-out');
    }, 3000);

    // Toggle Settings Panel
    settingsToggle.addEventListener('click', () => {
        const isExpanded = settingsToggle.getAttribute('aria-expanded') === 'true';
        settingsToggle.setAttribute('aria-expanded', !isExpanded);
        settingsPanel.classList.toggle('hidden');
        
        // Init audio on first interaction if not yet started
        if (!isExpanded) {
            initAudio();
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        }
    });

    // Close panel when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && !settingsToggle.contains(e.target)) {
            settingsPanel.classList.add('hidden');
            settingsToggle.setAttribute('aria-expanded', 'false');
        }
    });

    // Volume Control
    volumeControl.addEventListener('input', (e) => {
        volumeLevel = parseInt(e.target.value) / 100;
        if (masterGainNode) {
            masterGainNode.gain.setValueAtTime(volumeLevel, audioCtx.currentTime);
        }
        initAudio(); // Init if hasn't been initialized
    });

    // Thunder Toggle
    thunderToggle.addEventListener('click', () => {
        isThunderEnabled = !isThunderEnabled;
        thunderToggle.setAttribute('aria-pressed', isThunderEnabled);
        thunderToggle.textContent = isThunderEnabled ? 'ON' : 'OFF';
        initAudio();
    });

    /* =========================================
       TIMER LOGIC
       ========================================= */
    let timerId = null;

    timerBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Update UI
            timerBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Clear existing
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
            }

            const timeValue = btn.dataset.time;
            if (timeValue !== 'infinity') {
                const ms = parseInt(timeValue) * 60 * 1000;
                timerId = setTimeout(completeSession, ms);
            }
            
            // If they are resuming an infinite session after it completed
            if (roomContainer.classList.contains('fade-dim')) {
                resetSession();
            }
        });
    });

    function completeSession() {
        roomContainer.classList.add('fade-dim');
        completionModal.classList.remove('hidden');
        // Fade out audio slightly
        if (masterGainNode) {
            masterGainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 2);
        }
    }

    function resetSession() {
        roomContainer.classList.remove('fade-dim');
        completionModal.classList.add('hidden');
        if (masterGainNode) {
            masterGainNode.gain.linearRampToValueAtTime(volumeLevel, audioCtx.currentTime + 1);
        }
    }

    btnStay.addEventListener('click', () => {
        // Change to infinite and reset
        timerBtns.forEach(b => b.classList.remove('active'));
        document.querySelector('.timer-btn[data-time="infinity"]').classList.add('active');
        resetSession();
    });

    /* =========================================
       CLEANUP
       ========================================= */
    window.addEventListener('pagehide', () => {
        if (animationId) cancelAnimationFrame(animationId);
        if (audioCtx) {
            audioCtx.close();
            audioCtx = null;
            isAudioInitialized = false;
        }
        if (timerId) clearTimeout(timerId);
    });
});
