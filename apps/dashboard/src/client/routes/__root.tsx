import { Outlet, Link } from "@tanstack/react-router";
import { useAuth } from "../lib/hooks/useAuth";
import { ToastContainer } from "../components/Toast";

export function RootLayout() {
  const { data: user } = useAuth();

  return (
    <div className="min-h-screen">
      <header className="flex items-center justify-between border-b border-border bg-surface px-6 py-4">
        <Link to="/" className="text-lg font-semibold text-text hover:no-underline">
          FluxCore
        </Link>
        <nav className="flex items-center gap-4">
          {user ? (
            <>
              <span className="text-sm text-text-muted">{user.username}</span>
              <a
                href="/auth/logout"
                className="text-sm text-danger hover:underline"
              >
                Logout
              </a>
            </>
          ) : null}
        </nav>
      </header>
      <main>
        <Outlet />
      </main>
      <ToastContainer />
    </div>
  );
}
