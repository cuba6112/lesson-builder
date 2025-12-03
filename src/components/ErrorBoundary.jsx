import React from 'react';
import { AlertCircle, RefreshCw, Copy, Check } from 'lucide-react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      errorTime: null,
      copied: false,
    };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      error,
      errorTime: new Date().toISOString(),
    };
  }

  componentDidCatch(error, errorInfo) {
    // Store error info for display
    this.setState({ errorInfo });

    // Log with context
    console.error('Lesson Builder Error:', {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: new Date().toISOString(),
      component: this.props.name || 'Unknown',
    });

    // Call optional error handler prop
    this.props.onError?.(error, errorInfo);
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      errorTime: null,
      copied: false,
    });
    this.props.onReset?.();
  };

  handleCopyError = async () => {
    const errorDetails = this.getErrorDetails();
    try {
      await navigator.clipboard.writeText(errorDetails);
      this.setState({ copied: true });
      setTimeout(() => this.setState({ copied: false }), 2000);
    } catch (err) {
      console.error('Failed to copy error:', err);
    }
  };

  getErrorDetails = () => {
    const { error, errorInfo, errorTime } = this.state;
    return `Lesson Builder Error Report
========================
Time: ${errorTime}
Component: ${this.props.name || 'Unknown'}
Error: ${error?.message || 'Unknown error'}
Stack: ${error?.stack || 'No stack trace'}
Component Stack: ${errorInfo?.componentStack || 'No component stack'}`;
  };

  render() {
    if (this.state.hasError) {
      const { error, errorInfo, copied } = this.state;

      // Compact fallback UI
      if (this.props.fallback) {
        return this.props.fallback;
      }

      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <AlertCircle size={16} className="text-red-600" />
              <span className="font-medium text-red-800">
                {this.props.title || 'Something went wrong'}
              </span>
            </div>
            {this.props.name && (
              <span className="text-xs text-red-500 bg-red-100 px-2 py-0.5 rounded">
                {this.props.name}
              </span>
            )}
          </div>

          <p className="text-sm text-red-700 mb-3">
            {this.props.message || 'The content could not be rendered.'}
          </p>

          {this.props.showError && error && (
            <div className="mb-3">
              <pre className="text-xs bg-red-100 p-2 rounded overflow-auto max-h-32 text-red-800">
                {error?.message || 'An unexpected error occurred.'}
                {errorInfo?.componentStack && (
                  <>
                    {'\n\nComponent Stack:'}
                    {errorInfo.componentStack}
                  </>
                )}
              </pre>
            </div>
          )}

          <div className="flex items-center gap-2">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
            >
              <RefreshCw size={14} />
              Try again
            </button>

            {this.props.showError && (
              <button
                onClick={this.handleCopyError}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-red-100 hover:bg-red-200 text-red-700 rounded transition-colors"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? 'Copied!' : 'Copy error'}
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
