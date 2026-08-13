document.addEventListener('DOMContentLoaded', () => {
    /* =========================================
       DOM ELEMENTS & CONFIG
       ========================================= */
    const canvas = document.getElementById('stars-canvas');
    const ctx = canvas.getContext('2d');
    const starsLayer = document.getElementById('interactive-stars-layer');
    const soundToggle = document.getElementById('sound-toggle');
    const initialMessage = document.getElementById('initial-message');

    let prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let width, height;
    let starsBg = [];
    let animationId = null;
    const INTERACTIVE_STAR_COUNT = 18;
    const interactiveStars = [];
    let isSoundEnabled = false;
    let audioCtx = null;

    /* =========================================
       CANVAS & BACKGROUND STARFIELD
       ========================================= */
    function resize() {
        width = window.innerWidth;
        height = window.innerHeight;
        const dpr = window.devicePixelRatio || 1;
        canvas.width = width * dpr;
        canvas.height = height * dpr;
        ctx.scale(dpr, dpr);
        starsBg.forEach(star => {
            star.x = Math.random() * width;
            star.y = Math.random() * height;
        });
    }

    function initBackgroundStars() {
        starsBg = [];
        // Three layers: tiny distant stars, medium stars, and a few bright foreground stars
        const tiers = [
            { count: 200, sizeRange: [0.3, 0.8], opacityRange: [0.15, 0.35], colorChance: 0.05 },
            { count: 80,  sizeRange: [0.8, 1.5], opacityRange: [0.3, 0.6],  colorChance: 0.15 },
            { count: 20,  sizeRange: [1.5, 2.5], opacityRange: [0.5, 0.85], colorChance: 0.35 },
        ];

        tiers.forEach(tier => {
            for (let i = 0; i < tier.count; i++) {
                const [sMin, sMax] = tier.sizeRange;
                const [oMin, oMax] = tier.opacityRange;
                const hasColor = Math.random() < tier.colorChance;
                // Subtle star colors: blue-white, warm yellow, cool blue
                const colorOptions = ['230,240,255', '255,248,220', '200,215,255', '255,240,200'];
                const color = hasColor
                    ? colorOptions[Math.floor(Math.random() * colorOptions.length)]
                    : '220,228,255';

                starsBg.push({
                    x: Math.random() * width,
                    y: Math.random() * height,
                    size: Math.random() * (sMax - sMin) + sMin,
                    baseOpacity: Math.random() * (oMax - oMin) + oMin,
                    opacity: 0,
                    twinkleSpeed: Math.random() * 0.018 + 0.004,
                    twinkleAngle: Math.random() * Math.PI * 2,
                    color
                });
            }
        });
    }

    let angleOffset = 0;
    const rotationSpeed = prefersReducedMotion ? 0 : 0.000035;

    function draw() {
        ctx.clearRect(0, 0, width, height);
        const centerX = width / 2;
        const centerY = height / 2;
        angleOffset += rotationSpeed;

        for (let i = 0; i < starsBg.length; i++) {
            const star = starsBg[i];
            const dx = star.x - centerX;
            const dy = star.y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const currentAngle = Math.atan2(dy, dx) + angleOffset;
            const renderX = centerX + Math.cos(currentAngle) * distance;
            const renderY = centerY + Math.sin(currentAngle) * distance;

            // Twinkle
            star.twinkleAngle += star.twinkleSpeed;
            const twinkle = Math.sin(star.twinkleAngle) * 0.2;
            star.opacity = Math.max(0.05, star.baseOpacity + twinkle);

            // Draw glow for larger stars
            if (star.size > 1.5) {
                const gradient = ctx.createRadialGradient(renderX, renderY, 0, renderX, renderY, star.size * 3);
                gradient.addColorStop(0, `rgba(${star.color}, ${star.opacity * 0.6})`);
                gradient.addColorStop(1, `rgba(${star.color}, 0)`);
                ctx.beginPath();
                ctx.arc(renderX, renderY, star.size * 3, 0, Math.PI * 2);
                ctx.fillStyle = gradient;
                ctx.fill();
            }

            ctx.beginPath();
            ctx.arc(renderX, renderY, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(${star.color}, ${star.opacity})`;
            ctx.fill();
        }

        animationId = requestAnimationFrame(draw);
    }

    /* =========================================
       INTERACTIVE DOM STARS
       ========================================= */
    function createInteractiveStars() {
        starsLayer.innerHTML = '';
        interactiveStars.length = 0;

        for (let i = 0; i < INTERACTIVE_STAR_COUNT; i++) {
            const starBtn = document.createElement('button');
            starBtn.className = 'interactive-star';
            starBtn.setAttribute('aria-label', 'Gaze at star');

            const dot = document.createElement('span');
            dot.className = 'star-dot';
            starBtn.appendChild(dot);

            const x = Math.random() * 80 + 10;
            const y = Math.random() * 80 + 10;
            starBtn.style.left = `${x}%`;
            starBtn.style.top = `${y}%`;

            starsLayer.appendChild(starBtn);

            const starObj = { element: starBtn, xPercent: x, yPercent: y };

            starBtn.addEventListener('click', () => triggerGlow(starObj));
            starBtn.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    triggerGlow(starObj);
                }
            });

            interactiveStars.push(starObj);
        }
    }

    function triggerGlow(star) {
        if (star.element.classList.contains('glowing')) return;
        star.element.classList.add('glowing');
        playStarSound();
        setTimeout(() => star.element.classList.remove('glowing'), 1800);
    }

    /* =========================================
       POINTER PROXIMITY (hover-glow effect)
       ========================================= */
    let mouseX = -9999;
    let mouseY = -9999;

    document.addEventListener('pointermove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        updateStarReactions();
    });

    document.addEventListener('pointerleave', () => {
        mouseX = -9999; mouseY = -9999;
        updateStarReactions();
    });

    function updateStarReactions() {
        if (prefersReducedMotion) return;
        interactiveStars.forEach(star => {
            const rect = star.element.getBoundingClientRect();
            const starX = rect.left + rect.width / 2;
            const starY = rect.top + rect.height / 2;
            const dx = mouseX - starX;
            const dy = mouseY - starY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = 140;

            if (dist < maxDist) {
                const factor = 1 - dist / maxDist;
                const scale = 1 + factor * 0.6;
                star.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
                star.element.querySelector('.star-dot').style.opacity = (0.7 + factor * 0.3).toString();
            } else {
                star.element.style.transform = 'translate(-50%, -50%) scale(1)';
                star.element.querySelector('.star-dot').style.opacity = '';
            }
        });
    }

    /* =========================================
       AUDIO SYNTHESIS - REALISTIC CRYSTAL CHIME
       
       Each star plays a harmonic-rich bell tone using:
       - Fundamental + harmonics (2nd, 3rd, 4th)
       - Convolution-style reverb via multiple delayed nodes
       - Long decay to simulate real metallic resonance
       ========================================= */
    function playStarSound() {
        if (!isSoundEnabled) return;

        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();

        const now = audioCtx.currentTime;

        // Pentatonic scale - harmonically pleasing star pitches
        const pentatonic = [
            261.63, 293.66, 329.63, 392.00, 440.00,
            523.25, 587.33, 659.25, 784.00, 880.00
        ];
        const fundamental = pentatonic[Math.floor(Math.random() * pentatonic.length)];

        // Create a master gain for this note
        const noteGain = audioCtx.createGain();
        noteGain.gain.value = 1;
        noteGain.connect(audioCtx.destination);

        // Generate harmonics (bell: fundamental + partials with inharmonicity)
        const partials = [
            { ratio: 1.0,    gain: 0.5,   decay: 2.2 },
            { ratio: 2.756,  gain: 0.28,  decay: 1.4 }, // 2nd partial (bell-like)
            { ratio: 5.404,  gain: 0.14,  decay: 0.9 }, // 3rd partial
            { ratio: 8.933,  gain: 0.07,  decay: 0.5 }, // 4th partial
            { ratio: 13.457, gain: 0.03,  decay: 0.3 }, // shimmer
        ];

        partials.forEach(partial => {
            const osc = audioCtx.createOscillator();
            const partialGain = audioCtx.createGain();

            osc.type = 'sine';
            osc.frequency.value = fundamental * partial.ratio;

            // Bell envelope: instant attack, exponential ring
            partialGain.gain.setValueAtTime(0, now);
            partialGain.gain.linearRampToValueAtTime(partial.gain * 0.12, now + 0.003);
            partialGain.gain.exponentialRampToValueAtTime(0.0001, now + partial.decay);

            osc.connect(partialGain);
            partialGain.connect(noteGain);

            osc.start(now);
            osc.stop(now + partial.decay + 0.05);
        });

        // Subtle reverb shimmer: delayed copies at low gain
        const delays = [0.08, 0.18, 0.32];
        delays.forEach((d, idx) => {
            const osc = audioCtx.createOscillator();
            const dGain = audioCtx.createGain();
            osc.type = 'sine';
            osc.frequency.value = fundamental;
            dGain.gain.setValueAtTime(0, now + d);
            dGain.gain.linearRampToValueAtTime(0.015 / (idx + 1), now + d + 0.003);
            dGain.gain.exponentialRampToValueAtTime(0.0001, now + d + 1.5);
            osc.connect(dGain);
            dGain.connect(noteGain);
            osc.start(now + d);
            osc.stop(now + d + 1.6);
        });
    }

    soundToggle.addEventListener('click', () => {
        isSoundEnabled = !isSoundEnabled;
        soundToggle.setAttribute('aria-pressed', isSoundEnabled);
        soundToggle.querySelector('.icon').textContent = isSoundEnabled ? '🔊' : '🔇';

        if (isSoundEnabled && !audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
        }
    });

    /* =========================================
       INITIALIZATION & CLEANUP
       ========================================= */
    setTimeout(() => {
        if (initialMessage) initialMessage.classList.add('fade-out');
    }, 3000);

    resize();
    initBackgroundStars();
    createInteractiveStars();
    draw();

    window.addEventListener('resize', () => {
        resize();
        createInteractiveStars();
    });

    window.addEventListener('pagehide', () => {
        if (animationId) cancelAnimationFrame(animationId);
        if (audioCtx) { audioCtx.close(); audioCtx = null; }
    });
});
