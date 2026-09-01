"use client";

import { useEffect, useState } from "react";

export function SiteIntro() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setLeaving(true), 3200);
    const finishTimer = window.setTimeout(() => setVisible(false), 3900);
    return () => { window.clearTimeout(leaveTimer); window.clearTimeout(finishTimer); };
  }, []);

  function skipIntro() {
    setLeaving(true);
    window.setTimeout(() => setVisible(false), 520);
  }

  if (!visible) return null;

  return <section className={leaving ? "site-intro site-intro-leaving" : "site-intro"} aria-label="GreCyberSec welcome">
    <div className="site-intro-grid" aria-hidden="true" />
    <button className="site-intro-skip" type="button" onClick={skipIntro}>Skip intro <span aria-hidden="true">→</span></button>
    <div className="site-intro-content">
      <div className="intro-robot" aria-hidden="true"><span className="intro-robot-antenna" /><span className="intro-robot-head"><i /><i /><b /></span><span className="intro-robot-body"><em>GCS</em><small>•••</small></span></div>
      <p className="intro-kicker">Welcome // GreCyberSec</p>
      <h1>Secure minds.<br /><span>Curious futures.</span></h1>
      <p className="intro-quote">“Curiosity finds the signal. Responsibility keeps it secure.”</p>
      <p className="intro-status"><span aria-hidden="true" />Establishing your learning space</p>
    </div>
  </section>;
}
