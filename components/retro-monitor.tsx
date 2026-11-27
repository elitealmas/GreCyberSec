export function RetroMonitor({ label = "SEC" }: { label?: string }) {
  return <div className="retro-monitor" role="img" aria-label="GreCyberSec terminal icon">
    <span className="retro-monitor-case"><span className="retro-monitor-screen">C:\{label}&gt;<span className="prompt-cursor" /></span><span className="retro-monitor-led" /></span>
    <span className="retro-monitor-stand" />
    <span className="retro-monitor-base" />
  </div>;
}
