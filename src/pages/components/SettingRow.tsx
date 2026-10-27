import type { ReactNode } from "react";
import { useConfig, type Config } from "../../store/config";
import { notify } from "../../store/ui";
import type { Option } from "./options";

export function OptionButtons<K extends keyof Config>({
  setting,
  options,
  after,
}: {
  setting: K;
  options: Option<Config[K]>[];
  after?: () => void;
}) {
  const value = useConfig((s) => s[setting]);
  return (
    <div className="optionButtons">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          className={`button ${value === o.value ? "active" : ""}`}
          onClick={() => {
            if (useConfig.getState()[setting] === o.value) return;
            useConfig.getState().set(setting, o.value);
            after?.();
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function copyLink(id: string) {
  const url = `${window.location.origin}/settings#${id}`;
  navigator.clipboard?.writeText(url).then(
    () => notify("Link copied to clipboard", "success"),
    () => notify(url, "notice", "Link"),
  );
}

export function SettingRow({
  id,
  icon,
  title,
  description,
  control,
  wide,
  extra,
  highlighted,
}: {
  id: string;
  icon: string;
  title: string;
  description: ReactNode;
  control?: ReactNode;
  wide?: boolean;
  extra?: ReactNode;
  highlighted?: boolean;
}) {
  return (
    <div id={id} className={`settingRow ${wide ? "wide" : ""} ${highlighted ? "highlight" : ""}`}>
      <div className="titleRow">
        <h3>
          <i className={icon} />
          {title}
        </h3>
        <button
          type="button"
          className="textButton linkButton"
          aria-label="Copy link to this setting"
          onClick={() => copyLink(id)}
        >
          <i className="fas fa-link" />
        </button>
      </div>
      <div className="settingBody">
        <div className="description">{description}</div>
        {control && <div className="control">{control}</div>}
      </div>
      {extra}
    </div>
  );
}
