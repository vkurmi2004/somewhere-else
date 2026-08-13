document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('bubble-container');
    const soundToggle = document.getElementById('sound-toggle');
    const modal = document.getElementById('completion-modal');
    const btnAgain = document.getElementById('btn-again');
    
    // Config
    const MAX_BUBBLES = 15;
    const COMPLETION_THRESHOLD = 20;
    let poppedCount = 0;
    let isSoundEnabled = false;
    let bubbles = [];
    let audioCtx = null;
    
    // Web Audio API for a soft, warm bubble pop
    const playPopSound = () => {
        if (!isSoundEnabled) return;
        
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
        
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }

        const osc = audioCtx.createOscillator();
        const gainNode = audioCtx.createGain();
        
        // Soft sine wave pop with low pitch drop
        osc.type = 'sine';
        osc.frequency.setValueAtTime(220, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(70, audioCtx.currentTime + 0.12);
        
        // Very soft, non-jarring volume envelope
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.025, audioCtx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.12);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.12);
    };

    // Toggle Sound
    soundToggle.addEventListener('click', () => {
        isSoundEnabled = !isSoundEnabled;
        soundToggle.setAttribute('aria-pressed', isSoundEnabled);
        soundToggle.querySelector('.icon').textContent = isSoundEnabled ? '🔊' : '🔇';
        
        if (isSoundEnabled && !audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            if (audioCtx.state === 'suspended') audioCtx.resume();
        }
    });

    const random = (min, max) => Math.random() * (max - min) + min;

    const createBubble = () => {
        if (bubbles.length >= MAX_BUBBLES) return;

        const bubble = document.createElement('button');
        bubble.className = 'bubble';
        bubble.setAttribute('aria-label', 'Pop bubble');
        
        const size = random(60, 180);
        const startX = random(10, 90);
        const startY = random(10, 90);
        
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${startX}vw`;
        bubble.style.top = `${startY}vh`;
        
        bubble.style.setProperty('--float-y', `${random(-150, 150)}px`);
        bubble.style.setProperty('--drift-x', `${random(-100, 100)}px`);
        bubble.style.setProperty('--float-duration', `${random(10, 25)}s`);
        bubble.style.setProperty('--drift-duration', `${random(8, 20)}s`);
        
        bubble.style.opacity = '0';
        bubble.style.transform = 'scale(0.8)';
        
        container.appendChild(bubble);
        bubbles.push(bubble);
        
        requestAnimationFrame(() => {
            bubble.style.opacity = random(0.3, 0.7).toString();
            bubble.style.transform = 'scale(1)';
        });

        const pop = (e) => {
            if (e.type !== 'click' && (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ')) {
                return;
            }
            if (e.type === 'keydown') {
                e.preventDefault();
            }

            playPopSound();
            bubble.classList.add('popped');
            
            bubbles = bubbles.filter(b => b !== bubble);
            setTimeout(() => {
                if(bubble.parentNode) bubble.parentNode.removeChild(bubble);
                setTimeout(createBubble, random(500, 2000));
            }, 300);

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
            setTimeout(createBubble, i * random(300, 800));
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
