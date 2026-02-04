import React, { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
    children: ReactNode;
}

interface State {
    hasError: boolean;
    error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
    public state: State = {
        hasError: false,
        error: null
    };

    public static getDerivedStateFromError(error: Error): State {
        return { hasError: true, error };
    }

    public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
        console.error('Uncaught error:', error, errorInfo);
    }

    public render() {
        if (this.state.hasError) {
            return (
                <div className="fixed inset-0 z-[99999] bg-red-900 text-white p-10 font-mono overflow-auto">
                    <h1 className="text-3xl font-bold mb-4">REACT RENDER ERROR</h1>
                    <pre className="whitespace-pre-wrap">{this.state.error?.toString()}</pre>
                    <pre className="mt-4 text-sm opacity-70">{this.state.error?.stack}</pre>
                    <button
                        onClick={() => window.location.reload()}
                        className="mt-8 px-6 py-3 bg-white text-red-900 font-bold rounded"
                    >
                        RELOAD
                    </button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
