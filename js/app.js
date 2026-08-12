document.addEventListener('DOMContentLoaded', () => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ============================================================
       1. AMBIENT CANVAS — slowly drifting motes of light
       ============================================================ */
    const canvas  = document.getElementById('ambient-canvas');
    if (canvas) {
        const ctx = canvas.getContext('2d');
        let W, H, particles = [];

        const PARTICLE_COUNT = 55;

        function resize() {
            W = canvas.width  = window.innerWidth;
            H = canvas.height = window.innerHeight;
        }

        function createParticle() {
            return {
                x:     Math.random() * W,
                y:     Math.random() * H,
                r:     Math.random() * 1.6 + 0.3,
                alpha: Math.random() * 0.35 + 0.05,
                vx:    (Math.random() - 0.5) * 0.18,
                vy:    -(Math.random() * 0.12 + 0.04),
                life:  Math.random() * 300 + 200,
                age:   0,
            };
        }

        function initParticles() {
            particles = [];
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                const p = createParticle();
                p.age = Math.floor(Math.random() * p.life); // stagger start
                particles.push(p);
            }
        }

        function drawParticles() {
            ctx.clearRect(0, 0, W, H);

            // Radial vignette-like glow at center for depth
            const grad = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * 0.65);
            grad.addColorStop(0,   'rgba(100, 90, 140, 0.04)');
            grad.addColorStop(1,   'rgba(0, 0, 0, 0)');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, W, H);

            particles.forEach((p, i) => {
                const fade = Math.min(p.age / 60, 1) * Math.min((p.life - p.age) / 60, 1);
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
                ctx.fillStyle = `rgba(200, 195, 230, ${p.alpha * fade})`;
                ctx.fill();

                p.x   += p.vx;
                p.y   += p.vy;
                p.age += 1;

                if (p.age >= p.life) {
                    particles[i] = createParticle();
                    particles[i].x = Math.random() * W;
                    particles[i].y = H + 4;
                }
            });
        }

        let animId;
        function loop() {
            drawParticles();
            animId = requestAnimationFrame(loop);
        }

        if (!prefersReducedMotion) {
            resize();
            initParticles();
            loop();
            window.addEventListener('resize', () => { resize(); initParticles(); });
        }
    }

    /* ============================================================
       2. NAV — add glass blur when scrolled
       ============================================================ */
    const nav = document.getElementById('main-nav');
    if (nav) {
        const onScroll = () => {
            nav.classList.toggle('scrolled', window.scrollY > 40);
        };
        window.addEventListener('scroll', onScroll, { passive: true });
    }

    /* ============================================================
       3. SCROLL REVEAL
       ============================================================ */
    const revealEls = document.querySelectorAll('.scroll-reveal');
    if (!prefersReducedMotion && revealEls.length) {
        const obs = new IntersectionObserver((entries) => {
            entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); });
        }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
        revealEls.forEach(el => obs.observe(el));
    } else {
        revealEls.forEach(el => el.classList.add('visible'));
    }

    /* ============================================================
       4. SURPRISE ME — pick a random room
       ============================================================ */
    const rooms = [
        'rooms/bubbles.html',
        'rooms/rain.html',
        'rooms/doodle.html',
        'rooms/stars.html',
    ];

    function goSurprise(e) {
        e.preventDefault();
        const dest = rooms[Math.floor(Math.random() * rooms.length)];
        window.location.href = dest;
    }

    document.getElementById('btn-surprise-hero')?.addEventListener('click', goSurprise);
    document.getElementById('nav-surprise')?.addEventListener('click', goSurprise);

    /* ============================================================
       5. MOBILE MENU
       ============================================================ */
    const menuToggle = document.getElementById('menu-toggle');
    const navLinks   = document.getElementById('nav-links');

    if (menuToggle && navLinks) {
        menuToggle.addEventListener('click', () => {
            const open = navLinks.classList.toggle('active');
            menuToggle.setAttribute('aria-expanded', String(open));
            // Animate hamburger into X
            const bar = menuToggle.querySelector('.hamburger');
            if (open) {
                bar.style.background = 'transparent';
                bar.style.setProperty('--before-t', 'translateY(8px) rotate(45deg)');
                bar.style.setProperty('--after-t',  'translateY(-8px) rotate(-45deg)');
            } else {
                bar.style.background = '';
            }
        });

        // Close on link click
        navLinks.querySelectorAll('a').forEach(a => {
            a.addEventListener('click', () => {
                navLinks.classList.remove('active');
                menuToggle.setAttribute('aria-expanded', 'false');
            });
        });
    }

    /* ============================================================
       6. ROOM CARD — subtle mouse parallax glow
       ============================================================ */
    if (!prefersReducedMotion) {
        document.querySelectorAll('.room-card').forEach(card => {
            card.addEventListener('mousemove', (e) => {
                const rect = card.getBoundingClientRect();
                const x = ((e.clientX - rect.left) / rect.width)  * 100;
                const y = ((e.clientY - rect.top)  / rect.height) * 100;
                card.querySelector('.room-card-glow').style.background =
                    `radial-gradient(circle at ${x}% ${y}%, rgba(255,255,255,0.07), transparent 65%)`;
            });
            card.addEventListener('mouseleave', () => {
                card.querySelector('.room-card-glow').style.background = '';
            });
        });
    }
});
