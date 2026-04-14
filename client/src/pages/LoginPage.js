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
    <main className="min-h-screen bg-[#f1f3f5] px-4 py-10">
      <section className="mx-auto w-full max-w-md rounded-md border border-[#d9dde2] bg-white p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7a808a]">
          Admin Access
        </p>
        <h1 className="mt-2 text-3xl font-semibold text-[#111418]">Prasad Status Login</h1>
        <p className="mt-2 text-sm text-[#60656f]">
          Use your administrator credentials to access monitoring controls.
        </p>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block text-sm font-medium text-[#2d333a]">
            Username
            <input
              type="text"
              required
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              className="mt-2 w-full rounded-md border border-[#d4d7dc] bg-white px-3 py-2 text-[#1f252b] outline-none transition focus:border-[#4f46e5]"
            />
          </label>

          <label className="block text-sm font-medium text-[#2d333a]">
            Password
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="mt-2 w-full rounded-md border border-[#d4d7dc] bg-white px-3 py-2 text-[#1f252b] outline-none transition focus:border-[#4f46e5]"
            />
          </label>

          {error ? (
            <p className="rounded-md border border-[#f2b8b8] bg-[#fff1f1] px-3 py-2 text-sm text-[#c13f3f]">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-[#4f46e5] px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-[#4338ca] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {loading ? "Signing in..." : "Sign in"}
          </button>
        </form>

        <Link
          to="/"
          className="mt-5 inline-block text-sm text-[#5f6570] transition hover:text-[#4338ca]"
        >
          Back to public status
        </Link>
      </section>
    </main>
  );
}

export default LoginPage;
