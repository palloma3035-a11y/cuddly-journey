export function HopOnLogo({ size = 40 }: { size?: number }) {
  return (
    <div
      className="bg-brand-gradient grid place-items-center rounded-2xl shadow-glow"
      style={{ width: size, height: size }}
      aria-label="HopOn logo"
    >
      <span className="font-black text-white" style={{ fontSize: size * 0.55 }}>
        H
      </span>
    </div>
  );
}

export function HopOnWordmark() {
  return (
    <div className="flex items-center gap-2">
      <HopOnLogo size={32} />
      <span className="text-xl font-black tracking-tight">
        Hop<span className="text-brand-gradient">On</span>
      </span>
    </div>
  );
}
