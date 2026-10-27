import { useChallenge } from "../../hooks/useChallengeLink";
import { useTest } from "../../store/test";
import "../../styles/result.css";

export function ChallengeBanner() {
  const challenge = useChallenge((s) => s.challenge);
  const dismissed = useChallenge((s) => s.bannerDismissed);
  const active = useTest((s) => s.status === "active");

  if (!challenge || dismissed) return null;

  return (
    <div id="challengeBanner" className={active ? "hidden" : ""} role="status">
      <i className="fas fa-crown" />
      {challenge.wpm !== null ? (
        <span>
          <span className="label">
            {challenge.kind === "quote" && challenge.daily ? `daily #${challenge.daily}: ` : "challenge: "}
          </span>
          beat <span className="value">{challenge.wpm}</span> wpm
          {challenge.acc !== null && (
            <>
              {" "}
              <span className="sep">·</span> <span className="value">{challenge.acc}%</span> acc
            </>
          )}
        </span>
      ) : (
        <span>challenge: same words as your friend</span>
      )}
      <button
        type="button"
        className="textButton dismiss"
        aria-label="Dismiss challenge"
        data-balloon-pos="up"
        onMouseDown={(e) => e.preventDefault()}
        onClick={(e) => {
          e.stopPropagation();
          useChallenge.getState().dismissBanner();
        }}
      >
        <i className="fas fa-times" />
      </button>
    </div>
  );
}
