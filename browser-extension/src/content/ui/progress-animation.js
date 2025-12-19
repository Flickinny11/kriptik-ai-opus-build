// Progress Animation - Canvas-based sci-fi progress visualization

class ProgressAnimation {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.animationId = null;
        this.isAnimating = false;

        // Animation state
        this.progress = 0;
        this.targetProgress = 0;
        this.currentPhase = null;
        this.particles = [];
        this.rotation = 0;

        // Setup canvas
        this.setupCanvas();
        this.initParticles();
    }

    /**
     * Setup canvas dimensions
     */
    setupCanvas() {
        const size = 200;
        this.canvas.width = size;
        this.canvas.height = size;
        this.centerX = size / 2;
        this.centerY = size / 2;
        this.radius = size / 2 - 20;
    }

    /**
     * Initialize particles
     */
    initParticles() {
        for (let i = 0; i < 30; i++) {
            this.particles.push({
                angle: Math.random() * Math.PI * 2,
                speed: 0.01 + Math.random() * 0.02,
                distance: this.radius + Math.random() * 20,
                alpha: 0.3 + Math.random() * 0.7,
                size: 1 + Math.random() * 2
            });
        }
    }

    /**
     * Start animation loop
     */
    start() {
        if (this.isAnimating) return;
        this.isAnimating = true;
        this.animate();
    }

    /**
     * Stop animation loop
     */
    stop() {
        this.isAnimating = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Main animation loop
     */
    animate() {
        if (!this.isAnimating) return;

        this.update();
        this.draw();

        this.animationId = requestAnimationFrame(() => this.animate());
    }

    /**
     * Update animation state
     */
    update() {
        // Smooth progress interpolation
        const diff = this.targetProgress - this.progress;
        this.progress += diff * 0.1;

        // Update rotation
        this.rotation += 0.005;

        // Update particles
        this.particles.forEach(p => {
            p.angle += p.speed;
            if (p.angle > Math.PI * 2) p.angle -= Math.PI * 2;
        });
    }

    /**
     * Draw the progress visualization
     */
    draw() {
        const ctx = this.ctx;

        // Clear canvas
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Get current phase color
        const phase = this.currentPhase ? CapturePhases.getPhase(this.currentPhase) : null;
        const color = phase ? phase.color : '#00ffff';
        const glowColor = phase ? phase.glowColor : 'rgba(0, 255, 255, 0.5)';

        // Draw background ring
        this.drawRing(this.centerX, this.centerY, this.radius, '#222222', 8);

        // Draw progress arc
        this.drawProgressArc(this.centerX, this.centerY, this.radius, color, glowColor);

        // Draw particles
        this.drawParticles(color);

        // Draw center circle
        this.drawCenterCircle(color, glowColor);

        // Draw rotating segments
        this.drawRotatingSegments(color);

        // Draw progress percentage
        this.drawProgressText(color);
    }

    /**
     * Draw a ring
     */
    drawRing(x, y, radius, color, lineWidth) {
        this.ctx.beginPath();
        this.ctx.arc(x, y, radius, 0, Math.PI * 2);
        this.ctx.strokeStyle = color;
        this.ctx.lineWidth = lineWidth;
        this.ctx.stroke();
    }

    /**
     * Draw progress arc
     */
    drawProgressArc(x, y, radius, color, glowColor) {
        const ctx = this.ctx;
        const endAngle = (this.progress / 100) * Math.PI * 2 - Math.PI / 2;

        // Glow effect
        ctx.shadowBlur = 20;
        ctx.shadowColor = glowColor;

        // Draw arc
        ctx.beginPath();
        ctx.arc(x, y, radius, -Math.PI / 2, endAngle);
        ctx.strokeStyle = color;
        ctx.lineWidth = 8;
        ctx.lineCap = 'round';
        ctx.stroke();

        // Reset shadow
        ctx.shadowBlur = 0;
    }

    /**
     * Draw particles
     */
    drawParticles(color) {
        const ctx = this.ctx;

        this.particles.forEach(p => {
            const x = this.centerX + Math.cos(p.angle) * p.distance;
            const y = this.centerY + Math.sin(p.angle) * p.distance;

            ctx.fillStyle = color + Math.floor(p.alpha * 255).toString(16).padStart(2, '0');
            ctx.beginPath();
            ctx.arc(x, y, p.size, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /**
     * Draw center circle
     */
    drawCenterCircle(color, glowColor) {
        const ctx = this.ctx;
        const innerRadius = this.radius * 0.6;

        // Glow
        ctx.shadowBlur = 30;
        ctx.shadowColor = glowColor;

        // Outer circle
        ctx.beginPath();
        ctx.arc(this.centerX, this.centerY, innerRadius, 0, Math.PI * 2);
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.stroke();

        // Inner fill with gradient
        const gradient = ctx.createRadialGradient(
            this.centerX, this.centerY, 0,
            this.centerX, this.centerY, innerRadius
        );
        gradient.addColorStop(0, color + '20');
        gradient.addColorStop(1, color + '00');

        ctx.fillStyle = gradient;
        ctx.fill();

        ctx.shadowBlur = 0;
    }

    /**
     * Draw rotating segments
     */
    drawRotatingSegments(color) {
        const ctx = this.ctx;
        const segmentRadius = this.radius * 0.5;

        for (let i = 0; i < 6; i++) {
            const angle = this.rotation + (i * Math.PI / 3);
            const x1 = this.centerX + Math.cos(angle) * segmentRadius;
            const y1 = this.centerY + Math.sin(angle) * segmentRadius;
            const x2 = this.centerX + Math.cos(angle) * (segmentRadius + 10);
            const y2 = this.centerY + Math.sin(angle) * (segmentRadius + 10);

            ctx.beginPath();
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.strokeStyle = color + '80';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    }

    /**
     * Draw progress percentage text
     */
    drawProgressText(color) {
        const ctx = this.ctx;
        const text = Math.floor(this.progress) + '%';

        ctx.font = 'bold 28px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = color;
        ctx.shadowBlur = 10;
        ctx.shadowColor = color;
        ctx.fillText(text, this.centerX, this.centerY);
        ctx.shadowBlur = 0;
    }

    /**
     * Set target progress
     * @param {number} progress - Progress percentage (0-100)
     */
    setProgress(progress) {
        this.targetProgress = Math.max(0, Math.min(100, progress));
    }

    /**
     * Set current phase
     * @param {string} phaseId - Phase ID
     */
    setPhase(phaseId) {
        this.currentPhase = phaseId;
    }

    /**
     * Reset animation
     */
    reset() {
        this.progress = 0;
        this.targetProgress = 0;
        this.currentPhase = null;
        this.rotation = 0;
    }
}

window.ProgressAnimation = ProgressAnimation;
