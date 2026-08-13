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
    const nightSoundsToggle = document.getElementById('night-sounds-toggle');
    const timerBtns = document.querySelectorAll('.timer-btn');
    const initialMessage = document.getElementById('initial-message');
    const completionModal = document.getElementById('completion-modal');
    const btnStay = document.getElementById('btn-stay');
    const roomContainer = document.querySelector('.room-container');
    const lightningOverlay = document.getElementById('lightning-overlay');

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

    function createDrop(randomY = false) {
        const layer = Math.floor(Math.random() * LAYERS);
        const speeds = [3, 7, 13];
        const speedY = speeds[layer] + Math.random() * 3;
        const length = layer === 0 ? (Math.random() * 8 + 6) : layer === 1 ? (Math.random() * 18 + 12) : (Math.random() * 28 + 22);
        const opacity = layer === 0 ? (Math.random() * 0.12 + 0.06) : layer === 1 ? (Math.random() * 0.28 + 0.12) : (Math.random() * 0.45 + 0.2);
        const thickness = layer === 0 ? 0.5 : layer === 1 ? 1 : 1.5;
        return {
            x: Math.random() * width,
            y: randomY ? Math.random() * height : -length - Math.random() * 100,
            length, speedY: prefersReducedMotion ? speedY * 0.2 : speedY,
            speedX: speedY * -0.08, opacity, thickness, layer
        };
    }

    function initDrops() {
        drops = [];
        for (let i = 0; i < DROP_COUNT; i++) drops.push(createDrop(true));
    }

    function drawFrame() {
        ctx.clearRect(0, 0, width, height);
        ctx.lineCap = 'round';

        for (let layer = 0; layer < LAYERS; layer++) {
            for (let i = 0; i < drops.length; i++) {
                const drop = drops[i];
                if (drop.layer !== layer) continue;
                const r = layer === 2 ? 180 : 140;
                const g = layer === 2 ? 200 : 165;
                const b = layer === 2 ? 230 : 200;
                ctx.beginPath();
                ctx.moveTo(drop.x, drop.y);
                ctx.lineTo(drop.x + drop.speedX * 2.5, drop.y + drop.length);
                ctx.strokeStyle = `rgba(${r},${g},${b},${drop.opacity})`;
                ctx.lineWidth = drop.thickness;
                ctx.stroke();
                drop.y += drop.speedY;
                drop.x += drop.speedX;
                if (drop.y > height + drop.length) {
                    if (drop.layer === 2 && Math.random() < 0.4) {
                        splashes.push({ x: drop.x, y: height - 2, r: 0, maxR: Math.random() * 8 + 4, opacity: 0.5 });
                    }
                    drops[i] = createDrop(false);
                }
            }
        }

        for (let i = splashes.length - 1; i >= 0; i--) {
            const s = splashes[i];
            s.r += 0.8; s.opacity -= 0.06;
            if (s.opacity <= 0) { splashes.splice(i, 1); continue; }
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.r, Math.PI, 0);
            ctx.strokeStyle = `rgba(150,180,220,${s.opacity})`;
            ctx.lineWidth = 0.8;
            ctx.stroke();
        }

        animationId = requestAnimationFrame(drawFrame);
    }

    window.addEventListener('resize', () => { resize(); drops.forEach(d => { d.x = Math.random() * width; }); });
    resize(); initDrops(); drawFrame();

    /* =========================================
       AUDIO CONTEXT
       ========================================= */
    let audioCtx = null;
    let masterGainNode = null;
    let rainGainNode = null;
    let nightGainNode = null;
    let isAudioInitialized = false;
    let isThunderEnabled = false;
    let isNightSoundsEnabled = false;
    let volumeLevel = parseInt(volumeControl.value) / 100;
    // Cooldown: prevent lightning spam
    let lightningCooldown = false;

    function initAudio() {
        if (isAudioInitialized) return;

        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const sampleRate = audioCtx.sampleRate;

        masterGainNode = audioCtx.createGain();
        masterGainNode.gain.value = volumeLevel * 0.55;
        masterGainNode.connect(audioCtx.destination);

        // ---- Rain: Pink noise shaped ----
        const bufferSize = sampleRate * 4;
        const buffer = audioCtx.createBuffer(2, bufferSize, sampleRate);
        for (let ch = 0; ch < 2; ch++) {
            const data = buffer.getChannelData(ch);
            let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0;
            for (let i = 0; i < bufferSize; i++) {
                const w = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + w * 0.0555179;
                b1 = 0.99332 * b1 + w * 0.0750759;
                b2 = 0.96900 * b2 + w * 0.1538520;
                b3 = 0.86650 * b3 + w * 0.3104856;
                b4 = 0.55000 * b4 + w * 0.5329522;
                b5 = -0.7616 * b5 - w * 0.0168980;
                data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + w * 0.5362) * 0.11;
            }
        }
        const noiseSource = audioCtx.createBufferSource();
        noiseSource.buffer = buffer; noiseSource.loop = true;

        const bassShelf = audioCtx.createBiquadFilter();
        bassShelf.type = 'lowshelf'; bassShelf.frequency.value = 300; bassShelf.gain.value = 6;
        const midCut = audioCtx.createBiquadFilter();
        midCut.type = 'peaking'; midCut.frequency.value = 3000; midCut.Q.value = 0.7; midCut.gain.value = -8;
        const highCut = audioCtx.createBiquadFilter();
        highCut.type = 'lowpass'; highCut.frequency.value = 2800;

        rainGainNode = audioCtx.createGain(); rainGainNode.gain.value = 0.75;
        noiseSource.connect(bassShelf); bassShelf.connect(midCut); midCut.connect(highCut);
        highCut.connect(rainGainNode); rainGainNode.connect(masterGainNode);
        noiseSource.start(0);

        scheduleDroplets();

        // ---- Night Sounds Gain (starts muted) ----
        nightGainNode = audioCtx.createGain();
        nightGainNode.gain.value = 0;
        nightGainNode.connect(masterGainNode);

        // Start cricket/frog loops
        startNightAmbience();

        isAudioInitialized = true;
        scheduleThunder();
    }

    /* =========================================
       RAIN DROPLET PLINKS
       ========================================= */
    function scheduleDroplets() {
        if (!audioCtx) return;
        setTimeout(() => { playDroplet(); scheduleDroplets(); }, (Math.random() * 0.4 + 0.05) * 1000);
    }

    function playDroplet() {
        if (!audioCtx || audioCtx.state === 'suspended') return;
        const now = audioCtx.currentTime;
        const freq = Math.random() * 800 + 600;
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        const filt = audioCtx.createBiquadFilter();
        osc.type = 'sine'; osc.frequency.setValueAtTime(freq, now);
        osc.frequency.exponentialRampToValueAtTime(freq * 0.55, now + 0.12);
        filt.type = 'bandpass'; filt.frequency.value = freq * 0.9; filt.Q.value = 4;
        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.018, now + 0.006);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.12);
        osc.connect(filt); filt.connect(gain); gain.connect(masterGainNode);
        osc.start(now); osc.stop(now + 0.14);
    }

    /* =========================================
       NIGHT AMBIENCE: Crickets + Frogs
       ========================================= */
    function startNightAmbience() {
        if (!audioCtx) return;
        scheduleCricket();
        scheduleFrog();
    }

    function scheduleCricket() {
        if (!audioCtx) return;
        const delay = Math.random() * 0.18 + 0.04;
        setTimeout(() => {
            playCricketChirp();
            scheduleCricket();
        }, delay * 1000);
    }

    // Cricket: rapid, sharp sine pulses in pairs (chirp-chirp)
    function playCricketChirp() {
        if (!audioCtx || !nightGainNode) return;
        if (nightGainNode.gain.value < 0.01) return; // Don't waste CPU when muted
        const now = audioCtx.currentTime;
        const baseFreq = 3800 + Math.random() * 400; // Crickets sing at 3-5kHz
        const chirpCount = 2 + Math.floor(Math.random() * 2);

        for (let i = 0; i < chirpCount; i++) {
            const t = now + i * 0.055;
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            const filt = audioCtx.createBiquadFilter();

            osc.type = 'sine';
            osc.frequency.value = baseFreq;

            filt.type = 'bandpass';
            filt.frequency.value = baseFreq;
            filt.Q.value = 12;

            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.35, t + 0.008);
            gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.04);

            osc.connect(filt); filt.connect(gain); gain.connect(nightGainNode);
            osc.start(t); osc.stop(t + 0.045);
        }
    }

    function scheduleFrog() {
        if (!audioCtx) return;
        // Frogs call every 2-5 seconds
        const delay = Math.random() * 3000 + 2000;
        setTimeout(() => {
            playFrogCall();
            scheduleFrog();
        }, delay);
    }

    // Frog: low-pitched "ribbit" — frequency-modulated sine wave
    function playFrogCall() {
        if (!audioCtx || !nightGainNode) return;
        if (nightGainNode.gain.value < 0.01) return;
        const now = audioCtx.currentTime;
        const baseFreq = 200 + Math.random() * 80;

        const osc = audioCtx.createOscillator();
        const mod = audioCtx.createOscillator(); // FM modulator
        const modGain = audioCtx.createGain();
        const gain = audioCtx.createGain();
        const filt = audioCtx.createBiquadFilter();

        // FM synthesis: mod at ~12Hz for the ribbit wobble
        mod.type = 'sine'; mod.frequency.value = 12;
        modGain.gain.value = 80; // Modulation depth in Hz
        mod.connect(modGain); modGain.connect(osc.frequency);

        osc.type = 'sine'; osc.frequency.value = baseFreq;

        filt.type = 'bandpass'; filt.frequency.value = baseFreq * 1.2; filt.Q.value = 3;

        gain.gain.setValueAtTime(0, now);
        gain.gain.linearRampToValueAtTime(0.5, now + 0.06);
        gain.gain.setValueAtTime(0.5, now + 0.3);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.65);

        osc.connect(filt); filt.connect(gain); gain.connect(nightGainNode);

        mod.start(now); mod.stop(now + 0.7);
        osc.start(now); osc.stop(now + 0.7);
    }

    /* =========================================
       THUNDER (scheduled ambient)
       ========================================= */
    function scheduleThunder() {
        if (!isAudioInitialized) return;
        const delay = (Math.random() * 50 + 25) * 1000;
        setTimeout(() => {
            if (isThunderEnabled && !prefersReducedMotion) triggerLightning(true);
            scheduleThunder();
        }, delay);
    }

    /* =========================================
       LIGHTNING STRIKE (touch-triggered + thunder)
       ========================================= */
    function triggerLightning(isAmbient = false) {
        if (!audioCtx) return;
        if (audioCtx.state === 'suspended') audioCtx.resume();

        // Visual flash
        lightningOverlay.classList.remove('strike');
        void lightningOverlay.offsetWidth; // reflow to restart animation
        lightningOverlay.classList.add('strike');
        setTimeout(() => lightningOverlay.classList.remove('strike'), 600);

        // Audio thunder
        playThunderSound(isAmbient);
    }

    function playThunderSound(isAmbient = false) {
        if (!audioCtx) return;
        const now = audioCtx.currentTime;

        // Noise buffer for thunder
        const bufSize = audioCtx.sampleRate * 5;
        const buf = audioCtx.createBuffer(1, bufSize, audioCtx.sampleRate);
        const data = buf.getChannelData(0);
        let b0 = 0, b1 = 0;
        for (let i = 0; i < bufSize; i++) {
            const w = Math.random() * 2 - 1;
            b0 = 0.99 * b0 + w * 0.04;
            b1 = 0.97 * b1 + w * 0.08;
            data[i] = (b0 + b1) * 0.5;
        }

        const tSource = audioCtx.createBufferSource();
        tSource.buffer = buf;
        const tFilter = audioCtx.createBiquadFilter();
        tFilter.type = 'lowpass'; tFilter.frequency.value = 120; tFilter.Q.value = 0.5;
        const tGain = audioCtx.createGain();

        if (isAmbient) {
            // Distant: quieter crack, long rumble
            tGain.gain.setValueAtTime(0, now);
            tGain.gain.linearRampToValueAtTime(0.4, now + 0.08);
            tGain.gain.exponentialRampToValueAtTime(0.05, now + 1.5);
            tGain.gain.exponentialRampToValueAtTime(0.0001, now + 4.5);
        } else {
            // Close: sharp crack, intense rumble
            tGain.gain.setValueAtTime(0, now);
            tGain.gain.linearRampToValueAtTime(0.85, now + 0.04);
            tGain.gain.setValueAtTime(0.85, now + 0.04);
            tGain.gain.exponentialRampToValueAtTime(0.12, now + 0.8);
            tGain.gain.exponentialRampToValueAtTime(0.0001, now + 3.5);
        }

        tSource.connect(tFilter); tFilter.connect(tGain); tGain.connect(masterGainNode);
        tSource.start(now); tSource.stop(now + 5);
    }

    /* =========================================
       TOUCH / CLICK → LIGHTNING
       ========================================= */
    roomContainer.addEventListener('pointerdown', (e) => {
        // Don't trigger from settings interactions
        if (e.target.closest('#settings-panel') || e.target.closest('.room-header')) return;

        // Init audio on first interaction
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();

        if (lightningCooldown) return;
        lightningCooldown = true;
        triggerLightning(false);
        setTimeout(() => { lightningCooldown = false; }, 1200);
    });

    /* =========================================
       UI INTERACTIONS
       ========================================= */
    setTimeout(() => {
        if (initialMessage) initialMessage.classList.add('fade-out');
    }, 4000);

    settingsToggle.addEventListener('click', () => {
        const isExpanded = settingsToggle.getAttribute('aria-expanded') === 'true';
        settingsToggle.setAttribute('aria-expanded', !isExpanded);
        settingsPanel.classList.toggle('hidden');
        if (!isExpanded) {
            initAudio();
            if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        }
    });

    document.addEventListener('click', (e) => {
        if (!settingsPanel.contains(e.target) && !settingsToggle.contains(e.target)) {
            settingsPanel.classList.add('hidden');
            settingsToggle.setAttribute('aria-expanded', 'false');
        }
    });

    volumeControl.addEventListener('input', (e) => {
        volumeLevel = parseInt(e.target.value) / 100;
        initAudio();
        if (masterGainNode && audioCtx) {
            masterGainNode.gain.setTargetAtTime(volumeLevel * 0.55, audioCtx.currentTime, 0.1);
        }
    });

    thunderToggle.addEventListener('click', () => {
        isThunderEnabled = !isThunderEnabled;
        thunderToggle.setAttribute('aria-pressed', isThunderEnabled);
        thunderToggle.textContent = isThunderEnabled ? 'ON' : 'OFF';
        initAudio();
    });

    nightSoundsToggle.addEventListener('click', () => {
        isNightSoundsEnabled = !isNightSoundsEnabled;
        nightSoundsToggle.setAttribute('aria-pressed', isNightSoundsEnabled);
        nightSoundsToggle.textContent = isNightSoundsEnabled ? 'ON' : 'OFF';
        initAudio();
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        if (nightGainNode) {
            const targetGain = isNightSoundsEnabled ? 0.45 : 0;
            nightGainNode.gain.setTargetAtTime(targetGain, audioCtx.currentTime, 0.5);
        }
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
