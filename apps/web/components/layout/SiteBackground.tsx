'use client';

import { useEffect, useRef } from 'react';

export default function SiteBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    let w = 0;
    let h = 0;
    let animId: number;

    function resize() {
      if (!canvas || !ctx) return;
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();

    const resizeObserver = new ResizeObserver(() => resize());
    resizeObserver.observe(document.documentElement);
    window.addEventListener('resize', resize);

    // Node count scaled to viewport area, clamped 50–110
    const N = Math.round((window.innerWidth * window.innerHeight) / 22000);
    const nodes: {
      x: number;
      y: number;
      vx: number;
      vy: number;
      r: number;
      pulse: number;
    }[] = [];

    for (let i = 0; i < Math.min(Math.max(N, 50), 110); i++) {
      nodes.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.22,
        vy: (Math.random() - 0.5) * 0.22,
        r: Math.random() * 1.4 + 0.6,
        pulse: Math.random() * Math.PI * 2,
      });
    }

    const mouse = { x: -9999, y: -9999 };

    function onMouseMove(e: MouseEvent) {
      mouse.x = e.clientX;
      mouse.y = e.clientY;
    }
    function onMouseLeave() {
      mouse.x = -9999;
      mouse.y = -9999;
    }

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseleave', onMouseLeave);

    const MAX_DIST = 140;

    function frame() {
      if (!ctx) return;
      ctx.clearRect(0, 0, w, h);

      // Update node positions + mouse attraction
      for (const n of nodes) {
        n.x += n.vx;
        n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;

        const dx = mouse.x - n.x;
        const dy = mouse.y - n.y;
        const d2 = dx * dx + dy * dy;
        if (d2 < 200 * 200) {
          const d = Math.sqrt(d2) || 1;
          const f = (1 - d / 200) * 0.04;
          n.vx += (dx / d) * f;
          n.vy += (dy / d) * f;
        }
        n.vx *= 0.99;
        n.vy *= 0.99;
        n.pulse += 0.02;
      }

      // Draw connection lines between nearby nodes
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i];
          const b = nodes[j];
          const dx = a.x - b.x;
          const dy = a.y - b.y;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d < MAX_DIST) {
            const alpha = (1 - d / MAX_DIST) * 0.3;
            ctx.strokeStyle = `rgba(0, 201, 167, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }

      // Draw nodes with glow halos
      for (const n of nodes) {
        const glow = 0.6 + Math.sin(n.pulse) * 0.3;
        // Core dot
        ctx.fillStyle = `rgba(0, 201, 167, ${0.5 * glow})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
        // Soft halo
        ctx.fillStyle = `rgba(0, 201, 167, ${0.08 * glow})`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 4, 0, Math.PI * 2);
        ctx.fill();
      }

      animId = requestAnimationFrame(frame);
    }

    animId = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseleave', onMouseLeave);
      resizeObserver.disconnect();
    };
  }, []);

  return (
    <div className="site-bg" aria-hidden="true">
      <div className="bg-grid" />
      <div className="bg-aurora" />
      <canvas ref={canvasRef} className="bg-canvas" />
      <div className="bg-scan" />
    </div>
  );
}
