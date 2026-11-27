"use client";

import { useEffect, useState } from "react";

export function SiteIntro() {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setLeaving(true), 3300);
    const finishTimer = window.setTimeout(() => setVisible(false), 3750);
    return () => { window.clearTimeout(leaveTimer); window.clearTimeout(finishTimer); };
  }, []);

  function skipIntro() {
    setLeaving(true);
    window.setTimeout(() => setVisible(false), 450);
  }

  if (!visible) return null;

  return <section className={leaving ? "site-intro site-intro-leaving" : "site-intro"} aria-label="GreCyberSec welcome">
    <button className="site-intro-skip" type="button" onClick={skipIntro}>Skip intro <span aria-hidden="true">→</span></button>
    <div className="site-intro-content">
      <ul className="boot-lines" aria-hidden="true">
        <li>GCS BIOS v26.11 — GreCyberSec, University of Greenwich</li>
        <li>Memory test ............ <span className="boot-ok">640K OK</span></li>
        <li>Detecting curiosity .... <span className="boot-ok">FOUND</span></li>
        <li>Checking responsibility  <span className="boot-ok">ENABLED</span></li>
        <li>Loading SOCIETY.EXE .... <span className="boot-bar">████████████</span></li>
      </ul>
      <h1>Secure minds.<br /><span>Curious futures.</span></h1>
      <p className="intro-quote">“Curiosity finds the signal. Responsibility keeps it secure.”</p>
      <p className="intro-status">C:\GRECYBERSEC&gt; establishing your learning space<span className="prompt-cursor" aria-hidden="true" /></p>
    </div>
  </section>;
}
