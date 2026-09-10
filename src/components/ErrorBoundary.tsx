'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode | ((error: Error) => ReactNode);
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught error]:', error, errorInfo);
    this.props.onError?.(error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      if (typeof this.props.fallback === 'function') {
        return this.props.fallback(this.state.error || new Error('Unknown error'));
      }
      return (
        this.props.fallback || (
          <div className="p-3 my-2 text-sm rounded-lg border border-red-200 bg-red-50 dark:bg-red-950/30 dark:border-red-900/50 text-red-700 dark:text-red-300">
            <p className="font-semibold">Rendering Error</p>
            <p className="text-xs mt-1 text-red-600 dark:text-red-400 font-mono break-all">
              {this.state.error?.message || 'Failed to render content'}
            </p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
