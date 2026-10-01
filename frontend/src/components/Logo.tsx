export default function Logo({ size = 36 }: { size?: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand-400 to-brand-600 shadow-[var(--shadow-card)]"
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg viewBox="0 0 64 64" style={{ width: size * 0.62, height: size * 0.62 }}>
        <circle cx="28" cy="28" r="12" fill="none" stroke="#fff" strokeWidth="6" />
        <line x1="37" y1="37" x2="48" y2="48" stroke="#fff" strokeWidth="6" strokeLinecap="round" />
        <line x1="22" y1="25" x2="34" y2="25" stroke="#c7d2fe" strokeWidth="4" strokeLinecap="round" />
        <line x1="22" y1="31" x2="30" y2="31" stroke="#c7d2fe" strokeWidth="4" strokeLinecap="round" />
      </svg>
    </span>
  );
}
