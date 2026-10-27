import { useState, type FormEvent } from "react";
import { notify } from "../store/ui";
import "../styles/pages.css";

const COMING_SOON = "Accounts are coming soon. Your results are saved locally on this device.";

function comingSoon(e?: FormEvent) {
  e?.preventDefault();
  notify(COMING_SOON, "notice");
}

const REGISTER_FIELDS: { name: string; placeholder: string; type: string; autoComplete: string }[] = [
  { name: "username", placeholder: "username", type: "text", autoComplete: "new-username" },
  { name: "email", placeholder: "email", type: "text", autoComplete: "new-email" },
  { name: "emailVerify", placeholder: "verify email", type: "text", autoComplete: "verify-email" },
  { name: "password", placeholder: "password", type: "password", autoComplete: "new-password" },
  { name: "passwordVerify", placeholder: "verify password", type: "password", autoComplete: "verify-password" },
];

export function LoginPage() {
  const [register, setRegister] = useState<Record<string, string>>({});
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);

  const registerFilled = REGISTER_FIELDS.every((f) => (register[f.name] ?? "").length > 0);
  const loginFilled = email.length > 0 && password.length > 0;

  return (
    <main className="page pageLogin">
      <div className="loginWrap">
        <div className="loginColumn">
          <h3>
            <i className="fas fa-user-plus" />
            register
          </h3>
          <form autoComplete="off" onSubmit={comingSoon}>
            {REGISTER_FIELDS.map((f) => (
              <input
                key={f.name}
                className="input"
                name={f.name}
                type={f.type}
                placeholder={f.placeholder}
                autoComplete={f.autoComplete}
                value={register[f.name] ?? ""}
                onChange={(e) => setRegister({ ...register, [f.name]: e.target.value })}
              />
            ))}
            <button type="submit" className={`button ${registerFilled ? "" : "dim"}`}>
              <i className="fas fa-user-plus" />
              sign up
            </button>
          </form>
        </div>

        <div className="loginColumn">
          <h3>
            <i className="fas fa-sign-in-alt" />
            login
          </h3>
          <div className="oauth">
            <button type="button" className="button" aria-label="Sign in with Google" onClick={() => comingSoon()}>
              <i className="fab fa-google" />
            </button>
            <button type="button" className="button" aria-label="Sign in with GitHub" onClick={() => comingSoon()}>
              <i className="fab fa-github" />
            </button>
          </div>
          <form onSubmit={comingSoon}>
            <div className="orRow">
              <div className="line" />
              <div>or</div>
              <div className="line" />
            </div>
            <input
              className="input"
              name="email"
              type="text"
              placeholder="email"
              autoComplete="current-email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
            <input
              className="input"
              name="password"
              type="password"
              placeholder="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            <div>
              <label className="checkbox">
                <input
                  type="checkbox"
                  name="rememberMe"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <div className="box">
                  <i className="fas fa-check" />
                </div>
                <div>remember me</div>
              </label>
            </div>
            <button type="submit" className={`button ${loginFilled ? "" : "dim"}`}>
              <i className="fas fa-sign-in-alt" />
              sign in
            </button>
          </form>
          <button type="button" className="textButton forgot" onClick={() => comingSoon()}>
            forgot password?
          </button>
        </div>
      </div>
    </main>
  );
}
