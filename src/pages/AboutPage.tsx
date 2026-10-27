import { useMemo } from "react";
import { lifetimeStats, savedResults } from "../store/test";
import { useUi } from "../store/ui";
import { formatDuration } from "./components/format";
import { WpmHistogram } from "./components/WpmHistogram";
import "../styles/pages.css";

const LINKS: { icon: string; label: string; href: string }[] = [
  { icon: "fas fa-keyboard", label: "monkeytype", href: "https://monkeytype.com" },
  { icon: "fas fa-microphone-alt", label: "wispr flow", href: "https://wisprflow.ai" },
  {
    icon: "fas fa-globe",
    label: "web speech",
    href: "https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API",
  },
  { icon: "fab fa-github", label: "github", href: "https://github.com/monkeytypegame/monkeytype" },
];

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      <div className="unit">{unit}</div>
    </div>
  );
}

function Credit({ name, href, children }: { name: string; href: string; children: string }) {
  return (
    <p>
      <a className="textButton" href={href} target="_blank" rel="noreferrer noopener">
        {name}
      </a>
      {children}
    </p>
  );
}

export function AboutPage() {
  const results = useMemo(() => savedResults(), []);
  const lifetime = useMemo(() => lifetimeStats(), []);
  const tests = Math.max(lifetime.tests, results.length);
  const seconds = Math.max(lifetime.seconds, results.reduce((sum, r) => sum + (r.time || 0), 0));
  const speaking = formatDuration(seconds);
  const best = Math.max(lifetime.best, results.reduce((m, r) => Math.max(m, r.wpm || 0), 0));
  const goToTest = () => useUi.getState().setPage("test");

  return (
    <main className="page pageAbout">
      <section className="aboutIntro">
        Built for people who talk faster than they type.
        <br />
        Inspired by and styled after{" "}
        <a href="https://monkeytype.com" target="_blank" rel="noreferrer noopener">
          Monkeytype
        </a>{" "}
        by Miodec.
        <br />
        Powered by your voice and{" "}
        <a href="https://wisprflow.ai" target="_blank" rel="noreferrer noopener">
          Wispr Flow
        </a>
        .
      </section>

      <section className="aboutStats">
        <Stat
          label="total tests completed"
          value={String(tests)}
          unit={tests === 1 ? "test" : "tests"}
        />
        <Stat label="total time speaking" value={speaking.value} unit={speaking.unit} />
        <Stat label="best speed" value={String(Math.round(best))} unit="wpm" />
      </section>

      <section className="aboutChart">
        <WpmHistogram values={results.map((r) => r.wpm)} />
        <div className="chartLabel">
          distribution of your results (wpm)
          <br />
          {results.length} saved {results.length === 1 ? "result" : "results"} on this device
        </div>
      </section>

      <section>
        <h2>
          <i className="fas fa-info-circle" />
          about
        </h2>
        <p>
          Monkey Flow is monkeytype, but you talk. It is a minimalistic voice typing test: read the words out loud and
          watch them light up as you say them. It keeps everything that makes monkeytype great - the themes, the smooth
          caret, the test modes and the results screen - and swaps your keyboard for your voice.
          <br />
          <br />
          Find out how fast you really speak, track your progress and see how far ahead of your typing speed you are.
        </p>
      </section>

      <section>
        <h3>
          <i className="fas fa-microphone-alt" />
          how it works
        </h3>
        <p>
          Turn on the mic and Monkey Flow streams your browser's speech recognition, matching every word as you say it.
          Prefer Wispr Flow (or any other dictation app)? Just dictate into the test - it's detected automatically, the
          app does the typing and your mic is only used to time you. Either way, the words you spoke are aligned to the words on screen, so a dropped or
          extra word doesn't derail the rest of the test. In lenient mode, homophones (there / their / they're) and
          spoken numbers ("four" for 4) count as correct.
        </p>
      </section>

      <section>
        <h3>
          <i className="fas fa-list-ol" />
          stats
        </h3>
        <dl>
          <dt>wpm</dt>
          <dd>
            - total number of characters in the correctly spoken words (including spaces), divided by 5 and normalised
            to 60 seconds.
          </dd>
          <dt>raw wpm</dt>
          <dd>- calculated just like wpm, but also includes incorrect words.</dd>
          <dt>acc</dt>
          <dd>- percentage of characters in words that were spoken correctly.</dd>
          <dt>consistency</dt>
          <dd>
            - based on the variance of your raw wpm. Closer to 100% is better. Calculated using the coefficient of
            variation of raw wpm and mapped onto a scale from 0 to 100.
          </dd>
        </dl>
      </section>

      <section>
        <h3>
          <i className="fas fa-keyboard" />
          keybinds
        </h3>
        <p>
          Press <kbd>enter</kbd> to start or stop listening. You can use <kbd>tab &gt; enter</kbd> to restart the test.
          Open the command line by pressing <kbd>escape</kbd>&nbsp;or&nbsp;<kbd>ctrl + shift + p</kbd> - there you can
          access all the functionality you need without touching your mouse.
        </p>
      </section>

      <section>
        <h3>
          <i className="fas fa-comment-dots" />
          voice commands
        </h3>
        <p>
          When the results screen is showing, say "next" to start a new test or "again" to repeat the same one, without
          ever reaching for your keyboard. You can turn voice commands off in the settings.
        </p>
      </section>

      <section>
        <h3>
          <i className="fas fa-bolt" />
          tips for a fast run
        </h3>
        <ul className="aboutTips">
          <li>Speak clearly at a steady pace - rushing makes the recognizer guess, and guesses cost accuracy.</li>
          <li>Try quote mode: real sentences read naturally, so your speed goes up compared to random words.</li>
          <li>Use a good microphone in a quiet room, and keep it at a consistent distance from your mouth.</li>
          <li>Look a word or two ahead, just like you would when reading out loud.</li>
        </ul>
      </section>

      <section>
        <h2>
          <i className="fas fa-play-circle" />
          get started
        </h2>
        <p>Ready? Head back to the test, press enter and start talking.</p>
        <div className="bigButtons single">
          <button type="button" className="button" onClick={goToTest}>
            <i className="fas fa-microphone" />
            start talking
          </button>
        </div>
      </section>

      <section>
        <h2>
          <i className="fas fa-link" />
          links
        </h2>
        <p>Monkey Flow stands on the shoulders of these projects - go check them out.</p>
        <div className="bigButtons">
          {LINKS.map((l) => (
            <a key={l.label} className="button" href={l.href} target="_blank" rel="noreferrer noopener">
              <i className={l.icon} />
              {l.label}
            </a>
          ))}
        </div>
      </section>

      <section className="credits">
        <h2>
          <i className="fas fa-users" />
          credits
        </h2>
        <Credit name="Monkeytype" href="https://monkeytype.com">
          by Miodec, which this site is inspired by and styled after. Monkey Flow is a fan-made tribute and is not
          affiliated with Monkeytype.
        </Credit>
        <Credit name="Wispr Flow" href="https://wisprflow.ai">
          for voice dictation that types anywhere - just dictate into the test and it's picked up automatically.
        </Credit>
        <Credit name="Your browser" href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Speech_API">
          for the built-in speech recognition behind the default voice engine.
        </Credit>
        <Credit name="Everyone" href="https://monkeytype.com/about">
          who helped build monkeytype - the contributors, supporters and theme makers this tribute is built on.
        </Credit>
      </section>
    </main>
  );
}
