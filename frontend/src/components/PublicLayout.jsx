import React from "react";
import { Brand, Button } from "./ui";

export default function PublicLayout({ route, role, navigate, children }) {
  const signedIn = ["client", "employee"].includes(role);
  return (
    <div className="public-layout">
      <a
        className="skip-link"
        href="#public-content"
        onClick={(event) => {
          event.preventDefault();
          document.getElementById("public-content")?.focus();
        }}
      >
        Перейти к содержимому
      </a>
      <header className="public-header">
        <a className="public-brand" href="#/" aria-label="Milk Tower — главная">
          <Brand />
        </a>
        <nav aria-label="Навигация сайта">
          {[
            { path: "/", label: "Главная" },
            { path: "/products", label: "Кредиты" },
            { path: "/how-it-works", label: "Как это работает" },
          ].map((item) => (
            <a
              key={item.path}
              href={`#${item.path}`}
              aria-current={route === item.path ? "page" : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>
        <Button
          variant="secondary"
          onClick={() =>
            navigate(
              signedIn
                ? role === "employee"
                  ? "/queue"
                  : "/overview"
                : "/login",
            )
          }
        >
          {signedIn ? "В кабинет" : "Личный кабинет"}
        </Button>
      </header>
      <main
        id="public-content"
        tabIndex={-1}
        className={`public-content ${route === "/" ? "public-home" : ""}`}
      >
        {children}
      </main>
      <footer className="public-footer">
        <span>© 2026 Milk Tower · v1.1.0</span>
        <span>Демонстрационный прототип · Синтетические данные</span>
      </footer>
    </div>
  );
}
