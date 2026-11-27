export function LoginRobot() {
  return <aside className="login-robot window" aria-label="A friendly security reminder">
    <div className="window-titlebar"><p className="window-title">Security Warning</p><span className="window-controls" aria-hidden="true"><span>?</span><span>×</span></span></div>
    <div className="dialog-body">
      <span className="dialog-icon" aria-hidden="true"><span>!</span></span>
      <div><p className="eyebrow">GCS security bot</p><p className="robot-prompt mt-2">Can you hack the login page?</p><p className="robot-reply">Nice try. Keep your password strong and let the bot handle the checks.</p></div>
    </div>
    <div className="dialog-actions" aria-hidden="true"><span className="button dialog-ok">OK</span></div>
  </aside>;
}
