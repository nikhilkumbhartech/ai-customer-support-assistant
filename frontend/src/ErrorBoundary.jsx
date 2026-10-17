import { Component } from "react";

export default class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <pre style={{ padding: 20, color: "red", whiteSpace: "pre-wrap" }}>
          {String(this.state.error.stack || this.state.error)}
        </pre>
      );
    }
    return this.props.children;
  }
}