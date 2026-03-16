export function GlassBtnStyles() {
  return (
    <style>{`
      .glass-btn::before {
        content: '';
        position: absolute;
        inset: 0;
        border-radius: inherit;
        padding: 1px;
        opacity: 0.1;
        background: conic-gradient(
          from 0deg,
          rgba(180,180,180,0.6) 3%,
          rgba(160,160,160,0.5) 9%,
          rgba(255,255,255,0.7) 17%,
          rgba(255,255,255,0.7) 30%,
          rgba(160,160,160,0.5) 52%,
          rgba(255,255,255,0.8) 58%,
          rgba(255,255,255,0.7) 80%,
          rgba(220,220,220,0.6) 91%,
          rgba(180,180,180,0.6) 100%
        );
        -webkit-mask:
          linear-gradient(#fff 0 0) content-box,
          linear-gradient(#fff 0 0);
        -webkit-mask-composite: xor;
        mask-composite: exclude;
        pointer-events: none;
      }
    `}</style>
  );
}
