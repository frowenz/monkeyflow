import { useEffect, useState } from "react";
import { useConfig } from "../../store/config";
import { currentAcc, currentWpm, useTest } from "../../store/test";

export function LiveStats() {
  const status = useTest((s) => s.status);
  const elapsed = useTest((s) => s.elapsed);
  const caretWord = useTest((s) => s.alignment.caretWord);
  const total = useTest((s) => s.targets.length);
  const { mode, time, liveSpeed, liveAcc, timerStyle } = useConfig();
  const [wpm, setWpm] = useState(0);
  const [acc, setAcc] = useState(100);

  useEffect(() => {
    if (status !== "active") return;
    const id = window.setInterval(() => {
      setWpm(currentWpm());
      setAcc(currentAcc());
    }, 250);
    return () => clearInterval(id);
  }, [status]);

  useEffect(() => {
    if (status === "idle") {
      setWpm(0);
      setAcc(100);
    }
  }, [status]);

  let timerText = "";
  if (mode === "time") timerText = String(Math.max(0, Math.ceil(time - elapsed)));
  else if (mode === "zen") timerText = String(Math.floor(elapsed));
  else timerText = `${Math.min(caretWord, total)}/${total}`;

  const visible = status === "active";

  return (
    <div id="liveStatsMini" className={visible ? "visible" : ""}>
      {timerStyle !== "off" && <div className="time">{timerText}</div>}
      {liveSpeed !== "off" && <div className="speed">{Math.round(wpm)}</div>}
      {liveAcc !== "off" && <div className="acc">{Math.floor(acc)}%</div>}
    </div>
  );
}
