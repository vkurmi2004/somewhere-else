document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('bubble-container');
    const soundToggle = document.getElementById('sound-toggle');
    const modal = document.getElementById('completion-modal');
    const btnAgain = document.getElementById('btn-again');
    
    // Config
    const MAX_BUBBLES = 16;
    const COMPLETION_THRESHOLD = 20;
    let poppedCount = 0;
    let isSoundEnabled = true; // Enabled by default for rich feel
    let bubbles = [];
    let audioCtx = null;
    
    // Web Audio API for a realistic, resonant water-bubble pop sound
    const playPopSound = (bubbleSize) => {
        if (!isSoundEnabled) return;
        
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const now = audioCtx.currentTime;
        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        const filter = audioCtx.createBiquadFilter();
        
        // Pitch inversely proportional to bubble size (smaller = higher pitch, larger = deeper pop)
        const baseFreq = 650 - Math.min(bubbleSize, 180) * 2.5; 
        const endFreq = baseFreq * 1.8;

        osc.type = 'sine';
        osc.frequency.setValueAtTime(baseFreq, now);
        osc.frequency.exponentialRampToValueAtTime(endFreq, now + 0.04);
        osc.frequency.exponentialRampToValueAtTime(baseFreq * 0.5, now + 0.14);

        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(baseFreq * 1.2, now);
        filter.Q.value = 3.5;

        gainNode.gain.setValueAtTime(0, now);
        gainNode.gain.linearRampToValueAtTime(0.18, now + 0.015);
        gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
        
        osc.connect(filter);
        filter.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start(now);
        osc.stop(now + 0.14);
    };

    // Toggle Sound
    if (soundToggle) {
        soundToggle.addEventListener('click', () => {
            isSoundEnabled = !isSoundEnabled;
            soundToggle.setAttribute('aria-pressed', isSoundEnabled);
            soundToggle.querySelector('.icon').textContent = isSoundEnabled ? '🔊' : '🔇';
            
            if (isSoundEnabled && !audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
                if (audioCtx.state === 'suspended') audioCtx.resume();
            }
        });
    }

    const random = (min, max) => Math.random() * (max - min) + min;

    const createBubble = () => {
        if (bubbles.length >= MAX_BUBBLES) return;

        const bubble = document.createElement('button');
        bubble.className = 'bubble';
        bubble.setAttribute('aria-label', 'Pop bubble');
        
        const size = random(70, 190);
        const startX = random(10, 88);
        const startY = random(10, 88);
        
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${startX}vw`;
        bubble.style.top = `${startY}vh`;
        
        bubble.style.setProperty('--float-y', `${random(-160, 160)}px`);
        bubble.style.setProperty('--drift-x', `${random(-120, 120)}px`);
        bubble.style.setProperty('--float-duration', `${random(12, 24)}s`);
        bubble.style.setProperty('--drift-duration', `${random(9, 18)}s`);
        
        bubble.style.opacity = '0';
        bubble.style.transform = 'scale(0.8)';
        
        container.appendChild(bubble);
        bubbles.push(bubble);
        
        requestAnimationFrame(() => {
            bubble.style.opacity = random(0.5, 0.9).toString();
            bubble.style.transform = 'scale(1)';
        });

        const pop = (e) => {
            if (e.type !== 'click' && (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ')) {
                return;
            }
            if (e.type === 'keydown') {
                e.preventDefault();
            }

            playPopSound(size);
            bubble.classList.add('popped');
            
            bubbles = bubbles.filter(b => b !== bubble);
            setTimeout(() => {
                if(bubble.parentNode) bubble.parentNode.removeChild(bubble);
                setTimeout(createBubble, random(400, 1600));
            }, 250);

            poppedCount++;
            
            if (poppedCount === COMPLETION_THRESHOLD) {
                showCompletion();
            }
        };

        bubble.addEventListener('click', pop);
        bubble.addEventListener('keydown', pop);
    };

    const showCompletion = () => {
        if (modal) modal.classList.remove('hidden');
    };

    const resetRoom = () => {
        poppedCount = 0;
        if (modal) modal.classList.add('hidden');
    };

    if (btnAgain) btnAgain.addEventListener('click', resetRoom);

    const init = () => {
        for (let i = 0; i < MAX_BUBBLES; i++) {
            setTimeout(createBubble, i * random(250, 650));
        }
    };

    init();
    
    window.addEventListener('pagehide', () => {
        if (audioCtx) {
            audioCtx.close();
            audioCtx = null;
        }
    });
});
