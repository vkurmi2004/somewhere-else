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

    // Dimensions
    let width, height;
    let starsBg = [];
    let animationId = null;

    // Interactive Stars setup
    const INTERACTIVE_STAR_COUNT = 15; // Controlled density
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
        
        // Re-distribute background stars relative to new size
        starsBg.forEach(star => {
            star.x = Math.random() * width;
            star.y = Math.random() * height;
        });
    }

    function initBackgroundStars() {
        starsBg = [];
        const count = 100; // Faint background stars
        
        for (let i = 0; i < count; i++) {
            starsBg.push({
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 1.2 + 0.3,
                baseOpacity: Math.random() * 0.4 + 0.1,
                opacity: 0,
                speed: Math.random() * 0.02 + 0.005,
                angle: Math.random() * Math.PI * 2
            });
        }
    }

    // Sky rotation axis coordinates (center of screen)
    let angleOffset = 0;
    const rotationSpeed = prefersReducedMotion ? 0 : 0.0001; // Extremely slow rotate

    function draw() {
        ctx.clearRect(0, 0, width, height);
        
        const centerX = width / 2;
        const centerY = height / 2;
        
        angleOffset += rotationSpeed;

        for (let i = 0; i < starsBg.length; i++) {
            const star = starsBg[i];
            
            // Calculate rotated positions to simulate slow celestial drift
            const dx = star.x - centerX;
            const dy = star.y - centerY;
            const distance = Math.sqrt(dx * dx + dy * dy);
            const currentAngle = Math.atan2(dy, dx) + angleOffset;
            
            const renderX = centerX + Math.cos(currentAngle) * distance;
            const renderY = centerY + Math.sin(currentAngle) * distance;

            // Twinkle effect (periodic opacity changes)
            star.angle += star.speed;
            const twinkle = Math.sin(star.angle) * 0.15;
            star.opacity = Math.max(0.05, star.baseOpacity + twinkle);

            ctx.beginPath();
            ctx.arc(renderX, renderY, star.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(224, 216, 204, ${star.opacity})`;
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
            
            // Position randomly, avoiding edges
            const x = Math.random() * 80 + 10; // 10% to 90%
            const y = Math.random() * 80 + 10;
            
            starBtn.style.left = `${x}%`;
            starBtn.style.top = `${y}%`;

            starsLayer.appendChild(starBtn);
            
            const starObj = {
                element: starBtn,
                xPercent: x,
                yPercent: y,
                baseScale: 1
            };

            // Interactions
            starBtn.addEventListener('click', () => triggerGlow(starObj));
            
            interactiveStars.push(starObj);
        }
    }

    function triggerGlow(star) {
        if (star.element.classList.contains('glowing')) return;

        star.element.classList.add('glowing');
        playStarSound();
        
        // Glow effect fades out over 1.5 seconds
        setTimeout(() => {
            star.element.classList.remove('glowing');
        }, 1500);
    }

    /* =========================================
       POINTER RESPONSIVENESS (Move → scale)
       ========================================= */
    let mouseX = -1000;
    let mouseY = -1000;

    document.addEventListener('pointermove', (e) => {
        mouseX = e.clientX;
        mouseY = e.clientY;
        updateStarReactions();
    });

    document.addEventListener('pointerleave', () => {
        // Reset scale when pointer leaves the screen
        mouseX = -1000;
        mouseY = -1000;
        updateStarReactions();
    });

    function updateStarReactions() {
        if (prefersReducedMotion) return; // Skip dynamic scaling for reduced motion

        interactiveStars.forEach(star => {
            const rect = star.element.getBoundingClientRect();
            const starX = rect.left + rect.width / 2;
            const starY = rect.top + rect.height / 2;
            
            const dx = mouseX - starX;
            const dy = mouseY - starY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            // Interaction radius: 120px
            const maxDist = 120;
            if (dist < maxDist) {
                // Scale up when cursor is close (up to 1.5x)
                const factor = 1 - (dist / maxDist);
                const scale = 1 + factor * 0.4;
                star.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
                star.element.querySelector('.star-dot').style.opacity = (0.6 + factor * 0.4).toString();
            } else {
                star.element.style.transform = 'translate(-50%, -50%) scale(1)';
                star.element.querySelector('.star-dot').style.opacity = '';
            }
        });
    }

    /* =========================================
       AUDIO SYNTHESIS (Star Twinkle Bell)
       ========================================= */
    function playStarSound() {
        if (!isSoundEnabled) return;

        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }

        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        const highpass = audioCtx.createBiquadFilter();

        // High frequency soft sine/triangle for glass sound
        osc.type = 'triangle';
        // Random pentatonic frequencies: F5, G5, A5, C6, D6
        const freqs = [698.46, 783.99, 880.00, 1046.50, 1174.66];
        const pitch = freqs[Math.floor(Math.random() * freqs.length)];
        osc.frequency.setValueAtTime(pitch, audioCtx.currentTime);

        highpass.type = 'highpass';
        highpass.frequency.value = 500;

        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        // Instant attack
        gainNode.gain.linearRampToValueAtTime(0.06, audioCtx.currentTime + 0.01);
        // Long ring decay
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.2);

        osc.connect(highpass);
        highpass.connect(gainNode);
        gainNode.connect(audioCtx.destination);

        osc.start();
        osc.stop(audioCtx.currentTime + 1.2);
    }

    soundToggle.addEventListener('click', () => {
        isSoundEnabled = !isSoundEnabled;
        soundToggle.setAttribute('aria-pressed', isSoundEnabled);
        soundToggle.querySelector('.icon').textContent = isSoundEnabled ? '🔊' : '🔇';
        
        if (isSoundEnabled && !audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    });

    /* =========================================
       INITIALIZATION & CLEANUP
       ========================================= */
    // Fade out message
    setTimeout(() => {
        initialMessage.classList.remove('fade-in');
        initialMessage.classList.add('fade-out');
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
        if (audioCtx) {
            audioCtx.close();
            audioCtx = null;
        }
    });
});
