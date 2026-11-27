export function WindowTitlebar({ title }: { title: string }) {
  return <div className="window-titlebar"><p className="window-title">{title}</p><span className="window-controls" aria-hidden="true"><span>_</span><span>□</span><span>×</span></span></div>;
}
