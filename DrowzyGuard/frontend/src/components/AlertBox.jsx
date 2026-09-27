import { useEffect } from "react";

// The alarm tone is generated with the Web Audio API, so no sound file is needed.
// Browsers only allow audio after a user action, so call unlockAlarm() from a
// click handler (the Start button) before the alarm may need to play.
const BEEP_EVERY_MS = 500;
const BEEP_LENGTH_S = 0.25;
const TONES = [880, 660]; // alternating high/low tones

let audioContext = null;

export function unlockAlarm() {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return;
  audioContext ??= new AudioContextClass();
  if (audioContext.state === "suspended") audioContext.resume();
}

function beep(frequency) {
  if (!audioContext || audioContext.state !== "running") return;
  const now = audioContext.currentTime;
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = "square";
  oscillator.frequency.value = frequency;
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.2, now + 0.02); // short fade avoids clicks
  gain.gain.exponentialRampToValueAtTime(0.0001, now + BEEP_LENGTH_S);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + BEEP_LENGTH_S);
}

export default function AlertBox({ active, score }) {
  useEffect(() => {
    if (!active) return undefined;
    let count = 0;
    const play = () => beep(TONES[count++ % TONES.length]);
    play();
    const timer = setInterval(play, BEEP_EVERY_MS);
    return () => clearInterval(timer); // stops the alarm when inactive or unmounted
  }, [active]);

  if (!active) return null;

  return (
    <div className="alert-box" role="alert">
      <span className="alert-icon" aria-hidden="true">⚠️</span>
      <div className="alert-text">
        <strong>DROWSINESS DETECTED</strong>
        <span>Drowsiness score {score}% — please stay alert!</span>
      </div>
      <span className="alarm-badge">ALARM ACTIVE</span>
    </div>
  );
}
