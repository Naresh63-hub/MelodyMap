import { Component, type ErrorInfo, type ReactNode } from "react";

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
  }

  override render() {
    if (this.state.error) {
      if (this.props.fallback) return this.props.fallback;

      const canRecover = this.state.recoveryAttempts < MAX_RECOVERY_ATTEMPTS;

      return (
        <div className="flex min-h-screen items-center justify-center bg-background px-4">
          <div className="max-w-md text-center">
            <img
              src="/brand/app-icon.png"
              alt="MelodyMap"
              className="h-16 w-16 mx-auto mb-4 rounded-2xl object-cover shadow-xl shadow-purple-500/20"
            />
            <h1 className="text-xl font-bold text-foreground">
              Something went wrong
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              MelodyMap hit an unexpected error. Your downloads, playlists and
              listening history are safely stored and won't be lost.
            </p>
            <div className="mt-6 flex flex-wrap justify-center gap-2">
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
            </div>
            <p className="mt-4 text-[11px] text-muted-foreground/60">
              Error: {this.state.error?.message ?? "Unknown"} ·{" "}
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
