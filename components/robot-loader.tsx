type RobotLoaderSize = "small" | "medium" | "large";

export function RobotLoader({ size = "medium", label = "Loading…" }: { size?: RobotLoaderSize; label?: string }) {
  return <span className={`robot-loader robot-loader-${size}`} role="status" aria-live="polite">
    <span className="robot-loader-art" aria-hidden="true">
      <span className="robot-loader-antenna" />
      <span className="robot-loader-head"><span /><span /><i /></span>
      <span className="robot-loader-body"><b>GCS</b><em>•••</em></span>
    </span>
    <span className="robot-loader-label">{label}</span>
  </span>;
}
