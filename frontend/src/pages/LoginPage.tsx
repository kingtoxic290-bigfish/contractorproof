import { FormEvent, useId, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";
import { ROLES, type Role } from "../types/roles";

const REGISTER_ROLES = ROLES.filter((role) => role !== "ADMIN");

const FIELD_CLASSES =
  "w-full rounded-md border border-stone-300 bg-white px-3 py-2 text-sm text-stone-900 placeholder:text-stone-400 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]";

/**
 * Public entry point for authentication.
 *
 * Client-side validation only reports that a field is missing or malformed; the
 * service remains the authority on whether an account may be created or used.
 * Errors are shown as a single alert associated with the form.
 */
export function LoginPage() {
  const { login, register, status, message } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("CONTRACTOR");
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const pending = status === "AUTHENTICATING";

  const errorId = useId();
  const nameErrorId = useId();
  const emailErrorId = useId();
  const passwordErrorId = useId();

  function validate(): boolean {
    const next: Record<string, string> = {};
    if (mode === "register" && !fullName.trim()) {
      next.fullName = "Enter your full name.";
    }
    if (!email.trim()) {
      next.email = "Enter your email address.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Enter a valid email address.";
    }
    if (!password) {
      next.password = "Enter your password.";
    } else if (mode === "register" && password.length < 8) {
      next.password = "Use a password of at least 8 characters.";
    }
    setFieldErrors(next);
    return Object.keys(next).length === 0;
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!validate()) {
      return;
    }
    try {
      if (mode === "login") {
        await login({ email, password });
      } else {
        await register({ email, password, fullName, role });
      }
    } catch {
      setFormError(mode === "login" ? null : message);
    }
  }

  const visibleError = formError ?? message;

  return (
    <div className="mx-auto max-w-xl">
      <div className="mb-6 flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#0f3d3a]/15 bg-[#0f3d3a]/5 text-[#0f3d3a]">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <h1 className="font-serif text-2xl leading-tight text-stone-900">
            {mode === "login" ? "Sign in" : "Create an account"}
          </h1>
          <p className="mt-1 text-sm leading-6 text-stone-600">
            Access is based on the professional role recorded for your account. Records are supplied
            by the service.
          </p>
        </div>
      </div>

      <Card>
        <form className="space-y-4" onSubmit={onSubmit} noValidate>
          {mode === "register" ? (
            <>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-800">Full name</span>
                <input
                  className={FIELD_CLASSES}
                  value={fullName}
                  onChange={(event) => setFullName(event.target.value)}
                  autoComplete="name"
                  required
                  aria-invalid={Boolean(fieldErrors.fullName)}
                  aria-describedby={fieldErrors.fullName ? nameErrorId : undefined}
                />
                {fieldErrors.fullName ? (
                  <span id={nameErrorId} className="mt-1 block text-xs font-medium text-red-800">
                    {fieldErrors.fullName}
                  </span>
                ) : null}
              </label>
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-stone-800">Role</span>
                <select
                  className={FIELD_CLASSES}
                  value={role}
                  onChange={(event) => setRole(event.target.value as Role)}
                >
                  {REGISTER_ROLES.map((value) => (
                    <option key={value} value={value}>
                      {value.replaceAll("_", " ")}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : null}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-800">Email</span>
            <input
              className={FIELD_CLASSES}
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              required
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? emailErrorId : undefined}
            />
            {fieldErrors.email ? (
              <span id={emailErrorId} className="mt-1 block text-xs font-medium text-red-800">
                {fieldErrors.email}
              </span>
            ) : null}
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-stone-800">Password</span>
            <input
              className={FIELD_CLASSES}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={8}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? passwordErrorId : undefined}
            />
            {fieldErrors.password ? (
              <span id={passwordErrorId} className="mt-1 block text-xs font-medium text-red-800">
                {fieldErrors.password}
              </span>
            ) : null}
          </label>
          {visibleError ? (
            <p
              role="alert"
              id={errorId}
              className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900"
            >
              {visibleError}
            </p>
          ) : null}
          <Button type="submit" className="w-full" disabled={pending} aria-busy={pending}>
            {pending
              ? mode === "login"
                ? "Signing in..."
                : "Creating account..."
              : mode === "login"
                ? "Sign in"
                : "Create account"}
          </Button>
        </form>
        <button
          type="button"
          className="mt-4 text-sm font-medium text-stone-700 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
          onClick={() => {
            setMode(mode === "login" ? "register" : "login");
            setFormError(null);
            setFieldErrors({});
          }}
        >
          {mode === "login" ? "Need an account?" : "Already have an account?"}
        </button>
      </Card>

      <p className="mt-5 text-sm text-stone-600">
        Independent evidence check:{" "}
        <Link
          className="font-semibold text-[#0f3d3a] underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0f3d3a]"
          to="/verify"
        >
          Public verification
        </Link>
      </p>
    </div>
  );
}