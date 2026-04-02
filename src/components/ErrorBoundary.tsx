import { Component, ReactNode } from "react";
import { Button } from "@/components/ui/button";

interface Props { children: ReactNode; }
interface State { hasError: boolean; error?: Error; }

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen items-center justify-center p-6">
          <div className="text-center space-y-4">
            <h1 className="text-2xl font-bold text-destructive">Something went wrong</h1>
            <p className="text-muted-foreground text-sm max-w-md">{this.state.error?.message}</p>
            <Button onClick={() => { this.setState({ hasError: false }); window.location.href = "/"; }}>
              Return Home
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
