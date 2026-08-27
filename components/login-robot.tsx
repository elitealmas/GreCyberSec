export function LoginRobot() {
  return <aside className="login-robot" aria-label="A friendly security reminder">
    <div className="robot-art" aria-hidden="true">
      <span className="robot-antenna" />
      <div className="robot-head"><span className="robot-eye" /><span className="robot-eye" /><span className="robot-mouth">_</span></div>
      <div className="robot-body"><span>010</span><span className="robot-keyboard">⌨</span></div>
      <div className="robot-arms"><span>╲</span><span>╱</span></div>
    </div>
    <p className="eyebrow">GCS security bot</p>
    <p className="robot-prompt">Can you hack the login page?</p>
    <p className="robot-reply">Nice try. Keep your password strong and let the robot handle the checks.</p>
  </aside>;
}
