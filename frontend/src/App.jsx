import React, { useCallback, useEffect, useRef, useState } from "react";
import { api, invalidateDemo, getPersistenceWarning } from "./services/api";
import {
  Brand,
  Button,
  Empty,
  Icon,
  Modal,
  Notice,
  PageHeading,
} from "./components/ui";
import Overview, { Products } from "./pages/Overview";
import ApplicationTable from "./components/ApplicationTable";
import ApplicationForm from "./pages/ApplicationForm";
import ApplicationDetail from "./pages/ApplicationDetail";
import Documents from "./pages/Documents";
import Employee from "./pages/Employee";
import Support from "./pages/Support";
import Home, { HowItWorks } from "./pages/Home";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import PublicLayout from "./components/PublicLayout";
import {
  isPublicRoute,
  routeAfterLogin,
  routeForRole,
} from "./domain/navigation";
import { calculateLoan } from "./domain/application";
const readRole = () => {
  if (api.mode !== "mock") return "login";
  try {
    const value = sessionStorage.getItem("potok.role");
    return ["client", "employee"].includes(value) ? value : "login";
  } catch {
    return "login";
  }
};
const readRoute = () => window.location.hash.replace(/^#/, "") || "/";
function readPendingLoan() {
  try {
    const value = JSON.parse(sessionStorage.getItem("potok.pendingLoan"));
    return value &&
      ["working", "equipment"].includes(value.productId) &&
      calculateLoan(value.productId, value.amount, value.term)
      ? value
      : null;
  } catch {
    return null;
  }
}
export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [role, setRole] = useState(readRole);
  const publicPage = isPublicRoute(route);
  const [pendingLoan, setPendingLoan] = useState(readPendingLoan);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [panel, setPanel] = useState(null);
  const [creating, setCreating] = useState(false);
  const [calculatorValue, setCalculatorValue] = useState(
    () =>
      readPendingLoan() || {
        productId: "working",
        amount: 1000000,
        term: 24,
      },
  );
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const toastTimer = useRef();
  const reviewedRoute = useRef(null);
  const notify = useCallback((text, type = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ text, type });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  const navigate = useCallback((path) => {
    if (window.location.hash === `#${path}`) setRoute(path);
    else window.location.hash = path;
    setMobileNav(false);
    setPanel(null);
    window.scrollTo({ top: 0 });
  }, []);
  const refresh = useCallback(async () => {
    try {
      const value = await api.list();
      if (!Array.isArray(value))
        throw new Error("Сервер вернул некорректный список заявок");
      setApplications(value);
      setError("");
      return value;
    } catch (e) {
      if (e.status === 401) {
        setRole("login");
        setApplications([]);
      }
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    if (api.mode !== "http") return;
    let active = true;
    api.session().then((session) => {
      if (active && ["client", "employee"].includes(session?.role))
        setRole(session.role);
    }).catch((error) => {
      if (active && error.status !== 401) setError(error.message);
    });
    return () => { active = false; };
  }, []);
  useEffect(() => {
    const hash = () => {
      setRoute(readRoute());
      setMobileNav(false);
      setPanel(null);
      window.scrollTo({ top: 0 });
    };
    window.addEventListener("hashchange", hash);
    return () => window.removeEventListener("hashchange", hash);
  }, []);
  useEffect(() => {
    if (role === "login" || publicPage) {
      setLoading(false);
      return;
    }
    setLoading(true);
    invalidateDemo();
    refresh().catch(() => {});
    const sync = () => refresh().catch(() => {});
    const storage = (e) => {
      if (e.key === "potok.applications.v1") {
        invalidateDemo();
        sync();
      }
    };
    window.addEventListener("potok-change", sync);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("potok-change", sync);
      window.removeEventListener("storage", storage);
    };
  }, [role, publicPage, refresh]);
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    if (route.startsWith("/applications/")) reviewedRoute.current = route;
    else if (route !== "/profile") reviewedRoute.current = null;
  }, [route]);
  useEffect(() => {
    const title =
      {
        "/": "Финансирование для бизнеса",
        "/products": "Кредиты для бизнеса",
        "/how-it-works": "Как это работает",
        "/login": "Вход в кабинет",
      }[route] || (role === "employee" ? "Рабочее место" : "Личный кабинет");
    document.title = `${title} — Milk Tower`;
  }, [role, route]);
  function persistRole(value) {
    setRole(value);
    try {
      if (value === "login") sessionStorage.removeItem("potok.role");
      else sessionStorage.setItem("potok.role", value);
    } catch {}
  }
  async function login(value) {
    if (api.mode === "mock") invalidateDemo();
    let created;
    if (pendingLoan && value === "client" && route === "/login")
      created = await api.create(pendingLoan.productId, pendingLoan);
    await refresh();
    persistRole(value);
    setPendingLoan(null);
    try {
      sessionStorage.removeItem("potok.pendingLoan");
    } catch {}
    navigate(
      created
        ? `/applications/${created.id}/edit`
        : routeAfterLogin(route, value),
    );
  }
  function changeRole(value) {
    if (value === role) return;
    const destination = routeForRole(
      route === "/profile" ? reviewedRoute.current || route : route,
      value,
      applications,
    );
    persistRole(value);
    setPanel(null);
    if (value === "login") {
      setApplications([]);
      setError("");
      setToast(null);
    }
    navigate(destination);
  }
  useEffect(() => {
    if (!mobileNav) return;
    const previous = document.activeElement;
    document.querySelector(".sidebar button")?.focus();
    const close = (event) => {
      if (event.key === "Escape") setMobileNav(false);
    };
    document.addEventListener("keydown", close);
    return () => {
      document.removeEventListener("keydown", close);
      previous?.focus();
    };
  }, [mobileNav]);
  async function logout() {
    setLoggingOut(true);
    try {
      await api.logout();
      changeRole("login");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setLoggingOut(false);
    }
  }
  async function createApplication(productId, terms) {
    if (role !== "client") {
      const pending = { productId, ...terms };
      setPendingLoan(pending);
      try {
        sessionStorage.setItem("potok.pendingLoan", JSON.stringify(pending));
      } catch {}
      navigate("/login");
      return;
    }
    if (creating) return;
    setCreating(true);
    try {
      const app = await api.create(productId, terms);
      await refresh();
      navigate(`/applications/${app.id}/edit`);
    } catch (e) {
      notify(e.message, "error");
    } finally {
      setCreating(false);
    }
  }
  const employee = role === "employee";
  const appId = route.match(/^\/applications\/([^/]+)/)?.[1];
  const application = applications.find((a) => a.id === appId);
  const routes = employee
    ? [
        {
          path: "/queue",
          icon: "grid",
          name: "Очередь заявок",
          badge: applications.filter((a) =>
            ["submitted", "manual_review"].includes(a.status),
          ).length,
        },
        { path: "/documents", icon: "folder", name: "Документы" },
      ]
    : [
        { path: "/overview", icon: "grid", name: "Мой кабинет" },
        {
          path: "/applications",
          icon: "file",
          name: "Мои заявки",
          badge: applications.length,
        },
        { path: "/documents", icon: "folder", name: "Документы" },
      ];
  const activeRoute = appId
    ? employee
      ? "/queue"
      : "/applications"
    : route === "/overview" && employee
      ? "/queue"
      : route;
  const breadcrumbs = appId
    ? employee
      ? "Очередь заявок"
      : "Мои заявки"
    : routes.find((n) => n.path === activeRoute)?.name ||
      {
        "/support": "Поддержка",
        "/profile": "Профиль",
        "/products": "Новая заявка",
      }[route] ||
      "Кабинет";
  const common = {
    applications,
    navigate,
    notify,
    refresh,
    role,
    createApplication,
    calculatorValue,
    setCalculatorValue,
    creating,
    requiresLogin: role !== "client",
  };
  let page;
  if (appId)
    page =
      employee && application?.status === "draft" ? (
        <Empty title="Черновики доступны только клиенту" />
      ) : route.endsWith("/edit") && !employee ? (
        <ApplicationForm key={appId} application={application} {...common} />
      ) : (
        <ApplicationDetail
          key={`${appId}:${role}`}
          application={application}
          {...common}
        />
      );
  else if (["/queue", "/overview"].includes(route) && employee)
    page = <Employee {...common} />;
  else if (route === "/overview") page = <Overview {...common} />;
  else if (route === "/products" && !employee) page = <Products {...common} />;
  else if (route === "/applications")
    page = employee ? (
      <Employee {...common} />
    ) : (
      <>
        <PageHeading
          title="Мои заявки"
          description="От первого шага до результата. Вся история — здесь."
        >
          <Button icon="plus" onClick={() => navigate("/products")}>
            Новая заявка
          </Button>
        </PageHeading>
        <ApplicationTable {...common} />
      </>
    );
  else if (route === "/documents")
    page = (
      <Documents
        {...common}
        applications={
          employee
            ? applications.filter((a) => a.status !== "draft")
            : applications
        }
      />
    );
  else if (route === "/support") page = <Support {...common} />;
  else if (route === "/profile")
    page = (
      <Profile
        role={role}
        changeRole={changeRole}
        logout={logout}
        loggingOut={loggingOut}
        onReset={() => setPanel("reset")}
      />
    );
  else
    page = (
      <Empty
        title="Страница не найдена"
        text="Вернитесь на главную, чтобы продолжить."
      >
        <Button onClick={() => navigate(employee ? "/queue" : "/overview")}>
          На главную
        </Button>
      </Empty>
    );
  if (
    (publicPage && (route !== "/products" || role !== "client")) ||
    role === "login"
  ) {
    let publicContent;
    if (route === "/") publicContent = <Home navigate={navigate} role={role} />;
    else if (route === "/products") publicContent = <Products {...common} />;
    else if (route === "/how-it-works")
      publicContent = <HowItWorks navigate={navigate} />;
    else
      publicContent = (
        <Login
          onLogin={login}
          pendingLoan={route === "/login" ? pendingLoan : null}
        />
      );
    return (
      <PublicLayout route={route} role={role} navigate={navigate}>
        {publicContent}
      </PublicLayout>
    );
  }
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Перейти к содержимому
      </a>
      {mobileNav && (
        <button
          className="nav-backdrop"
          aria-label="Закрыть меню"
          onClick={() => setMobileNav(false)}
        />
      )}
      <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
        <button
          className="brand-button"
          aria-label="Milk Tower — главная"
          onClick={() => navigate("/")}
        >
          <Brand />
        </button>
        <div className="company-switch">
          <span>
            <strong>{employee ? "Кредитный отдел" : "Мануфактура"}</strong>
            <small>{employee ? "Сотрудник банка" : "ООО"}</small>
          </span>
        </div>
        <nav aria-label="Основная навигация">
          {routes.map((n) => (
            <button
              key={n.path}
              onClick={() => navigate(n.path)}
              className={`nav-item ${activeRoute === n.path ? "active" : ""}`}
              aria-current={activeRoute === n.path ? "page" : undefined}
            >
              <Icon name={n.icon} size={20} />
              <span>{n.name}</span>
              {!!n.badge && <small>{n.badge}</small>}
            </button>
          ))}
        </nav>
        <button
          className={`nav-item ${route === "/profile" ? "active" : ""}`}
          onClick={() => navigate("/profile")}
          aria-current={route === "/profile" ? "page" : undefined}
        >
          <Icon name="users" />
          <span>Профиль</span>
        </button>
        <div className="sidebar-divider" />
        <button
          className={`nav-item ${route === "/support" ? "active" : ""}`}
          onClick={() => navigate("/support")}
        >
          <Icon name="chat" />
          <span>Поддержка</span>
        </button>
        <div className="sidebar-spacer" />
        <div className="sidebar-bottom">
          <Icon name="shield" size={16} />
          <span>
            {api.mode === "mock"
              ? "Демонстрационный кабинет"
              : "Защищённое соединение"}
          </span>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="topbar-left">
            <button
              className="icon-button mobile-menu"
              aria-label="Открыть меню"
              onClick={() => setMobileNav(true)}
            >
              <Icon name="menu" />
            </button>
            <span className="mobile-brand">
              <Brand />
            </span>
            <span className="breadcrumb-root">
              {employee ? "Кабинет сотрудника" : "Кредитный кабинет"}
            </span>
            <span className="breadcrumb-divider">/</span>
            <strong>{breadcrumbs}</strong>
          </div>
          <div className="topbar-right">
            <button
              className="notification-button icon-button"
              aria-label="Уведомления"
              onClick={() => setPanel("notifications")}
            >
              <Icon name="bell" />
              {applications.some((a) =>
                ["needs_info", "approved"].includes(a.status),
              ) && <i />}
            </button>
            <span className="topbar-divider" />
            <button
              className="profile-button"
              onClick={() => navigate("/profile")}
              aria-label="Открыть профиль"
            >
              <span className={`avatar ${employee ? "staff-avatar" : ""}`}>
                {employee ? "ЕС" : "АВ"}
              </span>
              <span>
                <strong>
                  {employee ? "Елена Смирнова" : "Александр Волков"}
                </strong>
                <small>
                  {employee ? "Кредитный специалист" : "Представитель компании"}
                </small>
              </span>
              <Icon name="down" size={14} />
            </button>
          </div>
        </header>
        <main id="main-content" tabIndex={-1} className="main-content">
          {getPersistenceWarning() && (
            <Notice tone="amber">{getPersistenceWarning()}</Notice>
          )}
          {loading ? (
            <div className="loading-state">
              <span className="spinner" />
              <h3>Собираем ваш кабинет</h3>
              <p>Это займёт совсем немного времени</p>
            </div>
          ) : error ? (
            <div className="card">
              <Empty
                icon="info"
                title="Не удалось получить данные"
                text={error}
              >
                <Button
                  loading={refreshing}
                  onClick={async () => {
                    setRefreshing(true);
                    await refresh().catch(() => {});
                    setRefreshing(false);
                  }}
                >
                  Попробовать снова
                </Button>
              </Empty>
            </div>
          ) : (
            page
          )}
          <footer className="page-footer">
            <span>© 2026 Milk Tower</span>
            <span>
              {api.mode === "mock"
                ? "Синтетические данные · Демо-режим"
                : "Кредитный кабинет"}
            </span>
          </footer>
        </main>
      </div>
      {creating && (
        <div className="creating-overlay" role="status">
          <span className="spinner" />
          Создаём черновик…
        </div>
      )}
      {toast && (
        <div
          className={`toast ${toast.type === "error" ? "toast-error" : ""}`}
          role={toast.type === "error" ? "alert" : "status"}
        >
          <Icon name={toast.type === "error" ? "info" : "check"} size={20} />
          <span>{toast.text}</span>
          <button
            aria-label="Закрыть уведомление"
            onClick={() => setToast(null)}
          >
            <Icon name="x" size={16} />
          </button>
        </div>
      )}
      {panel === "reset" && (
        <Modal title="Восстановить демо-данные?" onClose={() => setPanel(null)}>
          <p className="modal-description">
            Созданные заявки и изменения статусов в этом браузере будут заменены
            четырьмя исходными примерами.
          </p>
          <div className="modal-actions">
            <Button variant="secondary" onClick={() => setPanel(null)}>
              Отмена
            </Button>
            <Button
              onClick={async () => {
                api.resetDemo();
                await refresh();
                setPanel(null);
                navigate(employee ? "/queue" : "/overview");
                notify("Исходные демо-данные восстановлены");
              }}
            >
              Восстановить
            </Button>
          </div>
        </Modal>
      )}
      {panel === "notifications" && (
        <Modal title="Ваши уведомления" onClose={() => setPanel(null)}>
          <div className="notifications-list">
            {applications
              .filter((a) => ["needs_info", "approved"].includes(a.status))
              .map((a) => (
                <button
                  key={a.id}
                  onClick={() => {
                    setPanel(null);
                    navigate(`/applications/${a.id}`);
                  }}
                >
                  <span
                    className={`stat-icon ${a.status === "approved" ? "green-soft" : "amber-soft"}`}
                  >
                    <Icon name={a.status === "approved" ? "check" : "chat"} />
                  </span>
                  <span>
                    <strong>
                      {a.status === "approved"
                        ? "Финансирование одобрено"
                        : "Нужны дополнительные сведения"}
                    </strong>
                    <small>{a.id}</small>
                  </span>
                  <Icon name="chevron" size={17} />
                </button>
              ))}
          </div>
          {!applications.some((a) =>
            ["needs_info", "approved"].includes(a.status),
          ) && (
            <Empty
              title="Вы в курсе всех событий"
              text="Новые уведомления появятся здесь."
            />
          )}
        </Modal>
      )}
    </div>
  );
}
