import { FormEvent, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "../components/ui/Button";
import { Card } from "../components/ui/Card";
import { useAuth } from "../hooks/useAuth";
import { ROLES, type Role } from "../types/roles";

const REGISTER_ROLES = ROLES.filter((role) => role !== "ADMIN");

export function LoginPage() {
  const { login, register, status, message } = useAuth();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role>("CONTRACTOR");
  const [formError, setFormError] = useState<string | null>(null);
  const pending = status === "AUTHENTICATING";

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
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
    <Card
      title={mode === "login" ? "Sign in" : "Create an account"}
      description="Use your ContractorProof account. Access is based on your assigned professional role."
    >
      <form className="space-y-4" onSubmit={onSubmit} noValidate>
        {mode === "register" ? (
          <>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-stone-800">Full name</span>
              <input
                className="w-full rounded-md border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
                value={fullName}
                onChange={(event) => setFullName(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-stone-800">Role</span>
              <select
                className="w-full rounded-md border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
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
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-stone-800">Password</span>
          <input
            className="w-full rounded-md border border-stone-300 px-3 py-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={8}
          />
        </label>
        {visibleError ? (
          <p role="alert" className="text-sm text-red-800">
            {visibleError}
          </p>
        ) : null}
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? "Signing in..." : mode === "login" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <button
        type="button"
        className="mt-4 text-sm text-stone-600 underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-teal-800"
        onClick={() => {
          setMode(mode === "login" ? "register" : "login");
          setFormError(null);
        }}
      >
        {mode === "login" ? "Need an account?" : "Already have an account?"}
      </button>
      <p className="mt-4 text-sm text-stone-600">
        Independent evidence check:{" "}
        <Link className="font-medium text-teal-900 underline underline-offset-2" to="/verify">
          Public verification
        </Link>
      </p>
    </Card>
  );
}
