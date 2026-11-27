type RetroLoaderSize = "small" | "medium" | "large";

export function RetroLoader({ size = "medium", label = "Loading…" }: { size?: RetroLoaderSize; label?: string }) {
  return <span className={`retro-loader retro-loader-${size}`} role="status" aria-live="polite">
    <span className="retro-loader-bar" aria-hidden="true" />
    <span className="retro-loader-label">{label}</span>
  </span>;
}
