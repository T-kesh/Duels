"use client";

import React, { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface VictoryCelebrationProps {
  won: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  color: string;
  size: number;
  alpha: number;
  decay: number;
  rotation: number;
  rotationSpeed: number;
}

export function VictoryCelebration({ won }: VictoryCelebrationProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [animationStarted, setAnimationStarted] = useState(false);

  // Check prefers-reduced-motion
  useEffect(() => {
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    setPrefersReducedMotion(mediaQuery.matches);
    setAnimationStarted(true);

    const listener = (e: MediaQueryListEvent) => {
      setPrefersReducedMotion(e.matches);
    };
    mediaQuery.addEventListener("change", listener);
    return () => mediaQuery.removeEventListener("change", listener);
  }, []);

  // Particle System Effect
  useEffect(() => {
    if (!won || prefersReducedMotion || !animationStarted || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationFrameId: number;
    const particles: Particle[] = [];

    const colors = ["#fcc419", "#35d46a", "#ffffff", "#00e5ff"];

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const createParticle = (x: number, y: number, isSecondary = false): Particle => {
      const angle = Math.random() * Math.PI * 2;
      const speed = isSecondary ? Math.random() * 4 + 2 : Math.random() * 8 + 4;
      return {
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed - (isSecondary ? 2 : 5), // dynamic upward initial velocity bias
        color: colors[Math.floor(Math.random() * colors.length)],
        size: Math.random() * 6 + 4,
        alpha: 1,
        decay: Math.random() * 0.015 + 0.01,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * 5,
      };
    };

    const spawnBurst = (x: number, y: number, count: number, isSecondary = false) => {
      for (let i = 0; i < count; i++) {
        particles.push(createParticle(x, y, isSecondary));
      }
    };

    // Initial burst from center top / viewport middle
    spawnBurst(canvas.width / 2, canvas.height * 0.35, 120);

    // Delayed secondary burst
    const timer = setTimeout(() => {
      spawnBurst(canvas.width / 2, canvas.height * 0.35, 60, true);
    }, 600);

    const updateAndDraw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      particles.forEach((p, idx) => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.18; // gravity
        p.vx *= 0.98; // air resistance
        p.alpha -= p.decay;
        p.rotation += p.rotationSpeed;

        if (p.alpha <= 0) {
          particles.splice(idx, 1);
          return;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate((p.rotation * Math.PI) / 180);
        ctx.fillStyle = p.color;
        
        // Draw square/confetti ribbons
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      });

      if (particles.length > 0) {
        animationFrameId = requestAnimationFrame(updateAndDraw);
      }
    };

    updateAndDraw();

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timer);
      window.removeEventListener("resize", resizeCanvas);
    };
  }, [won, prefersReducedMotion, animationStarted]);

  const victoryText = "VICTORY";

  if (!won) {
    return (
      <div className="z-10 text-center w-full max-w-sm">
        {/* Defeated minimal layout */}
        <div className="relative inline-block mb-8">
          <span className="text-8xl block filter drop-shadow-2xl drop-shadow-[0_0_30px_rgba(255,77,79,0.3)] select-none">
            💀
          </span>
        </div>
        <h1 className="text-5xl font-bold tracking-[0.2em] mb-3 uppercase text-destructive">
          Defeated
        </h1>
      </div>
    );
  }

  return (
    <>
      {/* Celebration Layer Effects */}
      {!prefersReducedMotion && won && (
        <>
          <canvas
            ref={canvasRef}
            className="fixed inset-0 pointer-events-none z-0"
            style={{ mixBlendMode: "screen" }}
          />
          <div className="fixed inset-0 bg-celo-green/10 pointer-events-none z-50 animate-screen-flash" />
        </>
      )}

      <div className="relative z-10 text-center w-full max-w-sm select-none flex flex-col items-center">
        {/* Starburst Halo background */}
        {won && !prefersReducedMotion && (
          <div className="absolute top-16 left-1/2 w-48 h-48 pointer-events-none -z-10">
            <svg
              className="absolute top-1/2 left-1/2 w-full h-full -translate-x-1/2 -translate-y-1/2 animate-starburst text-celo-green/20"
              viewBox="0 0 100 100"
              fill="currentColor"
            >
              <path d="M50 0 L53 35 L85 15 L58 42 L100 50 L58 58 L85 85 L53 65 L50 100 L47 65 L15 85 L42 58 L0 50 L42 42 L15 15 L47 35 Z" />
            </svg>
          </div>
        )}

        {/* Trophy icon */}
        <div className="relative inline-block mb-8 z-10">
          <span
            className={cn(
              "text-8xl block filter drop-shadow-2xl drop-shadow-[0_0_30px_rgba(53,212,106,0.4)]",
              !prefersReducedMotion ? "animate-trophy-slam" : "scale-100"
            )}
          >
            🏆
          </span>
        </div>

        {/* Victory text reveal */}
        <h1 className="text-5xl font-bold tracking-[0.2em] mb-3 uppercase relative overflow-hidden flex justify-center">
          {prefersReducedMotion ? (
            <span className="text-celo-green">{victoryText}</span>
          ) : (
            victoryText.split("").map((char, index) => (
              <span
                key={index}
                className="inline-block text-transparent bg-clip-text bg-gradient-to-r from-celo-green via-duel-gold to-celo-green bg-[length:200%_auto] animate-shimmer"
                style={{
                  animation: `letter-reveal 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) ${index * 0.05}s forwards, shimmer 4s linear infinite`,
                  opacity: 0,
                }}
              >
                {char}
              </span>
            ))
          )}
        </h1>
      </div>
    </>
  );
}
