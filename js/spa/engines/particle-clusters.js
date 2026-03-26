// Lightweight Particle Cluster System for Social Media Buttons
// Optimized for performance on low-end devices

document.addEventListener("DOMContentLoaded", () => {
  // Define color schemes for each platform based on their brand colors
  const platformColors = {
    tiktok: ["#00F2EA", "#FF0050", "#000000"], // Teal, Pink, Black
    instagram: ["#C13584", "#E1306C", "#F56040", "#FCAF45", "#FFDC80"], // Instagram gradient colors
    spotify: ["#1DB954", "#191414"], // Green, Black
    applemusic: ["#FC3C44", "#FA243C", "#FFFFFF"], // Red, White
    youtube: ["#FF0000", "#282828", "#FFFFFF"], // Red, Dark Gray, White
    bandcamp: ["#629AA9", "#1DA0C3", "#FFFFFF"], // Blue tones
    soundcloud: ["#FF5500", "#FF7700", "#FFAA00"], // Orange tones
    gallery: ["#FF0000", "#FF7F00", "#FFFF00", "#00FF00", "#0000FF", "#4B0082", "#9400D3"], // Rainbow explosion colors
    galleryLocked: ["#888888"], // Single gray particle when locked
    journal: ["#6dd9e8", "#5ee87d", "#FFFFFF"] // Terminal green/cyan theme
  };

  // Particle system configuration
  const config = {
    particleCount: 25, // Low count for performance
    particleSize: { min: 2, max: 5 },
    speed: 0.3,
    connectionDistance: 60,
    mouseRepelDistance: 80,
    mouseRepelForce: 0.5,
    springBackForce: 0.02, // Force to pull particles back to original position
    springBackThreshold: 1, // Minimum distance before applying spring force
    damping: 0.98, // Velocity damping for smoother motion
    defaultCanvasSize: 140, // Fallback size when layout dimensions unavailable
    layoutDelayMs: 100 // Delay for async layout recalculation
  };

  // Initialize particle clusters for each platform button
  function initParticleCluster(canvas, platformKey) {
    const ctx = canvas.getContext("2d", { alpha: true });
    
    // Special handling for gallery button - check if unlocked
    let colors;
    let particleCount = config.particleCount;
    
    if (platformKey === 'gallery') {
      const isUnlocked = localStorage.getItem("galleryUnlocked") === "true";
      if (isUnlocked) {
        colors = platformColors.gallery; // Rainbow explosion particles
      } else {
        colors = platformColors.galleryLocked; // Single gray particle
        particleCount = 1; // Only one particle when locked
      }
    } else {
      colors = platformColors[platformKey] || platformColors.gallery;
    }
    
    const particles = [];
    const mouse = { x: null, y: null, active: false };
    let animationId = null;
    let isVisible = false;

    // Set canvas size to match container
    function resizeCanvas() {
      const rect = canvas.getBoundingClientRect();
      // Ensure we have valid dimensions (not 0) - fallback prevents squished particles on initial load
      const width = rect.width || canvas.parentElement?.offsetWidth || config.defaultCanvasSize;
      const height = rect.height || canvas.parentElement?.offsetHeight || config.defaultCanvasSize;
      canvas.width = width;
      canvas.height = height;
    }

    // Create a particle
    function createParticle() {
      const angle = Math.random() * Math.PI * 2;
      const distance = Math.random() * Math.min(canvas.width, canvas.height) * 0.3;
      const centerX = canvas.width / 2;
      const centerY = canvas.height / 2;
      
      return {
        x: centerX + Math.cos(angle) * distance,
        y: centerY + Math.sin(angle) * distance,
        vx: (Math.random() - 0.5) * config.speed,
        vy: (Math.random() - 0.5) * config.speed,
        radius: Math.random() * (config.particleSize.max - config.particleSize.min) + config.particleSize.min,
        color: colors[Math.floor(Math.random() * colors.length)],
        originalX: null,
        originalY: null
      };
    }

    // Initialize particles in a cluster
    function initParticles() {
      particles.length = 0;
      for (let i = 0; i < particleCount; i++) {
        const particle = createParticle();
        particle.originalX = particle.x;
        particle.originalY = particle.y;
        particles.push(particle);
      }
    }

    // Update particle positions
    function updateParticles() {
      particles.forEach(particle => {
        // Apply velocity
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Mouse repulsion effect
        if (mouse.active && mouse.x !== null && mouse.y !== null) {
          const dx = particle.x - mouse.x;
          const dy = particle.y - mouse.y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < config.mouseRepelDistance) {
            const force = (config.mouseRepelDistance - distance) / config.mouseRepelDistance;
            particle.vx += (dx / distance) * force * config.mouseRepelForce;
            particle.vy += (dy / distance) * force * config.mouseRepelForce;
          }
        }

        // Spring back to original position (gravitational pull)
        const dxToOriginal = particle.originalX - particle.x;
        const dyToOriginal = particle.originalY - particle.y;
        const distanceToOriginal = Math.sqrt(dxToOriginal * dxToOriginal + dyToOriginal * dyToOriginal);
        
        if (distanceToOriginal > config.springBackThreshold) {
          // Apply spring force proportional to distance from original position
          particle.vx += dxToOriginal * config.springBackForce;
          particle.vy += dyToOriginal * config.springBackForce;
        }

        // Apply damping to velocity for smoother motion
        particle.vx *= config.damping;
        particle.vy *= config.damping;

        // Limit velocity
        const speed = Math.sqrt(particle.vx * particle.vx + particle.vy * particle.vy);
        const maxSpeed = config.speed * 3;
        if (speed > maxSpeed) {
          particle.vx = (particle.vx / speed) * maxSpeed;
          particle.vy = (particle.vy / speed) * maxSpeed;
        }
      });
    }

    // Draw particles and connections
    function drawParticles() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw particles only (no connection lines for free-space feel)
      particles.forEach(particle => {
        ctx.fillStyle = particle.color;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.radius, 0, Math.PI * 2);
        ctx.fill();
      });
    }

    // Animation loop
    function animate() {
      if (!isVisible) return;
      
      updateParticles();
      drawParticles();
      animationId = requestAnimationFrame(animate);
    }

    // Mouse move handler
    function handleMouseMove(e) {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    }

    // Touch move handler - allows page scrolling by not preventing default
    function handleTouchMove(e) {
      const rect = canvas.getBoundingClientRect();
      const touch = e.touches[0];
      const touchX = touch.clientX - rect.left;
      const touchY = touch.clientY - rect.top;
      
      mouse.x = touchX;
      mouse.y = touchY;
    }

    // Mouse enter handler
    function handleMouseEnter() {
      mouse.active = true;
    }

    // Mouse leave handler
    function handleMouseLeave() {
      mouse.active = false;
      mouse.x = null;
      mouse.y = null;
    }

    // Intersection Observer to start/stop animation when visible
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        isVisible = entry.isIntersecting;
        if (isVisible) {
          if (!animationId) animate();
        } else {
          if (animationId) {
            cancelAnimationFrame(animationId);
            animationId = null;
          }
        }
      });
    }, { threshold: 0.1 });

    // Initialize
    resizeCanvas();
    initParticles();
    observer.observe(canvas);
    
    // Re-check canvas size after delay to handle async layout (prevents squished buttons after auto-deployment)
    setTimeout(() => {
      resizeCanvas();
      initParticles();
    }, config.layoutDelayMs);

    // Event listeners
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("touchmove", handleTouchMove, { passive: true });
    canvas.addEventListener("mouseenter", handleMouseEnter);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("touchstart", handleMouseEnter, { passive: true });
    canvas.addEventListener("touchend", handleMouseLeave, { passive: true });

    // Resize handler with debounce
    let resizeTimeout;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        resizeCanvas();
        initParticles();
      }, 250);
    });

    // Start animation if visible
    if (isVisible) animate();

    // Return cleanup function
    return () => {
      observer.disconnect();
      if (animationId) cancelAnimationFrame(animationId);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("touchmove", handleTouchMove);
      canvas.removeEventListener("mouseenter", handleMouseEnter);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("touchstart", handleMouseEnter);
      canvas.removeEventListener("touchend", handleMouseLeave);
    };
  }

  // Find all particle cluster canvases and initialize them
  const clusterCanvases = document.querySelectorAll("[data-particle-cluster]");
  clusterCanvases.forEach(canvas => {
    const platformKey = canvas.getAttribute("data-particle-cluster");
    initParticleCluster(canvas, platformKey);
  });

  // Expose for SPA dynamic view mounting (canvases created after DOMContentLoaded).
  // Guards against double-initialisation via canvas.dataset.clusterInit.
  // Uses requestAnimationFrame so the canvas has correct layout dimensions
  // even when called synchronously during a DOMContentLoaded handler.
  window.__SPA_initParticleCluster = function(canvas, platformKey) {
    if (canvas.dataset.clusterInit) return;
    canvas.dataset.clusterInit = 'true';
    requestAnimationFrame(function() {
      initParticleCluster(canvas, platformKey);
    });
  };
});
