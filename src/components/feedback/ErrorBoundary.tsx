import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import "./feedback.css";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("SoftUI render error", error, info);
  }

  reset = () => {
    this.setState({ hasError: false });
    window.location.hash = "#/dashboard";
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <main className="error-boundary" role="alert">
        <div className="error-boundary-inner">
          <AlertTriangle size={28} />
          <h1>界面发生错误</h1>
          <p>应用已捕获渲染异常，可重新加载界面继续操作。</p>
          <button type="button" className="primary-btn" onClick={this.reset}>
            <RefreshCw size={16} />
            <span>重新加载</span>
          </button>
        </div>
      </main>
    );
  }
}
