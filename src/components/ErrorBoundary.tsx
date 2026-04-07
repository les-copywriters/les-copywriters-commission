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
      // Class components can't use hooks — detect language from localStorage directly
      const lang = typeof localStorage !== "undefined"
        ? localStorage.getItem("locale") ?? "fr"
        : "fr";
      const isFr = lang === "fr";
      return (
        <div className="flex min-h-screen items-center justify-center p-6 bg-background">
          <div className="text-center space-y-4 max-w-md">
            <h1 className="text-2xl font-bold text-destructive">
              {isFr ? "Une erreur est survenue" : "Something went wrong"}
            </h1>
            <p className="text-muted-foreground text-sm">{this.state.error?.message}</p>
            <Button onClick={() => { this.setState({ hasError: false }); window.location.href = "/"; }}>
              {isFr ? "Retour à l'accueil" : "Return Home"}
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
