import React from 'react';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("ErrorBoundary caught an error:", error, errorInfo);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '2rem', maxWidth: '600px', margin: '2rem auto', textAlign: 'center', backgroundColor: '#fff', borderRadius: '12px', border: '1px solid #fee2e2', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>⚠️</div>
          <h2 style={{ color: '#b91c1c', marginBottom: '0.5rem' }}>Something went wrong</h2>
          <p style={{ color: '#4b5563', marginBottom: '1.5rem', fontSize: '0.95rem' }}>
            An unexpected error occurred while loading this view.
          </p>
          {this.state.error?.message && (
            <pre style={{ textAlign: 'left', backgroundColor: '#fef2f2', color: '#991b1b', padding: '0.75rem', borderRadius: '6px', fontSize: '0.8rem', overflowX: 'auto', marginBottom: '1.5rem' }}>
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
            <button className="btn btn-secondary" onClick={() => this.setState({ hasError: false, error: null })}>
              Try Again
            </button>
            <button className="btn btn-primary" onClick={this.handleReload}>
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
