import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./styles.css";
import "./banking.css";
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  componentDidCatch(error) {
    console.error("Cabinet render failed", error);
  }
  render() {
    return this.state.error ? (
      <div className="fatal-error">
        <h1>Не удалось открыть кабинет</h1>
        <p>Обновите страницу. Данные заявок останутся в браузере.</p>
        <button onClick={() => window.location.reload()}>
          Обновить страницу
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
