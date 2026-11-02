import { Component, type ErrorInfo, type ReactNode } from "react";
import { safeStorage, safeSessionStorage } from "@/lib/safe-storage";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  error: Error | null;
  errorInfo: ErrorInfo | null;
  recoveryAttempts: number;
}

const MAX_RECOVERY_ATTEMPTS = 3;

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { error: null, errorInfo: null, recoveryAttempts: 0 };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error };
  }

  override componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo });
    console.error("[MelodyMap] Render error:", error, errorInfo);

    const msg = error?.message || "";
    const isChunkOrImportError =
      msg.includes("Failed to fetch dynamically imported module") ||
      msg.includes("error loading dynamically imported module") ||
      msg.includes("Importing a module script failed");

    if (isChunkOrImportError && typeof window !== "undefined") {
      try {
        const lastAttempt = safeSessionStorage.getItem("melodymap.chunk_recovery");
        const now = Date.now();
        if (!lastAttempt || now - Number(lastAttempt) > 8000) {
          safeSessionStorage.setItem("melodymap.chunk_recovery", String(now));
          window.location.reload();
        }
      } catch {
        // storage disabled
      }
    }
  }

  override render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      const canRecover = this.state.recoveryAttempts < MAX_RECOVERY_ATTEMPTS;

      const msg = this.state.error?.message || "";
      const isStorageError =
        msg.toLowerCase().includes("localstorage") ||
        msg.toLowerCase().includes("access is denied") ||
        msg.toLowerCase().includes("securityerror");

      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <img
              src="/brand/app-icon.png"
              alt="MelodyMap"
              className="h-16 w-16 mx-auto mb-4 rounded-xl object-contain shadow-md"
            />
            <h1 className="text-xl font-bold text-foreground">
              {isStorageError ? "Storage restricted in this browser" : "Something went wrong"}
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {isStorageError
                ? "This browser or in-app viewer has restricted local storage access. You can continue listening as a guest or open MelodyMap in your device's standard browser (Chrome or Safari)."
                : "MelodyMap hit an unexpected error. Your downloads, playlists and listening history are safely stored and won't be lost."}
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {isStorageError ? (
                <>
                  <button
                    onClick={() => {
                      safeStorage.setItem("melodymap.guest_mode", "true");
                      window.location.href = "/";
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Continue as Guest
                  </button>
                  <button
                    onClick={() => {
                      if (navigator.clipboard) {
                        navigator.clipboard.writeText(window.location.href);
                        alert("Link copied! Open Chrome or Safari and paste the link to sign in.");
                      }
                    }}
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    Copy Link for Browser
                  </button>
                </>
              ) : (
                <>
                  <button
                    onClick={() => {
                      this.setState({ error: null, errorInfo: null });
                      window.location.reload();
                    }}
                    className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    Reload app
                  </button>
                  {canRecover && (
                    <button
                      onClick={() => {
                        this.setState((prev) => ({
                          error: null,
                          errorInfo: null,
                          recoveryAttempts: prev.recoveryAttempts + 1,
                        }));
                      }}
                      className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                    >
                      Try to recover ({MAX_RECOVERY_ATTEMPTS - this.state.recoveryAttempts} left)
                    </button>
                  )}
                  <a
                    href="/"
                    className="inline-flex items-center justify-center rounded-md border border-input bg-background px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent"
                  >
                    Go home
                  </a>
                </>
              )}
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground/60">
              Error: {isStorageError ? "Storage restricted by browser environment" : (import.meta.env.DEV ? (this.state.error?.message ?? "Unknown") : "An unexpected error occurred")} ·{" "}
              {new Date().toLocaleTimeString()}
            </p>
            {import.meta.env.DEV && this.state.errorInfo && (
              <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-card p-3 text-left text-xs text-muted-foreground">
                {this.state.error?.message}
                {"\n\n"}
                {this.state.errorInfo.componentStack}
              </pre>
            )}
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
