import {
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { createUser, getCurrentSession, signIn, signOut, userExists } from "../auth";
import { AccountPanel } from "./AccountPanel";
import { CosmicAuthBackground } from "./CosmicAuthBackground";

const DEV_VERIFICATION_CODE = "123456";

type AuthMode = "signin" | "signup";
type SignupStep = "email" | "verify" | "password";

interface Props {
  children: ReactNode;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

export function AuthGate({ children }: Props) {
  const [sessionEmail, setSessionEmail] = useState<string | null>(() => getCurrentSession());
  const [mode, setMode] = useState<AuthMode>("signin");
  const [signupStep, setSignupStep] = useState<SignupStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [cookiesAccepted, setCookiesAccepted] = useState(false);
  const [message, setMessage] = useState<{ text: string; ok: boolean } | null>(null);
  const [showAbout, setShowAbout] = useState(true);
  const [showTerms, setShowTerms] = useState(false);
  const [showCookies, setShowCookies] = useState(false);
  const codeInputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const [showAccount, setShowAccount] = useState(false);

  const handleLogout = () => {
    signOut();
    setSessionEmail(null);
    setMode("signin");
    setSignupStep("email");
    setEmail("");
    setPassword("");
    setCode("");
    setTermsAccepted(false);
    setCookiesAccepted(false);
    setMessage(null);
    setShowAccount(false);
  };

  if (sessionEmail) {
    return (
      <>
        <div className="auth-topbar">
          <button
            type="button"
            className="auth-account-btn"
            onClick={() => setShowAccount((v) => !v)}
            aria-label="Open account"
            aria-expanded={showAccount}
          >
            <span className="auth-account-avatar" aria-hidden="true">
              {sessionEmail.slice(0, 2).toUpperCase()}
            </span>
            My Account
          </button>
          <button
            type="button"
            className="auth-logout-btn"
            onClick={handleLogout}
          >
            Log Out
          </button>
        </div>

        {showAccount && (
          <AccountPanel
            email={sessionEmail}
            onClose={() => setShowAccount(false)}
            onDeleted={handleLogout}
          />
        )}

        {children}
      </>
    );
  }

  const resetForm = (nextMode: AuthMode) => {
    setMode(nextMode);
    setSignupStep("email");
    setEmail("");
    setPassword("");
    setCode("");
    setTermsAccepted(false);
    setCookiesAccepted(false);
    setMessage(null);
  };

  const handleSignin = (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    try {
      const user = signIn(email, password);
      setSessionEmail(user.email);
    } catch (error: any) {
      setMessage({ text: error.message || "Sign in failed.", ok: false });
    }
  };

  const handleSignupEmail = (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (!isValidEmail(email)) {
      setMessage({ text: "Enter a valid email address.", ok: false });
      return;
    }
    if (userExists(email)) {
      setMessage({ text: "This email already has an account. Sign in instead.", ok: false });
      return;
    }
    setSignupStep("verify");
    setMessage({
      text: "Development verification code sent. Use 123456.",
      ok: true,
    });
  };

  const handleVerification = (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (code.replace(/\s/g, "") !== DEV_VERIFICATION_CODE) {
      setMessage({ text: "Verification code is incorrect.", ok: false });
      return;
    }
    setSignupStep("password");
    setMessage({ text: "Email verified. Create your password.", ok: true });
  };

  const focusCodeInput = (index: number) => {
    window.setTimeout(() => {
      codeInputRefs.current[index]?.focus();
      codeInputRefs.current[index]?.select();
    }, 0);
  };

  const applyCodeDigits = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 6 - index);
    const next = code.padEnd(6, " ").slice(0, 6).split("");

    if (!digits) {
      next[index] = " ";
      setCode(next.join(""));
      return;
    }

    digits.split("").forEach((digit, offset) => {
      next[index + offset] = digit;
    });
    setCode(next.join(""));

    const nextFocusIndex = Math.min(index + digits.length, 5);
    if (nextFocusIndex !== index) {
      focusCodeInput(nextFocusIndex);
    }
  };

  const handleCodeDigitChange = (index: number, value: string) => {
    applyCodeDigits(index, value);
  };

  const handleCodeInput = (index: number, event: FormEvent<HTMLInputElement>) => {
    const value = event.currentTarget.value;
    if (value) {
      applyCodeDigits(index, value);
    }
  };

  const handleCodeKeyDown = (index: number, event: KeyboardEvent<HTMLInputElement>) => {
    if (/^\d$/.test(event.key)) {
      event.preventDefault();
      applyCodeDigits(index, event.key);
      return;
    }

    if (event.key === "Backspace") {
      event.preventDefault();
      const next = code.padEnd(6, " ").slice(0, 6).split("");
      if (next[index]?.trim()) {
        next[index] = " ";
        setCode(next.join(""));
      } else if (index > 0) {
        next[index - 1] = " ";
        setCode(next.join(""));
        focusCodeInput(index - 1);
      }
      return;
    }

    if (event.key === "ArrowLeft" && index > 0) {
      event.preventDefault();
      focusCodeInput(index - 1);
    }
    if (event.key === "ArrowRight" && index < 5) {
      event.preventDefault();
      focusCodeInput(index + 1);
    }
  };

  const handleCodePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    setCode(pasted.padEnd(6, " "));
    const focusIndex = Math.min(Math.max(pasted.length, 1), 6) - 1;
    focusCodeInput(focusIndex);
  };

  const handleCreatePassword = (event: FormEvent) => {
    event.preventDefault();
    setMessage(null);
    if (password.length < 8) {
      setMessage({ text: "Password must be at least 8 characters.", ok: false });
      return;
    }
    if (!termsAccepted || !cookiesAccepted) {
      setMessage({ text: "Accept the user terms and cookies policy to continue.", ok: false });
      return;
    }
    try {
      const user = createUser(email, password);
      setSessionEmail(user.email);
    } catch (error: any) {
      setMessage({ text: error.message || "Could not create account.", ok: false });
    }
  };

  return (
    <main className="auth-shell">
      <CosmicAuthBackground />
      <section className="auth-panel" aria-label="Authentication">
        <div className="auth-brand">
          <h1>Spendo</h1>
          <p>Sign in to open your personal finance dashboard.</p>
        </div>

        <div className="auth-tabs" role="tablist" aria-label="Authentication options">
          <button
            className={`auth-tab ${mode === "signin" ? "active" : ""}`}
            onClick={() => resetForm("signin")}
            type="button"
          >
            Sign In
          </button>
          <button
            className={`auth-tab ${mode === "signup" ? "active" : ""}`}
            onClick={() => resetForm("signup")}
            type="button"
          >
            Sign Up
          </button>
        </div>

        {mode === "signin" && (
          <form className="auth-form" onSubmit={handleSignin}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="current-password"
                required
              />
            </label>
            <button className="auth-primary-btn" type="submit">Sign In</button>
          </form>
        )}

        {mode === "signup" && signupStep === "email" && (
          <form className="auth-form" onSubmit={handleSignupEmail}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </label>
            <button className="auth-primary-btn" type="submit">Send Verification Code</button>
          </form>
        )}

        {mode === "signup" && signupStep === "verify" && (
          <form className="auth-form" onSubmit={handleVerification}>
            <div className="auth-step-note">Code sent to {email.trim().toLowerCase()}</div>
            <fieldset className="auth-code-field">
              <legend>Verification Code</legend>
              <div className="auth-code-grid" aria-label="Six digit verification code">
                {Array.from({ length: 6 }).map((_, index) => (
                  <input
                    key={index}
                    ref={(element) => {
                      codeInputRefs.current[index] = element;
                    }}
                    type="text"
                    inputMode="numeric"
                    autoComplete={index === 0 ? "one-time-code" : "off"}
                    value={code[index]?.trim() ?? ""}
                    onChange={(event) => handleCodeDigitChange(index, event.target.value)}
                    onInput={(event) => handleCodeInput(index, event)}
                    onKeyDown={(event) => handleCodeKeyDown(index, event)}
                    onPaste={handleCodePaste}
                    aria-label={`Verification code digit ${index + 1}`}
                    required
                  />
                ))}
              </div>
            </fieldset>
            <button className="auth-primary-btn" type="submit">Verify Email</button>
          </form>
        )}

        {mode === "signup" && signupStep === "password" && (
          <form className="auth-form" onSubmit={handleCreatePassword}>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoComplete="new-password"
                required
              />
            </label>

            <label className="auth-check">
              <input
                type="checkbox"
                checked={termsAccepted}
                onChange={(event) => setTermsAccepted(event.target.checked)}
              />
              <span>
                I agree to the{" "}
                <button type="button" className="auth-link" onClick={() => setShowTerms(true)}>
                  User Terms
                </button>
              </span>
            </label>

            <label className="auth-check">
              <input
                type="checkbox"
                checked={cookiesAccepted}
                onChange={(event) => setCookiesAccepted(event.target.checked)}
              />
              <span>
                I accept the{" "}
                <button type="button" className="auth-link" onClick={() => setShowCookies(true)}>
                  Cookies Policy
                </button>
              </span>
            </label>

            <button className="auth-primary-btn" type="submit">Create Account</button>
          </form>
        )}

        {message && (
          <p className={`auth-message ${message.ok ? "success" : "error"}`} role="status">
            {message.text}
          </p>
        )}
      </section>

      {showAbout && (
        <PolicyModal title="About Spendo" onClose={() => setShowAbout(false)}>
          <p>
            Spendo helps you understand where your money goes by turning uploaded Excel or CSV
            statement reports into a clear personal finance dashboard.
          </p>
          <div className="auth-policy-section">
            <h3>What Spendo does</h3>
            <ul>
              <li>Automatically categorizes transactions such as groceries, dining, transport, and entertainment.</li>
              <li>Shows charts, top merchants, spending velocity, anomalies, and monthly comparisons.</li>
              <li>Helps you review your own financial data before setting budgets or spending goals.</li>
            </ul>
          </div>
          <div className="auth-policy-section">
            <h3>How to use it</h3>
            <ul>
              <li>Create an account or sign in.</li>
              <li>Upload a credit card or bank statement in Excel, XLS, or CSV format.</li>
              <li>Use the filters and charts to inspect categories, merchants, and trends.</li>
            </ul>
          </div>
          <p>
            Spendo is an analysis tool, not a financial advisor. You stay responsible for checking
            your statements and deciding what actions to take.
          </p>
        </PolicyModal>
      )}

      {showTerms && (
        <PolicyModal title="Spendo User Terms" onClose={() => setShowTerms(false)}>
          <p>
            Effective June 1, 2026. Spendo is a personal finance analytics platform for reviewing
            uploaded credit card or bank statements, categorizing transactions, visualizing spending
            patterns, tracking budgets, and surfacing insights.
          </p>
          <div className="auth-policy-section">
            <h3>Your responsibilities</h3>
            <ul>
              <li>Use a valid email address and keep your password secure.</li>
              <li>Upload only financial statements you own or have permission to use.</li>
              <li>Check category and insight accuracy before relying on them.</li>
              <li>Do not use Spendo for fraud, money laundering, unauthorized access, scraping, or system abuse.</li>
              <li>You must be at least 18 years old or have a parent or guardian manage the account.</li>
            </ul>
          </div>
          <div className="auth-policy-section">
            <h3>Your rights</h3>
            <ul>
              <li>You can access, correct, export, and request deletion of your data.</li>
              <li>You can withdraw consent for optional processing where supported.</li>
              <li>Account deletion is intended to remove account and transaction data within the policy timeline.</li>
            </ul>
          </div>
          <div className="auth-policy-section">
            <h3>Important limits</h3>
            <ul>
              <li>Spendo is a tool, not a bank, payment processor, or financial advisor.</li>
              <li>Spendo does not store card numbers, CVV codes, bank passwords, or process payments.</li>
              <li>The service is provided as-is, and financial decisions remain your responsibility.</li>
            </ul>
          </div>
          <p className="auth-policy-source">
            Based on the project USER_POLICY.md and security/compliance documentation.
          </p>
        </PolicyModal>
      )}

      {showCookies && (
        <PolicyModal title="Spendo Cookies Policy" onClose={() => setShowCookies(false)}>
          <p>
            Spendo uses only technical storage needed to provide authentication, security,
            preferences, and core dashboard functionality. The project policy states that Spendo
            does not use advertising cookies, tracking pixels, behavioral targeting, or data broker
            sharing.
          </p>
          <div className="auth-policy-section">
            <h3>What may be stored</h3>
            <ul>
              <li>Session state so you can stay signed in.</li>
              <li>Account consent timestamps for accepted terms and cookies policy.</li>
              <li>Security and audit information such as login and upload activity where required.</li>
              <li>Browser or device information used for fraud detection and account protection.</li>
            </ul>
          </div>
          <div className="auth-policy-section">
            <h3>What Spendo does not use cookies for</h3>
            <ul>
              <li>No selling data to advertisers.</li>
              <li>No cross-site advertising tracking.</li>
              <li>No behavioral profiling for third-party marketing.</li>
            </ul>
          </div>
          <p>
            Security logs and technical data are handled under the project retention and compliance
            rules, including fraud prevention, audit trails, and legal obligations.
          </p>
          <p className="auth-policy-source">
            Based on USER_POLICY.md privacy sections and the security compliance documents.
          </p>
        </PolicyModal>
      )}
    </main>
  );
}

interface PolicyModalProps {
  title: string;
  children: ReactNode;
  onClose: () => void;
}

function PolicyModal({ title, children, onClose }: PolicyModalProps) {
  return (
    <div className="auth-modal-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="policy-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="auth-modal-header">
          <h2 id="policy-title">{title}</h2>
          <button type="button" className="auth-modal-close" onClick={onClose} aria-label="Close">
            x
          </button>
        </div>
        <div className="auth-modal-body">{children}</div>
        <button type="button" className="auth-primary-btn" onClick={onClose}>
          Close
        </button>
      </section>
    </div>
  );
}
