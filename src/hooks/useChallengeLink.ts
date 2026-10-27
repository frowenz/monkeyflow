import { useEffect } from "react";
import { create } from "zustand";
import {
  CHALLENGE_PARAMS,
  challengeConfig,
  challengeMatchesTest,
  hasChallengeParams,
  parseChallenge,
  type Challenge,
} from "../lib/share";
import { getConfig, useConfig } from "../store/config";
import { useTest } from "../store/test";
import { notify, useUi } from "../store/ui";

interface ChallengeState {
  /** Cleared as soon as a test that isn't the challenged one starts; "repeat test" keeps it. */
  challenge: Challenge | null;
  bannerDismissed: boolean;
  dismissBanner: () => void;
}

export const useChallenge = create<ChallengeState>((set) => ({
  challenge: null,
  bannerDismissed: false,
  dismissBanner: () => set({ bannerDismissed: true }),
}));

let unwatch: (() => void) | null = null;

function watchTests() {
  unwatch?.();
  let lastId = useTest.getState().testId;
  unwatch = useTest.subscribe((s) => {
    if (s.testId === lastId) return;
    lastId = s.testId;
    const { challenge } = useChallenge.getState();
    if (challenge && !challengeMatchesTest(challenge, s, getConfig())) {
      useChallenge.setState({ challenge: null, bannerDismissed: false });
      unwatch?.();
      unwatch = null;
    } else if (challenge?.wpm) {
      useTest.getState().setPaceOverride(challenge.wpm);
    }
  });
}

export function loadChallenge(challenge: Challenge) {
  useUi.getState().setPage("test");
  useConfig.getState().patch(challengeConfig(challenge));
  useTest.getState().newTest(challenge.kind === "quote" ? { quoteId: challenge.quoteId } : { seed: challenge.seed });
  if (challenge.wpm) useTest.getState().setPaceOverride(challenge.wpm);
  useChallenge.setState({ challenge, bannerDismissed: false });
  watchTests();
}

function stripChallengeParams(params: URLSearchParams) {
  for (const key of CHALLENGE_PARAMS) params.delete(key);
  const rest = params.toString();
  window.history.replaceState(window.history.state, "", `${window.location.pathname}${rest ? `?${rest}` : ""}${window.location.hash}`);
}

let handled = false;

/** Loads a challenge from `?q=` / `?m=&n=&s=` links once on startup. */
export function useChallengeLink() {
  useEffect(() => {
    if (handled) return;
    handled = true;
    const params = new URLSearchParams(window.location.search);
    if (!hasChallengeParams(params)) return;
    const challenge = parseChallenge(params);
    stripChallengeParams(params);
    if (challenge) loadChallenge(challenge);
    else notify("That challenge link is broken or expired", "error");
  }, []);
}
