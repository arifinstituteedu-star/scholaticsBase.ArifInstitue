import React, { useState, useEffect, useRef, useCallback } from 'react';
import './StudentBagAnimation.css';
import schoolHallway from '../school_hallway.png';

/* ── Audio ─────────────────────────────────────────────────────────── */
const playClapSound = (soundEnabled) => {
  if (!soundEnabled || typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    const buf = ctx.createBuffer(1, ctx.sampleRate * 0.12, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource(); src.buffer = buf;
    const flt = ctx.createBiquadFilter(); flt.type = 'bandpass'; flt.frequency.value = 1100; flt.Q.value = 1.8;
    const gain = ctx.createGain(); const now = ctx.currentTime;
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.exponentialRampToValueAtTime(0.9, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.11);
    src.connect(flt); flt.connect(gain); gain.connect(ctx.destination);
    src.start(now); src.stop(now + 0.12);
  } catch (e) { console.debug(e); }
};

const playMagicChime = (soundEnabled) => {
  if (!soundEnabled || typeof window === 'undefined') return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') ctx.resume();
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = ctx.createOscillator(); const g = ctx.createGain();
      const t = ctx.currentTime + i * 0.08;
      osc.type = 'sine'; osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.01, t);
      g.gain.exponentialRampToValueAtTime(0.25, t + 0.04);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.6);
      osc.connect(g); g.connect(ctx.destination);
      osc.start(t); osc.stop(t + 0.6);
    });
  } catch (e) { console.debug(e); }
};

/* ── 3D Character SVG ───────────────────────────────────────────────── */
function Character3D({ phase }) {
  const isClapping = phase === 'clapping';
  const isEmerged  = phase === 'emerged';

  return (
    <svg className="char-svg-3d" viewBox="0 0 200 310" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        {/* Skin sphere (radial – light upper-left) */}
        <radialGradient id="s-head" cx="36%" cy="30%" r="70%">
          <stop offset="0%"   stopColor="#ffe8d2" /><stop offset="28%" stopColor="#f7c49e" />
          <stop offset="62%"  stopColor="#e4956a" /><stop offset="88%" stopColor="#c97440" />
          <stop offset="100%" stopColor="#b06030" />
        </radialGradient>
        {/* Skin cylinder (horizontal – arms) */}
        <linearGradient id="s-arm" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#d88050" /><stop offset="18%" stopColor="#f7c49e" />
          <stop offset="45%"  stopColor="#ffe8d2" /><stop offset="75%" stopColor="#eeaa78" />
          <stop offset="100%" stopColor="#c07040" />
        </linearGradient>
        {/* Skin hand */}
        <radialGradient id="s-hand" cx="33%" cy="28%" r="74%">
          <stop offset="0%"   stopColor="#ffe8d2" /><stop offset="52%" stopColor="#f4b87a" />
          <stop offset="100%" stopColor="#c87840" />
        </radialGradient>
        {/* Hair */}
        <radialGradient id="s-hair" cx="50%" cy="18%" r="70%">
          <stop offset="0%"   stopColor="#3f2718" /><stop offset="38%" stopColor="#221208" />
          <stop offset="100%" stopColor="#0c0602" />
        </radialGradient>
        {/* Blazer left (lit) */}
        <linearGradient id="s-blzL" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#0e2268" /><stop offset="28%" stopColor="#1e40af" />
          <stop offset="70%"  stopColor="#1a38a0" /><stop offset="100%" stopColor="#132a80" />
        </linearGradient>
        {/* Blazer right (shadow) */}
        <linearGradient id="s-blzR" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#162e80" /><stop offset="50%" stopColor="#102060" />
          <stop offset="100%" stopColor="#081440" />
        </linearGradient>
        {/* Shirt */}
        <linearGradient id="s-shirt" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#d8e4f4" /><stop offset="30%" stopColor="#f6faff" />
          <stop offset="70%"  stopColor="#eef4fd" /><stop offset="100%" stopColor="#ccd8ee" />
        </linearGradient>
        {/* Tie */}
        <linearGradient id="s-tie" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#fcd34d" /><stop offset="45%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        {/* Badge */}
        <radialGradient id="s-badge" cx="35%" cy="28%" r="75%">
          <stop offset="0%"   stopColor="#fef08a" /><stop offset="55%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#92400e" />
        </radialGradient>
        {/* Trousers L */}
        <linearGradient id="s-troL" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#1e2d44" /><stop offset="22%" stopColor="#2e4060" />
          <stop offset="55%"  stopColor="#3a5075" /><stop offset="82%" stopColor="#2a3a58" />
          <stop offset="100%" stopColor="#1a2438" />
        </linearGradient>
        {/* Trousers R */}
        <linearGradient id="s-troR" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#182038" /><stop offset="30%" stopColor="#243050" />
          <stop offset="65%"  stopColor="#2c3c60" /><stop offset="100%" stopColor="#0e1830" />
        </linearGradient>
        {/* Shoe */}
        <radialGradient id="s-shoe" cx="30%" cy="22%" r="74%">
          <stop offset="0%"   stopColor="#2a2a40" /><stop offset="38%" stopColor="#181828" />
          <stop offset="80%"  stopColor="#0c0c1c" /><stop offset="100%" stopColor="#060610" />
        </radialGradient>
        {/* Shoe sheen */}
        <radialGradient id="s-sheen" cx="28%" cy="20%" r="52%">
          <stop offset="0%"   stopColor="rgba(255,255,255,0.38)" />
          <stop offset="100%" stopColor="rgba(255,255,255,0)" />
        </radialGradient>
        {/* Eye iris */}
        <radialGradient id="s-iris" cx="50%" cy="42%" r="58%">
          <stop offset="0%"   stopColor="#5b8ef5" /><stop offset="58%" stopColor="#2563eb" />
          <stop offset="100%" stopColor="#1e3a8a" />
        </radialGradient>
        {/* Floor shadow */}
        <radialGradient id="s-fsh" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.30)" />
          <stop offset="70%"  stopColor="rgba(0,0,0,0.09)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)" />
        </radialGradient>
        {/* Drop shadow filter */}
        <filter id="s-drop" x="-15%" y="-5%" width="135%" height="125%">
          <feDropShadow dx="5" dy="10" stdDeviation="7" floodColor="rgba(0,0,0,0.24)" />
        </filter>
      </defs>

      <g filter="url(#s-drop)">
        {/* Floor shadow */}
        <ellipse cx="100" cy="300" rx="62" ry="9" fill="url(#s-fsh)" />

        {/* LEGS */}
        <g className="cg-leg-left">
          <path d="M76 185 L91 185 L89 243 L70 243 Z" fill="url(#s-troL)" />
          <path d="M70 241 L89 241 L88 280 L69 280 Z" fill="url(#s-troL)" />
          <path d="M55 283 Q68 275 92 280 L92 287 Q70 292 55 286 Z" fill="url(#s-shoe)" />
          <ellipse cx="73" cy="282" rx="18" ry="7" fill="url(#s-shoe)" />
          <ellipse cx="70" cy="279" rx="9"  ry="3.5" fill="url(#s-sheen)" />
        </g>
        <g className="cg-leg-right">
          <path d="M109 185 L124 185 L130 243 L113 243 Z" fill="url(#s-troR)" />
          <path d="M113 241 L130 241 L132 280 L115 280 Z" fill="url(#s-troR)" />
          <path d="M109 283 Q122 275 146 280 L146 287 Q124 292 109 286 Z" fill="url(#s-shoe)" />
          <ellipse cx="127" cy="282" rx="18" ry="7" fill="url(#s-shoe)" />
          <ellipse cx="124" cy="279" rx="9"  ry="3.5" fill="url(#s-sheen)" />
        </g>

        {/* TORSO */}
        <rect x="68" y="178" width="64" height="9" rx="2" fill="#08081c" />
        <rect x="95" y="176" width="10" height="13" rx="2" fill="#c0980c" />
        <path d="M82 100 L118 100 L116 180 L84 180 Z" fill="url(#s-shirt)" />
        <path d="M60 100 L86 100 L84 182 L54 182 Z" fill="url(#s-blzL)" />
        <path d="M114 100 L140 100 L146 182 L116 182 Z" fill="url(#s-blzR)" />
        <path d="M86 100 L100 122 L114 100 L108 98 L100 115 L92 98 Z" fill="#f6faff" />
        <path d="M96 100 L104 100 L107 150 L100 160 L93 150 Z" fill="url(#s-tie)" />
        <ellipse cx="100" cy="104" rx="5.5" ry="4" fill="#d97706" />
        <circle cx="76" cy="130" r="9" fill="url(#s-badge)" />
        <path d="M72 130 L76 124 L80 130 L76 136 Z" fill="#1e3a8a" />
        <circle cx="76" cy="130" r="3" fill="rgba(255,255,255,0.75)" />
        <circle cx="100" cy="133" r="2" fill="#dde8f4" />
        <circle cx="100" cy="150" r="2" fill="#dde8f4" />
        <circle cx="100" cy="167" r="2" fill="#dde8f4" />
        <rect x="62" y="120" width="9" height="7" rx="1" fill="rgba(255,255,255,0.82)" />
        <path d="M60 100 Q100 92 140 100" fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth="5" />

        {/* ARMS */}
        <g className="cg-arm-left">
          {isClapping ? (
            <>
              <path d="M66 108 Q56 130 82 142 L87 134 Q66 122 72 108 Z" fill="url(#s-blzL)" />
              <circle cx="85" cy="145" r="8" fill="url(#s-hand)" />
              <path d="M80 142 L81 133 M85 141 L86 132 M89 142 L91 133" stroke="#f4b87a" strokeWidth="2.2" strokeLinecap="round" />
            </>
          ) : isEmerged ? (
            <>
              <path d="M66 108 Q46 110 42 88 L51 84 Q54 104 72 106 Z" fill="url(#s-blzL)" />
              <circle cx="46" cy="82" r="8.5" fill="url(#s-hand)" />
              <path d="M43 82 L43 69 Q46 66 50 69 L50 82" fill="url(#s-hand)" />
            </>
          ) : (
            <>
              <path d="M66 108 Q52 128 58 164 L68 162 Q62 128 74 108 Z" fill="url(#s-blzL)" />
              <path d="M58 160 Q53 180 58 193 L67 190 Q65 180 68 162 Z" fill="url(#s-arm)" />
              <circle cx="62" cy="197" r="7.5" fill="url(#s-hand)" />
            </>
          )}
        </g>
        <g className="cg-arm-right">
          {isClapping ? (
            <>
              <path d="M134 108 Q144 130 118 142 L113 134 Q134 122 128 108 Z" fill="url(#s-blzR)" />
              <circle cx="115" cy="145" r="8" fill="url(#s-hand)" />
              <path d="M120 142 L119 133 M115 141 L114 132 M111 142 L109 133" stroke="#f4b87a" strokeWidth="2.2" strokeLinecap="round" />
            </>
          ) : isEmerged ? (
            <>
              <path d="M134 108 Q154 110 158 88 L149 84 Q146 104 128 106 Z" fill="url(#s-blzR)" />
              <circle cx="154" cy="82" r="8.5" fill="url(#s-hand)" />
              <path d="M151 77 L153 66 M155 79 L158 70 M157 82 L162 74" stroke="url(#s-arm)" strokeWidth="3.5" strokeLinecap="round" />
            </>
          ) : (
            <>
              <path d="M134 108 Q148 128 142 164 L132 162 Q138 128 126 108 Z" fill="url(#s-blzR)" />
              <path d="M142 160 Q147 180 142 193 L133 190 Q135 180 132 162 Z" fill="url(#s-arm)" />
              <circle cx="138" cy="197" r="7.5" fill="url(#s-hand)" />
            </>
          )}
        </g>

        {/* HEAD */}
        <rect x="87" y="84" width="26" height="20" rx="6" fill="url(#s-arm)" />
        <rect x="87" y="99" width="26" height="7"  rx="2" fill="rgba(30,40,90,0.28)" />
        <ellipse cx="100" cy="56" rx="39" ry="44" fill="url(#s-head)" />
        <path d="M61 52 C61 22 78 12 100 12 C122 12 139 22 139 52 C139 58 137 64 135 67 C131 53 127 37 106 36 C84 35 71 48 65 67 C63 64 61 58 61 52 Z" fill="url(#s-hair)" />
        <path d="M78 21 Q100 14 122 22" stroke="rgba(90,55,35,0.55)" strokeWidth="4.5" strokeLinecap="round" fill="none" />
        <path d="M63 52 Q61 62 64 71" stroke="#22100a" strokeWidth="4" fill="none" strokeLinecap="round" />
        <path d="M137 52 Q139 62 136 71" stroke="#22100a" strokeWidth="4" fill="none" strokeLinecap="round" />
        <ellipse cx="61"  cy="60" rx="6" ry="9" fill="url(#s-head)" />
        <ellipse cx="139" cy="60" rx="6" ry="9" fill="url(#s-head)" />
        <ellipse cx="61"  cy="60" rx="3" ry="5" fill="rgba(200,100,60,0.45)" />
        <ellipse cx="139" cy="60" rx="3" ry="5" fill="rgba(200,100,60,0.45)" />
        <path d="M76 44 Q84 40 91 44"   stroke="#2c1810" strokeWidth="2.8" strokeLinecap="round" fill="none" />
        <path d="M109 44 Q116 40 124 44" stroke="#2c1810" strokeWidth="2.8" strokeLinecap="round" fill="none" />

        {/* Eyes */}
        <g className="cg-eyes">
          <ellipse cx="82"  cy="58" rx="8.5" ry="9" fill="white" />
          <circle  cx="82"  cy="58" r="6.2" fill="url(#s-iris)" />
          <circle  cx="82"  cy="58" r="3.6" fill="#08123c" />
          <circle  cx="80"  cy="55.5" r="2"   fill="white" />
          <circle  cx="84"  cy="60"   r="0.9"  fill="rgba(255,255,255,0.65)" />
          <path d="M73.5 54.5 Q82 50 90.5 54.5" stroke="#2c1810" strokeWidth="1.3" fill="none" strokeLinecap="round" />
          <ellipse cx="118" cy="58" rx="8.5" ry="9" fill="white" />
          <circle  cx="118" cy="58" r="6.2" fill="url(#s-iris)" />
          <circle  cx="118" cy="58" r="3.6" fill="#08123c" />
          <circle  cx="116" cy="55.5" r="2"   fill="white" />
          <circle  cx="120" cy="60"   r="0.9"  fill="rgba(255,255,255,0.65)" />
          <path d="M109.5 54.5 Q118 50 126.5 54.5" stroke="#2c1810" strokeWidth="1.3" fill="none" strokeLinecap="round" />
        </g>

        {/* Nose */}
        <path d="M97 69 Q100 76 103 69" stroke="#c87840" strokeWidth="1.6" fill="none" strokeLinecap="round" />
        <ellipse cx="74"  cy="66" rx="8.5" ry="5" fill="#f87171" opacity="0.28" />
        <ellipse cx="126" cy="66" rx="8.5" ry="5" fill="#f87171" opacity="0.28" />

        {/* Smile */}
        {isClapping || isEmerged ? (
          <>
            <path d="M86 76 Q100 88 114 76" stroke="#b91c1c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
            <path d="M88 77 Q100 87 112 77 Q112 83 100 84 Q88 83 88 77 Z" fill="white" />
          </>
        ) : (
          <path d="M88 75 Q100 84 112 75" stroke="#b91c1c" strokeWidth="2.2" fill="none" strokeLinecap="round" />
        )}
        {/* Head specular */}
        <ellipse cx="84" cy="39" rx="14" ry="7.5" fill="rgba(255,255,255,0.2)" />
      </g>
    </svg>
  );
}

/* ── 3D Bag SVG ─────────────────────────────────────────────────────── */
function Bag3D({ phase }) {
  const isOpening = phase === 'opening' || phase === 'emerged';

  return (
    <svg className="bag-svg-3d" viewBox="0 0 180 205" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="b-front" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#3070ff" /><stop offset="40%" stopColor="#1d50e0" />
          <stop offset="80%"  stopColor="#163abf" /><stop offset="100%" stopColor="#0e2898" />
        </linearGradient>
        <linearGradient id="b-top" x1="0%" y1="100%" x2="0%" y2="0%">
          <stop offset="0%"   stopColor="#1d50e0" /><stop offset="60%" stopColor="#3c72ff" />
          <stop offset="100%" stopColor="#5a90ff" />
        </linearGradient>
        <linearGradient id="b-side" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#1030a8" /><stop offset="100%" stopColor="#081878" />
        </linearGradient>
        <linearGradient id="b-flap" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%"   stopColor="#fde68a" /><stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#b45309" />
        </linearGradient>
        <linearGradient id="b-pocket" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#163ab0" /><stop offset="50%" stopColor="#1e4cd0" />
          <stop offset="100%" stopColor="#112898" />
        </linearGradient>
        <radialGradient id="b-badge" cx="35%" cy="28%" r="76%">
          <stop offset="0%"   stopColor="#fef3c7" /><stop offset="50%" stopColor="#f59e0b" />
          <stop offset="100%" stopColor="#78350f" />
        </radialGradient>
        <radialGradient id="b-glow" cx="50%" cy="60%" r="55%">
          <stop offset="0%"   stopColor="rgba(255,255,255,1)"    />
          <stop offset="35%"  stopColor="rgba(167,243,252,0.92)" />
          <stop offset="72%"  stopColor="rgba(129,140,248,0.55)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)"          />
        </radialGradient>
        <radialGradient id="b-fsh" cx="50%" cy="50%" r="50%">
          <stop offset="0%"   stopColor="rgba(0,0,0,0.42)" />
          <stop offset="68%"  stopColor="rgba(0,0,0,0.14)" />
          <stop offset="100%" stopColor="rgba(0,0,0,0)"    />
        </radialGradient>
        <filter id="b-drop" x="-20%" y="-10%" width="145%" height="140%">
          <feDropShadow dx="7" dy="12" stdDeviation="9" floodColor="rgba(0,0,0,0.30)" />
        </filter>
        <filter id="b-glowf" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="8" result="blur" />
          <feComposite in="SourceGraphic" in2="blur" operator="over" />
        </filter>
      </defs>

      <ellipse cx="90" cy="196" rx="72" ry="10" fill="url(#b-fsh)" />

      <g filter="url(#b-drop)">
        {/* Right side face */}
        <path d="M148 52 L163 64 L163 168 L148 158 Z" fill="url(#b-side)" />
        {/* Top face */}
        <path d="M32 52 L148 52 L163 64 L47 64 Z" fill="url(#b-top)" />
        {/* Front face */}
        <path d="M32 64 L148 64 L148 158 Q148 163 143 163 L37 163 Q32 163 32 158 Z" fill="url(#b-front)" />
        <path d="M32 64 L32 163" stroke="rgba(90,140,255,0.38)" strokeWidth="2" />

        {/* Handle */}
        <path d="M60 38 Q90 18 120 38" stroke="#0e2090" strokeWidth="9" strokeLinecap="round" fill="none" />
        <path d="M62 38 Q90 20 118 38" stroke="#f59e0b" strokeWidth="3" strokeLinecap="round" fill="none" />

        {/* Lid / flap */}
        <g className="bg-lid" style={{ transformOrigin: '90px 52px', willChange: 'transform' }}>
          <path d="M36 36 Q90 24 144 36 L148 54 Q90 44 32 54 Z" fill="url(#b-flap)" />
          <path d="M32 54 Q90 44 148 54 L146 60 Q90 52 34 60 Z" fill="#b45309" />
          <line x1="38" y1="54" x2="142" y2="54" stroke="rgba(255,255,255,0.5)" strokeWidth="2" strokeDasharray="4 3" />
          <circle cx="90" cy="54" r="4.5" fill="#1e3a8a" />
          <circle cx="90" cy="54" r="2.5" fill="#60a5fa" />
        </g>

        {/* Pocket */}
        <rect x="42" y="82" width="90" height="64" rx="9" fill="url(#b-pocket)" stroke="rgba(100,140,255,0.3)" strokeWidth="1.5" />
        <path d="M42 96 L132 96" stroke="#f59e0b" strokeWidth="3" />
        <line x1="42" y1="96" x2="132" y2="96" stroke="rgba(255,255,255,0.28)" strokeWidth="1" strokeDasharray="4 3" />
        <circle cx="87" cy="96" r="4.5" fill="#1e3a8a" />
        <circle cx="87" cy="96" r="2.5" fill="#60a5fa" />

        {/* Emblem */}
        <circle cx="87" cy="122" r="15" fill="#fbbf24" />
        <circle cx="87" cy="122" r="11" fill="#1e3a8a" />
        <path d="M83 122 L87 115 L91 122 L87 129 Z" fill="#fbbf24" />
        <circle cx="87" cy="122" r="3.5" fill="rgba(255,255,255,0.82)" />

        {/* Side straps */}
        <path d="M30 88 Q24 108 30 128" stroke="#0e2090" strokeWidth="6" strokeLinecap="round" fill="none" />
        <path d="M150 88 Q158 108 150 128" stroke="#081870" strokeWidth="6" strokeLinecap="round" fill="none" />

        {/* Gloss */}
        <path d="M36 68 Q90 60 144 68 L144 84 Q90 78 36 84 Z" fill="rgba(255,255,255,0.11)" />

        {/* Magic glow */}
        {isOpening && (
          <g filter="url(#b-glowf)">
            <ellipse cx="90" cy="50" rx="52" ry="18" fill="url(#b-glow)" />
            <ellipse cx="90" cy="46" rx="32" ry="10" fill="white" opacity="0.9" />
          </g>
        )}
      </g>
    </svg>
  );
}

/* ── Icon helpers ───────────────────────────────────────────────────── */
const SoundOnIcon  = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"/></svg>;
const SoundOffIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>;
const SkipIcon     = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 4 15 12 5 20 5 4"/><line x1="19" y1="5" x2="19" y2="19"/></svg>;
const ReplayIcon   = () => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="1 4 1 10 7 10"/><polyline points="23 20 23 14 17 14"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>;

/* ── Main Component ─────────────────────────────────────────────────── */
export default function StudentBagAnimation({ children, onAnimationComplete }) {
  const [animStage, setAnimStage] = useState('walking');
  const [shockwaveActive, setShockwaveActive] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [particles, setParticles] = useState([]);
  const timersRef = useRef([]);

  const clearAllTimers = useCallback(() => {
    timersRef.current.forEach((t) => clearTimeout(t));
    timersRef.current = [];
  }, []);

  const spawnParticles = useCallback(() => {
    const colors = ['#fbbf24','#f59e0b','#38bdf8','#818cf8','#34d399','#f472b6','#fb923c'];
    const ps = Array.from({ length: 20 }, (_, i) => {
      const angle = (i / 20) * 2 * Math.PI + Math.random() * 0.3;
      const dist  = 55 + Math.random() * 90;
      return {
        id:    Date.now() + i,
        endX:  Math.cos(angle) * dist,
        endY:  Math.sin(angle) * dist,
        size:  5 + Math.random() * 10,
        color: colors[Math.floor(Math.random() * colors.length)],
        delay: Math.random() * 0.18,
      };
    });
    setParticles(ps);
    setTimeout(() => setParticles([]), 1400);
  }, []);

  const runAnimationSequence = useCallback(() => {
    clearAllTimers();
    setAnimStage('walking');
    setShockwaveActive(false);
    setParticles([]);

    const t1 = setTimeout(() => setAnimStage('placing'), 2100);
    const t2 = setTimeout(() => {
      setAnimStage('clapping');
      setShockwaveActive(true);
      playClapSound(soundEnabled);
      spawnParticles();
      const ts = setTimeout(() => setShockwaveActive(false), 900);
      timersRef.current.push(ts);
    }, 3200);
    const t3 = setTimeout(() => { setAnimStage('opening'); playMagicChime(soundEnabled); }, 4300);
    const t4 = setTimeout(() => {
      setAnimStage('emerged');
      if (onAnimationComplete) onAnimationComplete();
    }, 5300);
    timersRef.current.push(t1, t2, t3, t4);
  }, [clearAllTimers, onAnimationComplete, soundEnabled, spawnParticles]);

  useEffect(() => {
    runAnimationSequence();
    return () => clearAllTimers();
  }, [runAnimationSequence, clearAllTimers]);

  const handleSkip = () => {
    clearAllTimers(); setAnimStage('emerged'); setShockwaveActive(false);
    if (onAnimationComplete) onAnimationComplete();
  };
  const handleReplay = () => runAnimationSequence();
  const handleInteractiveClap = () => {
    if (animStage === 'placing' || animStage === 'walking') {
      clearAllTimers(); setAnimStage('clapping'); setShockwaveActive(true);
      playClapSound(true); setSoundEnabled(true); spawnParticles();
      const t1 = setTimeout(() => { setAnimStage('opening'); playMagicChime(true); }, 1000);
      const t2 = setTimeout(() => {
        setAnimStage('emerged');
        if (onAnimationComplete) onAnimationComplete();
      }, 2100);
      timersRef.current.push(t1, t2);
    }
  };

  const isEmerged     = animStage === 'emerged';
  const isOpening     = animStage === 'opening' || isEmerged;
  const isWalking     = animStage === 'walking';
  const isPlacing     = animStage === 'placing';
  const showClapBadge = isWalking || isPlacing;

  const loginClass =
    animStage === 'walking' || animStage === 'placing' || animStage === 'clapping'
      ? 'inside-bag'
      : animStage === 'opening' ? 'emerging' : 'emerged';

  return (
    <div
      className={`sla-scene state-${animStage}`}
      style={{ backgroundImage: `url(${schoolHallway})` }}
    >
      {/* Controls */}
      <div className="sla-controls">
        <button type="button" className="sla-ctrl-btn" onClick={() => setSoundEnabled((p) => !p)} aria-label="Toggle Sound">
          {soundEnabled ? <><SoundOnIcon /><span>Sound ON</span></> : <><SoundOffIcon /><span>Sound OFF</span></>}
        </button>
        {!isEmerged
          ? <button type="button" className="sla-ctrl-btn sla-skip-btn" onClick={handleSkip}><span>Skip Intro</span><SkipIcon /></button>
          : <button type="button" className="sla-ctrl-btn" onClick={handleReplay}><ReplayIcon /><span>Replay</span></button>
        }
      </div>

      {/* Stage */}
      <div className="sla-stage">
        <div className="sla-floor-plane" />
        <div className={`sla-floor-glow ${isOpening ? 'active' : ''}`} />

        {/* Character */}
        <div
          className={`sla-character anim-${animStage}`}
          onClick={handleInteractiveClap}
          style={{ cursor: showClapBadge ? 'pointer' : 'default' }}
        >
          {showClapBadge && <div className="sla-clap-badge">👏 Click to Clap!</div>}
          <Character3D phase={animStage} />
        </div>

        {/* Bag */}
        <div className={`sla-bag anim-${animStage}`}>
          <Bag3D phase={animStage} />
        </div>

        {/* Shockwave */}
        <div className={`sla-shockwave ${shockwaveActive ? 'active' : ''}`} />

        {/* Particles */}
        {particles.map((p) => (
          <div key={p.id} className="sla-particle" style={{
            '--end-x': `${p.endX}px`, '--end-y': `${p.endY}px`,
            width: p.size, height: p.size, background: p.color,
            animationDelay: `${p.delay}s`, borderRadius: '50%',
          }} />
        ))}

        {/* Beams */}
        {isOpening && (
          <div className="sla-beams">
            {[0,1,2,3,4,5,6].map((i) => <div key={i} className={`sla-beam sla-beam-${i}`} />)}
          </div>
        )}

        {/* Sparkles */}
        {isOpening && (
          <div className="sla-sparkles">
            {[0,1,2,3,4,5].map((i) => <div key={i} className={`sla-sparkle sla-sparkle-${i}`} />)}
          </div>
        )}
      </div>

      {/* Login card */}
      <div className={`sla-login-wrapper ${loginClass}`}>{children}</div>
    </div>
  );
}
