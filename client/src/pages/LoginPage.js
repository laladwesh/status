import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import apiClient from "../api/client";
import { isAuthenticated, setAuthSession } from "../utils/auth";

function LoginPage() {
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (isAuthenticated()) {
      navigate("/admin", { replace: true });
    }
  }, [navigate]);

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await apiClient.post("/auth/login", {
        username,
        password,
      });

      setAuthSession(response.data.token, response.data.user);
      navigate("/admin", { replace: true });
    } catch (err) {
      setError("Invalid username or password.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-8">
      <section className="w-full max-w-md rounded-2xl border border-border bg-panel p-6 shadow-panel">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-accent">
          Admin Access
        </p>
        <h1 className="mt-2 text-2xl font-semibold text-slate-100">Sign in</h1>
        <p className="mt-2 text-sm text-muted">
          Use your administrator credentials to access monitoring controls.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm text-slate-200">
            Username
            <input
              type="text"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-panelSoft px-3 py-2 text-slate-100 outline-none transition focus:border-accent/70"
            />
          </label>

          <label className="block text-sm text-slate-200">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-lg border border-border bg-panelSoft px-3 py-2 text-slate-100 outline-none transition focus:border-accent/70"
            />
          </label>

          {error ? (
            <p className="rounded-lg border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-semibold text-slate-950 transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <Link
          to="/"
          className="mt-5 inline-block text-sm text-muted transition hover:text-accent"
        >
          Back to public status
        </Link>
      </section>
    </main>
  );
}

export default LoginPage;
