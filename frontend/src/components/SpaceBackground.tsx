import { useEffect, useRef } from "react";

const TOTAL_STARS = 420;

type Star = {
  fx: number; fy: number;          // position as 0-1 fraction
  r: number;                        // radius
  base: number;                     // base opacity
  phase: number; speed: number;     // twinkle
  bright: boolean;                  // large glowing star
};

export function SpaceBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;

    const fit = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    fit();
    window.addEventListener("resize", fit);

    const stars: Star[] = Array.from({ length: TOTAL_STARS }, () => {
      const bright = Math.random() < 0.04;
      return {
        fx: Math.random(), fy: Math.random(),
        r:  bright ? Math.random() * 1.8 + 1.4 : Math.random() * 0.85 + 0.15,
        base:  Math.random() * 0.45 + 0.25,
        phase: Math.random() * Math.PI * 2,
        speed: Math.random() * 0.007 + 0.002,
        bright,
      };
    });

    let t = 0;
    let raf: number;

    const draw = () => {
      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      for (const s of stars) {
        const alpha = s.base + (1 - s.base) * 0.5 * (1 + Math.sin(t * s.speed + s.phase));
        const x = s.fx * W, y = s.fy * H;

        if (s.bright) {
          // soft glow halo
          const grd = ctx.createRadialGradient(x, y, 0, x, y, s.r * 5);
          grd.addColorStop(0,   `rgba(200,220,255,${(alpha * 0.55).toFixed(3)})`);
          grd.addColorStop(0.4, `rgba(180,210,255,${(alpha * 0.18).toFixed(3)})`);
          grd.addColorStop(1,   "rgba(180,210,255,0)");
          ctx.beginPath();
          ctx.arc(x, y, s.r * 5, 0, Math.PI * 2);
          ctx.fillStyle = grd;
          ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(215,230,255,${alpha.toFixed(3)})`;
        ctx.fill();
      }

      t++;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", fit);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 0,
      }}
    />
  );
}
