document.addEventListener('DOMContentLoaded', () => {
    const container = document.getElementById('bubble-container');
    const soundToggle = document.getElementById('sound-toggle');
    const modal = document.getElementById('completion-modal');
    const btnAgain = document.getElementById('btn-again');
    
    // Config
    const MAX_BUBBLES = 15; // Keep DOM nodes low
    const COMPLETION_THRESHOLD = 20; // Show modal after 20 pops
    let poppedCount = 0;
    let isSoundEnabled = false;
    let bubbles = [];
    let audioCtx = null;
    
    // Web Audio API for a soft pop (no external assets)
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
        
        // Very soft, low-frequency bubble sound
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(100, audioCtx.currentTime + 0.1);
        
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.02);
        gainNode.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
        
        osc.connect(gainNode);
        gainNode.connect(audioCtx.destination);
        
        osc.start();
        osc.stop(audioCtx.currentTime + 0.1);
    };

    // Toggle Sound
    soundToggle.addEventListener('click', () => {
        isSoundEnabled = !isSoundEnabled;
        soundToggle.setAttribute('aria-pressed', isSoundEnabled);
        soundToggle.querySelector('.icon').textContent = isSoundEnabled ? '🔊' : '🔇';
        
        // Initialize context on user interaction
        if (isSoundEnabled && !audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
    });

    // Helper: Random number in range
    const random = (min, max) => Math.random() * (max - min) + min;

    // Create a bubble
    const createBubble = () => {
        if (bubbles.length >= MAX_BUBBLES) return;

        const bubble = document.createElement('button');
        bubble.className = 'bubble';
        bubble.setAttribute('aria-label', 'Pop bubble');
        
        // Randomize properties
        const size = random(60, 180); // Large enough for touch targets
        const startX = random(10, 90); // vw
        const startY = random(10, 90); // vh
        
        bubble.style.width = `${size}px`;
        bubble.style.height = `${size}px`;
        bubble.style.left = `${startX}vw`;
        bubble.style.top = `${startY}vh`;
        
        // Set CSS vars for animation
        bubble.style.setProperty('--float-y', `${random(-150, 150)}px`);
        bubble.style.setProperty('--drift-x', `${random(-100, 100)}px`);
        bubble.style.setProperty('--float-duration', `${random(10, 25)}s`);
        bubble.style.setProperty('--drift-duration', `${random(8, 20)}s`);
        
        // Initial state for fade in
        bubble.style.opacity = '0';
        bubble.style.transform = 'scale(0.8)';
        
        container.appendChild(bubble);
        bubbles.push(bubble);
        
        // Fade in
        requestAnimationFrame(() => {
            bubble.style.opacity = random(0.3, 0.7).toString();
            bubble.style.transform = 'scale(1)';
        });

        // Interaction
        const pop = (e) => {
            if (e.type !== 'click' && (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ')) {
                return;
            }
            if (e.type === 'keydown') {
                e.preventDefault(); // Prevent scrolling on space
            }

            playPopSound();
            bubble.classList.add('popped');
            
            // Remove from array and DOM
            bubbles = bubbles.filter(b => b !== bubble);
            setTimeout(() => {
                if(bubble.parentNode) bubble.parentNode.removeChild(bubble);
                
                // Spawn a new one to replace it
                setTimeout(createBubble, random(500, 2000));
            }, 300);

            poppedCount++;
            
            // Check completion
            if (poppedCount === COMPLETION_THRESHOLD) {
                showCompletion();
            }
        };

        bubble.addEventListener('click', pop);
        bubble.addEventListener('keydown', pop);
    };

    const showCompletion = () => {
        modal.classList.remove('hidden');
        // We don't remove bubbles, they just keep floating softly behind
    };

    const resetRoom = () => {
        poppedCount = 0;
        modal.classList.add('hidden');
    };

    btnAgain.addEventListener('click', resetRoom);

    // Initial spawn
    const init = () => {
        // Stagger spawn
        for (let i = 0; i < MAX_BUBBLES; i++) {
            setTimeout(createBubble, i * random(300, 800));
        }
    };

    init();
    
    // Cleanup on page hide (back/forward cache)
    window.addEventListener('pagehide', () => {
        if (audioCtx) {
            audioCtx.close();
            audioCtx = null;
        }
    });
});
