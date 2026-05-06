import { useEffect, useRef } from "react";

interface Planet {
  orbitR: number;
  speed: number;
  size: number;
  color: string;
  symbol: string;
  angle: number;
}

interface FloatCoin {
  x: number; y: number;
  vy: number; vx: number;
  opacity: number;
  symbol: string;
  size: number;
  phase: number;
}

export function CosmicAuthBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0;
    const resize = () => {
      W = canvas.width = window.innerWidth;
      H = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const stars = Array.from({ length: 200 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 0.75 + 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.005 + 0.0018,
    }));

    const planets: Planet[] = [
      { orbitR: 72,  speed: 0.020, size: 7,  color: "#a5b4fc", symbol: "₪", angle: 0 },
      { orbitR: 128, speed: 0.012, size: 10, color: "#fbbf24", symbol: "$", angle: 1.3 },
      { orbitR: 192, speed: 0.007, size: 13, color: "#34d399", symbol: "%", angle: 2.8 },
      { orbitR: 262, speed: 0.0042, size: 9, color: "#c084fc", symbol: "↑", angle: 4.2 },
    ];

    const SYMBOLS = ["₪", "$", "€", "¢", "%"];
    const floatCoins: FloatCoin[] = Array.from({ length: 24 }, () => ({
      x: Math.random(),
      y: Math.random(),
      vy: -(Math.random() * 0.00035 + 0.00010),
      vx: (Math.random() - 0.5) * 0.00012,
      opacity: Math.random() * 0.20 + 0.04,
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      size: Math.random() * 11 + 9,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    let raf: number;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // position solar system at 70 % of width, vertically centred
      const cx = Math.min(W * 0.70, W - 120);
      const cy = H * 0.50;

      // stars
      for (const s of stars) {
        const a = 0.12 + 0.28 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,225,255,${a.toFixed(3)})`;
        ctx.fill();
      }

      // orbit rings
      for (const p of planets) {
        ctx.beginPath();
        ctx.arc(cx, cy, p.orbitR, 0, Math.PI * 2);
        ctx.strokeStyle = "rgba(255,255,255,0.042)";
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // sun — pulsing golden coin
      const sunR = 26;
      const pulse = 1 + 0.055 * Math.sin(t * 0.038);
      const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 3.8 * pulse);
      g1.addColorStop(0,    "rgba(251,191,36,0.50)");
      g1.addColorStop(0.38, "rgba(251,191,36,0.16)");
      g1.addColorStop(0.70, "rgba(251,191,36,0.04)");
      g1.addColorStop(1,    "rgba(251,191,36,0)");
      ctx.beginPath();
      ctx.arc(cx, cy, sunR * 3.8 * pulse, 0, Math.PI * 2);
      ctx.fillStyle = g1;
      ctx.fill();

      const g2 = ctx.createRadialGradient(cx - 7, cy - 7, 2, cx, cy, sunR);
      g2.addColorStop(0,   "#fffde7");
      g2.addColorStop(0.4, "#fbbf24");
      g2.addColorStop(1,   "#92400e");
      ctx.beginPath();
      ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
      ctx.fillStyle = g2;
      ctx.fill();

      ctx.font = `bold ${sunR - 3}px Arial, sans-serif`;
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "rgba(0,0,0,0.60)";
      ctx.fillText("₪", cx, cy + 1);

      // planets
      for (const p of planets) {
        p.angle += p.speed;
        const px = cx + Math.cos(p.angle) * p.orbitR;
        const py = cy + Math.sin(p.angle) * p.orbitR;

        const gp = ctx.createRadialGradient(px, py, 0, px, py, p.size * 2.6);
        gp.addColorStop(0, p.color + "55");
        gp.addColorStop(1, p.color + "00");
        ctx.beginPath();
        ctx.arc(px, py, p.size * 2.6, 0, Math.PI * 2);
        ctx.fillStyle = gp;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(px, py, p.size, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();

        ctx.font = `bold ${Math.round(p.size * 0.88)}px Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = "rgba(0,0,0,0.62)";
        ctx.fillText(p.symbol, px, py + 0.5);
      }

      // drifting coin symbols
      for (const fc of floatCoins) {
        fc.y += fc.vy;
        fc.x += fc.vx;
        if (fc.y < -0.04) fc.y = 1.04;
        if (fc.x < -0.04) fc.x = 1.04;
        if (fc.x > 1.04)  fc.x = -0.04;

        const wobble = Math.sin(t * 0.017 + fc.phase) * 4;
        ctx.font = `${fc.size}px Arial, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillStyle = `rgba(251,191,36,${fc.opacity.toFixed(3)})`;
        ctx.fillText(fc.symbol, fc.x * W + wobble, fc.y * H);
      }

      t++;
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
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
