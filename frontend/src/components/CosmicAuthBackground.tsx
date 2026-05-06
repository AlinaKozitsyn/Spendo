import { useEffect, useRef } from "react";

interface Planet {
  orbitR: number;
  speed: number;
  size: number;
  color: string;
  symbol: string;
  angle: number;
  alpha: number;
}

interface FloatCoin {
  x: number; y: number;
  vy: number; vx: number;
  opacity: number;
  symbol: string;
  size: number;
  phase: number;
}

// Draw one solar system (sun + planets) at a given centre
function drawSystem(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  planets: Planet[],
  sunR: number,
  t: number,
  globalAlpha: number,
) {
  ctx.save();
  ctx.globalAlpha = globalAlpha;

  // orbit rings — very faint
  for (const p of planets) {
    ctx.beginPath();
    ctx.arc(cx, cy, p.orbitR, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.028)";
    ctx.lineWidth = 1;
    ctx.stroke();
  }

  // sun glow
  const pulse = 1 + 0.06 * Math.sin(t * 0.038);
  const g1 = ctx.createRadialGradient(cx, cy, 0, cx, cy, sunR * 4 * pulse);
  g1.addColorStop(0,    "rgba(251,191,36,0.55)");
  g1.addColorStop(0.4,  "rgba(251,191,36,0.18)");
  g1.addColorStop(0.8,  "rgba(251,191,36,0.04)");
  g1.addColorStop(1,    "rgba(251,191,36,0)");
  ctx.beginPath();
  ctx.arc(cx, cy, sunR * 4 * pulse, 0, Math.PI * 2);
  ctx.fillStyle = g1;
  ctx.fill();

  // sun body
  const g2 = ctx.createRadialGradient(cx - sunR * 0.25, cy - sunR * 0.25, 1, cx, cy, sunR);
  g2.addColorStop(0, "#fffde7");
  g2.addColorStop(0.45, "#fbbf24");
  g2.addColorStop(1, "#92400e");
  ctx.beginPath();
  ctx.arc(cx, cy, sunR, 0, Math.PI * 2);
  ctx.fillStyle = g2;
  ctx.fill();

  ctx.font = `bold ${Math.round(sunR * 0.75)}px Arial, sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillText("₪", cx, cy + 1);

  // planets
  for (const p of planets) {
    p.angle += p.speed;
    const px = cx + Math.cos(p.angle) * p.orbitR;
    const py = cy + Math.sin(p.angle) * p.orbitR;

    // glow halo — large and soft
    const gp = ctx.createRadialGradient(px, py, 0, px, py, p.size * 3.5);
    gp.addColorStop(0,   p.color + "66");
    gp.addColorStop(0.5, p.color + "22");
    gp.addColorStop(1,   p.color + "00");
    ctx.beginPath();
    ctx.arc(px, py, p.size * 3.5, 0, Math.PI * 2);
    ctx.fillStyle = gp;
    ctx.fill();

    // body — semi-transparent
    ctx.beginPath();
    ctx.arc(px, py, p.size, 0, Math.PI * 2);
    ctx.fillStyle = p.color + "bb"; // ~73 % opacity
    ctx.fill();

    // symbol
    ctx.font = `bold ${Math.round(p.size * 0.82)}px Arial, sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillText(p.symbol, px, py + 0.5);
  }

  ctx.restore();
}

export function CosmicAuthBackground() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let W = 0, H = 0;
    const resize = () => { W = canvas.width = window.innerWidth; H = canvas.height = window.innerHeight; };
    resize();
    window.addEventListener("resize", resize);

    // Stars
    const stars = Array.from({ length: 220 }, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random() * 0.8 + 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.005 + 0.002,
    }));

    // LEFT solar system planets
    const leftPlanets: Planet[] = [
      { orbitR: 90,  speed:  0.018, size: 14, color: "#a5b4fc", symbol: "₪", angle: 0.5,  alpha: 1 },
      { orbitR: 165, speed:  0.011, size: 20, color: "#fbbf24", symbol: "$", angle: 2.1,  alpha: 1 },
      { orbitR: 245, speed:  0.007, size: 22, color: "#34d399", symbol: "%", angle: 3.8,  alpha: 1 },
      { orbitR: 330, speed:  0.004, size: 16, color: "#c084fc", symbol: "↑", angle: 5.1,  alpha: 1 },
    ];

    // RIGHT solar system planets (mirrored offsets)
    const rightPlanets: Planet[] = [
      { orbitR: 90,  speed: -0.016, size: 14, color: "#818cf8", symbol: "€", angle: 3.7,  alpha: 1 },
      { orbitR: 160, speed: -0.010, size: 19, color: "#fbbf24", symbol: "₪", angle: 1.2,  alpha: 1 },
      { orbitR: 238, speed: -0.006, size: 21, color: "#34d399", symbol: "+", angle: 4.5,  alpha: 1 },
      { orbitR: 318, speed: -0.0038,size: 15, color: "#f472b6", symbol: "$", angle: 0.8,  alpha: 1 },
    ];

    const SYMBOLS = ["₪", "$", "€", "¢", "%"];
    const floatCoins: FloatCoin[] = Array.from({ length: 20 }, () => ({
      x: Math.random(), y: Math.random(),
      vy: -(Math.random() * 0.00032 + 0.00009),
      vx: (Math.random() - 0.5) * 0.00011,
      opacity: Math.random() * 0.14 + 0.03,
      symbol: SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)],
      size: Math.random() * 13 + 10,
      phase: Math.random() * Math.PI * 2,
    }));

    let t = 0;
    let raf: number;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // stars
      for (const s of stars) {
        const a = 0.10 + 0.22 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
        ctx.beginPath();
        ctx.arc(s.x * W, s.y * H, s.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(210,225,255,${a.toFixed(3)})`;
        ctx.fill();
      }

      // LEFT system — anchored to left edge, behind auth panel
      const sunR = 28;
      const leftCx  = -60;             // sun off-screen left; only outer orbits visible
      const leftCy  = H * 0.5;
      drawSystem(ctx, leftCx, leftCy, leftPlanets, sunR, t, 0.30);

      // RIGHT system — anchored to right edge
      const rightCx = W + 60;          // sun off-screen right
      const rightCy = H * 0.5;
      drawSystem(ctx, rightCx, rightCy, rightPlanets, sunR, t, 0.30);

      // drifting coin symbols — very faint
      for (const fc of floatCoins) {
        fc.y += fc.vy;
        fc.x += fc.vx;
        if (fc.y < -0.04) fc.y = 1.04;
        if (fc.x < -0.04) fc.x = 1.04;
        if (fc.x > 1.04)  fc.x = -0.04;
        const wobble = Math.sin(t * 0.016 + fc.phase) * 5;
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
    return () => { cancelAnimationFrame(raf); window.removeEventListener("resize", resize); };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position: "fixed", inset: 0, width: "100vw", height: "100vh", pointerEvents: "none", zIndex: 0 }}
    />
  );
}
