# Monkey Flow

monkeytype, but you talk. A pixel-close clone of [monkeytype.com](https://monkeytype.com) where you read the words out loud instead of typing them. A fan-made tribute, not affiliated with Monkeytype.

- **Built-in voice**: press <kbd>enter</kbd> or click the mic and read. Uses the browser's Web Speech API (Chrome, Edge, Safari).
- **Wispr Flow**: just dictate into the test. Pasted dictation is detected automatically; the mic then only keeps time.
- Modes: time, words, quote (incl. a daily challenge), zen, custom. Word sets: english, english 1k, tongue twisters, spanish, french, german, portuguese, italian.
- Results screen with chart, words history, screenshot, challenge links and share-to-X; 187 monkeytype themes; command line (<kbd>esc</kbd>).

## Develop

```bash
pnpm install
pnpm dev          # http://localhost:5173
pnpm test         # vitest (alignment, speech pipeline, sharing, daily)
pnpm build        # typecheck + production build into dist/
```

Speech recognition needs a secure context: `localhost` works, anything else must be served over HTTPS.

`window.monkeyflow` exposes a debug/demo API in the browser console:

- `monkeyflow.speakTest(wpm, accuracy)` streams simulated recognition results through the real pipeline
- `monkeyflow.state()` dumps the current alignment, result and recognizer log

## Deploy

`dist/` is a static single-page app. Any static host works as long as unknown paths fall back to `index.html` (routes: `/`, `/settings`, `/about`, `/leaderboards`, `/login`). Once the final domain is known, change `og:image` / `twitter:image` in `index.html` to absolute URLs so link previews render on X.

## How scoring works

`src/lib/align.ts` aligns spoken tokens to the target words sequentially, like monkeytype: a wrong word takes the next slot and turns red, while a skipped or extra word only re-syncs once two following words confirm it. `src/lib/normalize.ts` forgives only what you can't hear: case, punctuation, silent apostrophes, homophones (there/their), spoken numbers (twenty five / 25) and compounds (every day / everyday). wpm, raw, accuracy and consistency follow monkeytype's formulas; the clock starts and stops on detected voice activity so recognizer latency doesn't skew results.
