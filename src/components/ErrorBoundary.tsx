import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Error Boundary Component
 * Catches React component errors and displays fallback UI
 * Prevents entire app from crashing on component errors
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to monitoring service in production
    if (import.meta.env.PROD) {
      // Example: Sentry.captureException(error, { contexts: { react: errorInfo } });
      console.error('Error caught by boundary:', error, errorInfo);
    } else {
      console.error('Error caught by boundary:', error, errorInfo);
    }
  }

  handleReset = (): void => {
    this.setState({
      hasError: false,
      error: null,
    });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="flex min-h-screen items-center justify-center bg-background p-4">
          <div className="max-w-md rounded-lg border border-gold/10 bg-card p-8 text-center shadow-2xl shadow-black/30">
            {/* Decorative top line */}
            <div className="mb-6 h-[1px] bg-gradient-to-r from-transparent via-crimson/30 to-transparent" />
            
            <AlertTriangle className="mx-auto mb-4 h-10 w-10 text-crimson/70" />
            <h2 className="mb-2 text-xl font-bold text-foreground" style={{ fontFamily: 'Cinzel, serif' }}>
              Something went wrong
            </h2>
            <p className="mb-6 text-sm text-muted-foreground" style={{ fontFamily: 'Cormorant Garamond, serif', fontStyle: 'italic' }}>
              {import.meta.env.DEV && this.state.error
                ? this.state.error.message
                : 'An unexpected disturbance has occurred. Please try again.'}
            </p>
            <div className="flex gap-3 justify-center">
              <button
                onClick={this.handleReset}
                className="btn-imperial min-h-[44px] py-2 px-5 text-xs"
              >
                Try Again
              </button>
              <button
                onClick={() => window.location.reload()}
                className="btn-imperial-outline min-h-[44px] py-2 px-5 text-xs"
              >
                Refresh Page
              </button>
            </div>
            
            {/* Decorative bottom line */}
            <div className="mt-6 h-[1px] bg-gradient-to-r from-transparent via-gold/10 to-transparent" />
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
