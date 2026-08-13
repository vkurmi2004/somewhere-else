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
    let splashes = [];
    let animationId = null;

    const DROP_COUNT = prefersReducedMotion ? 30 : 140;
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
            drops.push(createDrop(true));
        }
    }

    function createDrop(randomY = false) {
        const layer = Math.floor(Math.random() * LAYERS);
        // Near/far layers
        const speeds = [3, 7, 13];
        const speedY = speeds[layer] + Math.random() * 3;
        const length = layer === 0 ? (Math.random() * 8 + 6) : layer === 1 ? (Math.random() * 18 + 12) : (Math.random() * 28 + 22);
        const opacity = layer === 0 ? (Math.random() * 0.12 + 0.06) : layer === 1 ? (Math.random() * 0.28 + 0.12) : (Math.random() * 0.45 + 0.2);
        const thickness = layer === 0 ? 0.5 : layer === 1 ? 1 : 1.5;

        return {
            x: Math.random() * width,
            y: randomY ? Math.random() * height : -length - Math.random() * 100,
            length,
            speedY: prefersReducedMotion ? speedY * 0.2 : speedY,
            speedX: speedY * -0.08, // slight angle
            opacity,
            thickness,
            layer
        };
    }

    function draw() {
        ctx.clearRect(0, 0, width, height);
        ctx.lineCap = 'round';

        // Draw drops back-to-front
        for (let layer = 0; layer < LAYERS; layer++) {
            for (let i = 0; i < drops.length; i++) {
                const drop = drops[i];
                if (drop.layer !== layer) continue;

                // Slight color variation per layer (cold blue-white)
                const r = layer === 2 ? 180 : 140;
                const g = layer === 2 ? 200 : 165;
                const b = layer === 2 ? 230 : 200;

                ctx.beginPath();
                ctx.moveTo(drop.x, drop.y);
                ctx.lineTo(drop.x + drop.speedX * 2.5, drop.y + drop.length);
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${drop.opacity})`;
                ctx.lineWidth = drop.thickness;
                ctx.stroke();

                drop.y += drop.speedY;
                drop.x += drop.speedX;

                if (drop.y > height + drop.length) {
                    // Create splash for foreground drops
                    if (drop.layer === 2 && Math.random() < 0.4) {
                        splashes.push({ x: drop.x, y: height - 2, r: 0, maxR: Math.random() * 8 + 4, opacity: 0.5 });
                    }
                    const newDrop = createDrop(false);
                    drops[i] = newDrop;
                }
            }
        }

        // Draw splashes
        for (let i = splashes.length - 1; i >= 0; i--) {
            const s = splashes[i];
            s.r += 0.8;
            s.opacity -= 0.06;

            if (s.opacity <= 0) {
                splashes.splice(i, 1);
                continue;
            }

            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, Math.PI, 0); // Half-circle ripple
            ctx.strokeStyle = `rgba(150, 180, 220, ${s.opacity})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

        animationId = requestAnimationFrame(draw);
    }

    window.addEventListener('resize', () => {
        resize();
        drops.forEach(drop => { drop.x = Math.random() * width; });
    });

    resize();
    initDrops();
    draw();

    /* =========================================
       AUDIO SYNTHESIS - REALISTIC RAIN
       Layered: Pink noise + droplet impacts + distant thunder
       ========================================= */
    let audioCtx = null;
    let masterGainNode = null;
    let rainGainNode = null;
    let isAudioInitialized = false;
    let isThunderEnabled = false;
    let volumeLevel = parseInt(volumeControl.value) / 100;

    function initAudio() {
        if (isAudioInitialized) return;

        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = audioCtx.sampleRate;

        masterGainNode = audioCtx.createGain();
        masterGainNode.gain.value = volumeLevel * 0.55;
        masterGainNode.connect(audioCtx.destination);

        // ---- LAYER 1: Pink Noise base (organic rain hiss) ----
        const bufferSize = sampleRate * 4;
        const buffer = audioCtx.createBuffer(2, bufferSize, sampleRate);

        for (let ch = 0; ch < 2; ch++) {
            const data = buffer.getChannelData(ch);
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const white = Math.random() * 2 - 1;
                // Paul Kellet's pink noise approximation
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + white * 0.5362) * 0.11;
            }
        }

        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = buffer;
        noiseSource.loop = true;

        // Shape the rain: cut highs, boost lows for warmth, leave mid presence
        const bassShelf = audioCtx.createBiquadFilter();
        bassShelf.type = 'lowshelf';
        bassShelf.frequency.value = 300;
        bassShelf.gain.value = 6;

        const midCut = audioCtx.createBiquadFilter();
        midCut.type = 'peaking';
        midCut.frequency.value = 3000;
        midCut.Q.value = 0.7;
        midCut.gain.value = -8;

        const highCut = audioCtx.createBiquadFilter();
        highCut.type = 'lowpass';
        highCut.frequency.value = 2800;

        rainGainNode = audioCtx.createGain();
        rainGainNode.gain.value = 0.75;

        noiseSource.connect(bassShelf);
        bassShelf.connect(midCut);
        midCut.connect(highCut);
        highCut.connect(rainGainNode);
        rainGainNode.connect(masterGainNode);
        noiseSource.start(0);

        // ---- LAYER 2: Random droplet "patter" impacts ----
        scheduleDroplets();

        isAudioInitialized = true;
        scheduleThunder();
    }

    // Simulate individual large raindrop impacts on the glass
    function scheduleDroplets() {
        if (!audioCtx) return;
        const delay = Math.random() * 0.4 + 0.05;
        setTimeout(() => {
            playDroplet();
            scheduleDroplets();
        }, delay * 1000);
    }

    function playDroplet() {
        if (!audioCtx || audioCtx.state === 'suspended') return;
        const now = audioCtx.currentTime;

        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filt = audioCtx.createBiquadFilter();

        // Short, pitched "plink" — frequency varies for variety
        const freq = Math.random() * 800 + 600;
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.55, now + 0.12);

        filt.type = 'bandpass';
        filt.frequency.value = freq * 0.9;
        filt.Q.value = 4;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.018, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);

        osc.connect(filt);
        filt.connect(gain);
        gain.connect(masterGainNode);

        osc.start(now);
        osc.stop(now + 0.14);
    }

    function scheduleThunder() {
        if (!isAudioInitialized) return;
        const delay = (Math.random() * 50 + 25) * 1000;
        setTimeout(() => {
            if (isThunderEnabled && !prefersReducedMotion) playThunder();
            scheduleThunder();
        }, delay);
    }

    function playThunder() {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();

        // Visual flash
        document.body.classList.add('flash');
        setTimeout(() => document.body.classList.remove('flash'), 450);

        const now = audioCtx.currentTime;

        // ---- Thunder: layered low-frequency noise burst ----
        const bufSize = audioCtx.sampleRate * 5;
        const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);

        let b0 = 0, b1 = 0;
        for (let i = 0; i < bufSize; i++) {
            const white = Math.random() * 2 - 1;
            b0 = 0.99 * b0 + white * 0.04;
            b1 = 0.97 * b1 + white * 0.08;
            data[i] = (b0 + b1) * 0.5;
        }

        const tSource = audioCtx.createBufferSource();
        tSource.buffer = buf;

        const tFilter = audioCtx.createBiquadFilter();
        tFilter.type = 'lowpass';
        tFilter.frequency.value = 120;
        tFilter.Q.value = 0.5;

        const tGain = audioCtx.createGain();
        tGain.gain.setValueAtTime(0, now);
        // Sharp initial crack
        tGain.gain.linearRampToValueAtTime(0.6, now + 0.08);
        // Long rolling rumble decay
        tGain.gain.setValueAtTime(0.6, now + 0.08);
        tGain.gain.exponentialRampToValueAtTime(0.08, now + 1.5);
        tGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);

        tSource.connect(tFilter);
        tFilter.connect(tGain);
        tGain.connect(masterGainNode);
        tSource.start(now);
        tSource.stop(now + 5);
    }

    /* =========================================
       UI INTERACTIONS
       ========================================= */
    setTimeout(() => {
        if (initialMessage) {
            initialMessage.classList.add('fade-out');
        }
    }, 3000);

    settingsToggle.addEventListener('click', () => {
        const isExpanded = settingsToggle.getAttribute('aria-expanded') === 'true';
        settingsToggle.setAttribute('aria-expanded', !isExpanded);
        settingsPanel.classList.toggle('hidden');

        if (!isExpanded) {
            initAudio();
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        }
    });

    document.addEventListener('click', () => {
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
    }, { once: true });

    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && !settingsToggle.contains(e.target)) {
            settingsPanel.classList.add('hidden');
            settingsToggle.setAttribute('aria-expanded', 'false');
        }
    });

    volumeControl.addEventListener('input', (e) => {
        volumeLevel = parseInt(e.target.value) / 100;
        if (masterGainNode && audioCtx) {
            masterGainNode.gain.setTargetAtTime(volumeLevel * 0.55, audioCtx.currentTime, 0.1);
        }
        initAudio();
    });

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
            if (timerId) { clearTimeout(timerId); timerId = null; }
            const timeValue = btn.dataset.time;
            if (timeValue !== 'infinity') {
                const ms = parseInt(timeValue) * 60 * 1000;
                timerId = setTimeout(completeSession, ms);
            }
            if (roomContainer.classList.contains('fade-dim')) resetSession();
        });
    });

    function completeSession() {
        roomContainer.classList.add('fade-dim');
        completionModal.classList.remove('hidden');
        if (masterGainNode && audioCtx) {
            masterGainNode.gain.linearRampToValueAtTime(0.02, audioCtx.currentTime + 2);
        }
    }

    function resetSession() {
        roomContainer.classList.remove('fade-dim');
        completionModal.classList.add('hidden');
        if (masterGainNode && audioCtx) {
            masterGainNode.gain.linearRampToValueAtTime(volumeLevel * 0.55, audioCtx.currentTime + 1);
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
        if (audioCtx) { audioCtx.close(); audioCtx = null; isAudioInitialized = false; }
        if (timerId) clearTimeout(timerId);
    });
});
