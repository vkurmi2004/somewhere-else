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
        const layer = Math.floor(Math.random() * LAYERS);
        
        let speedY = Math.random() * 2 + 1;
        if (layer === 1) speedY += 2;
        if (layer === 2) speedY += 4;
        
        if (prefersReducedMotion) {
            speedY *= 0.2;
        }

        const length = Math.random() * (layer * 5 + 5) + 5;
        const opacity = Math.random() * 0.3 + (layer * 0.1);
        
        return {
            x: Math.random() * width,
            y: Math.random() * height - height,
            length: length,
            speedY: speedY,
            speedX: (Math.random() - 0.5) * 0.5,
            opacity: opacity,
            thickness: layer * 0.5 + 0.5
        };
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        ctx.lineCap = 'round';
        
        for (let i = 0; i < drops.length; i++) {
            const drop = drops[i];
            
            ctx.beginPath();
            ctx.moveTo(drop.x, drop.y);
            ctx.lineTo(drop.x + drop.speedX * 2, drop.y + drop.length);
            
            ctx.strokeStyle = `rgba(168, 185, 204, ${drop.opacity})`;
            ctx.lineWidth = drop.thickness;
            ctx.stroke();
            
            drop.y += drop.speedY;
            drop.x += drop.speedX;
            
            if (drop.y > height) {
                drop.y = -drop.length;
                drop.x = Math.random() * width;
            }
        }
        
        animationId = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => {
        resize();
        drops.forEach(drop => drop.x = Math.random() * width);
    });

    resize();
    initDrops();
    draw();

    /* =========================================
       AUDIO SYNTHESIS (Gentle, Soft Ambient Rain)
       ========================================= */
    let audioCtx = null;
    let rainGainNode = null;
    let masterGainNode = null;
    
    let isAudioInitialized = false;
    let isThunderEnabled = false;
    let volumeLevel = parseInt(volumeControl.value) / 100;
    let nextThunderTime = 0;

    function initAudio() {
        if (isAudioInitialized) return;
        
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        masterGainNode = audioCtx.createGain();
        masterGainNode.gain.value = volumeLevel * 0.15; // Very soft base volume
        masterGainNode.connect(audioCtx.destination);
        
        // Soft Rain Synth (Deep Filtered Pink/White Noise)
        const bufferSize = audioCtx.sampleRate * 2;
        const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = buffer.getChannelData(0);
        
        let b0 = 0, b1 = 0, b2 = 0;
        for (let i = 0; i < bufferSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99 * b0 + white * 0.05;
            b1 = 0.96 * b1 + white * 0.1;
            b2 = 0.90 * b2 + white * 0.15;
            output[i] = (b0 + b1 + b2) * 0.3; // Soft pink noise
        }
        
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.loop = true;
        
        // Lowpass filter to keep it warm, deep and non-harsh (350Hz max)
        const rainFilter = audioCtx.createBiquadFilter();
        rainFilter.type = 'lowpass';
        rainFilter.frequency.value = 350;
        
        rainGainNode = audioCtx.createGain();
        rainGainNode.gain.value = 0.08; // Gentle background level
        
        noiseSource.connect(rainFilter);
        rainFilter.connect(rainGainNode);
        rainGainNode.connect(masterGainNode);
        
        noiseSource.start(0);
        
        isAudioInitialized = true;
        scheduleThunder();
    }

    function scheduleThunder() {
        if (!isAudioInitialized) return;
        const delay = (Math.random() * 35 + 20) * 1000;
        
        setTimeout(() => {
            if (isThunderEnabled && !prefersReducedMotion) {
                playThunder();
            }
            scheduleThunder();
        }, delay);
    }

    function playThunder() {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();
        
        // Gentle visual flash
        document.body.classList.add('flash');
        setTimeout(() => document.body.classList.remove('flash'), 300);

        // Soft, deep sine-wave low rumble (no harsh square waves)
        const osc = audioCtx.createOscillator();
        const rumbleFilter = audioCtx.createBiquadFilter();
        const rumbleGain = audioCtx.createGain();

        osc.type = 'sine'; // Warm sine wave
        osc.frequency.setValueAtTime(35, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(15, audioCtx.currentTime + 4);

        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.setValueAtTime(90, audioCtx.currentTime);

        rumbleGain.gain.setValueAtTime(0, audioCtx.currentTime);
        rumbleGain.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 1.0); // Gentle attack
        rumbleGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 4.5); // Long smooth decay

        osc.connect(rumbleFilter);
        rumbleFilter.connect(rumbleGain);
        rumbleGain.connect(masterGainNode);

        osc.start(audioCtx.currentTime);
        osc.stop(audioCtx.currentTime + 4.5);
    }

    /* =========================================
       UI INTERACTIONS
       ========================================= */

    setTimeout(() => {
        if (initialMessage) {
            initialMessage.classList.remove('fade-in');
            initialMessage.classList.add('fade-out');
        }
    }, 3000);

    // Toggle Settings Panel & Audio Init
    settingsToggle.addEventListener('click', () => {
        const isExpanded = settingsToggle.getAttribute('aria-expanded') === 'true';
        settingsToggle.setAttribute('aria-expanded', !isExpanded);
        settingsPanel.classList.toggle('hidden');
        
        if (!isExpanded) {
            initAudio();
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        }
    });

    // Global click listener to resume AudioContext on user touch/click
    document.addEventListener('click', () => {
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
    }, { once: true });

    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && !settingsToggle.contains(e.target)) {
            settingsPanel.classList.add('hidden');
            settingsToggle.setAttribute('aria-expanded', 'false');
        }
    });

    // Volume Control
    volumeControl.addEventListener('input', (e) => {
        volumeLevel = parseInt(e.target.value) / 100;
        if (masterGainNode && audioCtx) {
            masterGainNode.gain.setValueAtTime(volumeLevel * 0.15, audioCtx.currentTime);
        }
        initAudio();
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
            timerBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
            }

            const timeValue = btn.dataset.time;
            if (timeValue !== 'infinity') {
                const ms = parseInt(timeValue) * 60 * 1000;
                timerId = setTimeout(completeSession, ms);
            }
            
            if (roomContainer.classList.contains('fade-dim')) {
                resetSession();
            }
        });
    });

    function completeSession() {
        roomContainer.classList.add('fade-dim');
        completionModal.classList.remove('hidden');
        if (masterGainNode && audioCtx) {
            masterGainNode.gain.linearRampToValueAtTime(0.01, audioCtx.currentTime + 2);
        }
    }

    function resetSession() {
        roomContainer.classList.remove('fade-dim');
        completionModal.classList.add('hidden');
        if (masterGainNode && audioCtx) {
            masterGainNode.gain.linearRampToValueAtTime(volumeLevel * 0.15, audioCtx.currentTime + 1);
        }
    }

    btnStay.addEventListener('click', () => {
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
