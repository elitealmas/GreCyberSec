"use client";

import { useEffect, useRef } from "react";

type Particle = { character: "0" | "1"; createdAt: number; drift: number; x: number; y: number };

export function CursorTrail() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const ringRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const usesFinePointer = window.matchMedia("(pointer: fine)");
    if (prefersReducedMotion.matches || !usesFinePointer.matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const context = canvas.getContext("2d");
    if (!context) return;
    const drawingCanvas: HTMLCanvasElement = canvas;
    const drawingContext: CanvasRenderingContext2D = context;

    const particles: Particle[] = [];
    let animationFrame = 0;
    let lastParticleAt = 0;
    let lastParticleX = -Infinity;
    let lastParticleY = -Infinity;
    let pointerX = -100;
    let pointerY = -100;

    function resizeCanvas() {
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      drawingCanvas.width = Math.round(window.innerWidth * pixelRatio);
      drawingCanvas.height = Math.round(window.innerHeight * pixelRatio);
      drawingContext.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    }

    function onPointerMove(event: PointerEvent) {
      pointerX = event.clientX;
      pointerY = event.clientY;
      const ring = ringRef.current;
      if (ring) {
        ring.style.opacity = "1";
        ring.style.transform = `translate3d(${pointerX - 12}px, ${pointerY - 12}px, 0)`;
      }
      const now = performance.now();
      const distance = Math.hypot(pointerX - lastParticleX, pointerY - lastParticleY);

      if (distance < 4 || now - lastParticleAt < 12) return;
      for (let index = 0; index < 3; index += 1) {
        particles.push({ character: Math.random() > .5 ? "1" : "0", createdAt: now, drift: (Math.random() - .5) * 24, x: pointerX + (Math.random() - .5) * 5, y: pointerY + (Math.random() - .5) * 5 });
      }
      while (particles.length > 120) particles.shift();
      lastParticleAt = now;
      lastParticleX = pointerX;
      lastParticleY = pointerY;
    }

    function draw(now: number) {
      drawingContext.clearRect(0, 0, window.innerWidth, window.innerHeight);
      const lightMode = document.documentElement.classList.contains("theme-light");
      const trailColor = lightMode ? "#193326" : "#75ffad";

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        const age = now - particle.createdAt;
        if (age > 1100) { particles.splice(index, 1); continue; }

        const progress = age / 1100;
        drawingContext.globalAlpha = (1 - progress) * (lightMode ? .5 : .62);
        drawingContext.fillStyle = trailColor;
        drawingContext.font = '600 8px "Bahnschrift", "Segoe UI", sans-serif';
        drawingContext.fillText(particle.character, particle.x + particle.drift * progress, particle.y - 2 - progress * 20);
      }

      drawingContext.globalAlpha = 1;
      animationFrame = window.requestAnimationFrame(draw);
    }

    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointermove", onPointerMove, { passive: true });
    animationFrame = window.requestAnimationFrame(draw);

    return () => {
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", onPointerMove);
    };
  }, []);

  return <><canvas ref={canvasRef} className="cursor-trail" aria-hidden="true" /><span ref={ringRef} className="cursor-ring" aria-hidden="true" /></>;
}
