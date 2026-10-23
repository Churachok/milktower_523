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
import { routeForRole } from "./domain/navigation";
const readRole = () => {
  if (api.mode !== "mock") return "login";
  try {
    return (
      sessionStorage.getItem("potok.role") ||
      (api.mode === "mock" ? "client" : "login")
    );
  } catch {
    return api.mode === "mock" ? "client" : "login";
  }
};
const readRoute = () => window.location.hash.replace(/^#/, "") || "/overview";
export default function App() {
  const [route, setRoute] = useState(readRoute);
  const [role, setRole] = useState(readRole);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [toast, setToast] = useState(null);
  const [mobileNav, setMobileNav] = useState(false);
  const [panel, setPanel] = useState(null);
  const [creating, setCreating] = useState(false);
  const [calculatorValue, setCalculatorValue] = useState({
    productId: "working",
    amount: 1000000,
    term: 24,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const toastTimer = useRef();
  const notify = useCallback((text, type = "success") => {
    clearTimeout(toastTimer.current);
    setToast({ text, type });
    toastTimer.current = setTimeout(() => setToast(null), 6000);
  }, []);
  const navigate = useCallback((path) => {
    if (window.location.hash === `#${path}`) setRoute(path);
    else window.location.hash = path;
    setMobileNav(false);
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
      setError(e.message);
      throw e;
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    refresh().catch(() => {});
    const hash = () => setRoute(readRoute());
    const sync = () => refresh().catch(() => {});
    const storage = (e) => {
      if (e.key === "potok.applications.v1") {
        invalidateDemo();
        sync();
      }
    };
    window.addEventListener("hashchange", hash);
    window.addEventListener("potok-change", sync);
    window.addEventListener("storage", storage);
    return () => {
      window.removeEventListener("hashchange", hash);
      window.removeEventListener("potok-change", sync);
      window.removeEventListener("storage", storage);
      clearTimeout(toastTimer.current);
    };
  }, [refresh]);
  useEffect(() => {
    document.title = `${role === "employee" ? "Рабочее место" : "Кредитный кабинет"} — Milk Tower`;
  }, [role]);
  function changeRole(value) {
    if (value === role) return;
    const destination = routeForRole(route, value, applications);
    setRole(value);
    try {
      sessionStorage.setItem("potok.role", value);
    } catch {}
    setPanel(null);
    if (api.mode === "http" && value !== "login") {
      setLoading(true);
      refresh().catch(() => {});
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
        { path: "/overview", icon: "grid", name: "Обзор" },
        {
          path: "/applications",
          icon: "file",
          name: "Мои заявки",
          badge: applications.length,
        },
        { path: "/products", icon: "wallet", name: "Кредитные продукты" },
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
      (route === "/support" ? "Поддержка" : "Кабинет");
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
  if (role === "login") return <Login onLogin={changeRole} />;
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
          onClick={() => navigate(employee ? "/queue" : "/overview")}
        >
          <Brand />
        </button>
        <div className="company-switch">
          <span className="company-avatar">
            <Icon name={employee ? "briefcase" : "building"} size={20} />
          </span>
          <span>
            <strong>{employee ? "Кредитный отдел" : "Мануфактура"}</strong>
            <small>
              {employee
                ? "Рабочее пространство"
                : "Общество с ограниченной отв."}
            </small>
          </span>
          <Icon name="down" size={14} />
        </div>
        <span className="nav-caption">
          {employee ? "РАБОЧЕЕ ПРОСТРАНСТВО" : "ВАШ КАБИНЕТ"}
        </span>
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
        <div className="sidebar-divider" />
        <button
          className={`nav-item ${route === "/support" ? "active" : ""}`}
          onClick={() => navigate("/support")}
        >
          <Icon name="chat" />
          <span>Поддержка</span>
          <span className="online-dot" />
        </button>
        <div className="sidebar-spacer" />
        {!employee && (
          <div className="manager-card">
            <div className="manager-card-label">ВАШ БИЗНЕС-ПАРТНЁР</div>
            <div className="manager-info">
              <span className="avatar manager-avatar">
                ЕС
                <i />
              </span>
              <div>
                <strong>Елена Смирнова</strong>
                <small>Поможет с любым вопросом</small>
              </div>
            </div>
            <button onClick={() => navigate("/support")}>
              Написать менеджеру <Icon name="arrow" size={15} />
            </button>
          </div>
        )}
        <div className="sidebar-bottom">
          <Icon name="shield" size={16} />
          <span>
            {api.mode === "mock"
              ? "Демонстрационный кабинет"
              : "Защищённое соединение"}
          </span>
          <span className="version-label">v1.0</span>
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
            {api.mode === "mock" && (
              <div className="role-switch" aria-label="Демонстрационная роль">
                <button
                  onClick={() => changeRole("client")}
                  className={!employee ? "selected" : ""}
                >
                  Клиент
                </button>
                <button
                  onClick={() => changeRole("employee")}
                  className={employee ? "selected" : ""}
                >
                  Сотрудник
                </button>
              </div>
            )}
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
              onClick={() => setPanel("profile")}
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
      {panel === "profile" && (
        <Modal title="Профиль" onClose={() => setPanel(null)}>
          <div className="profile-summary">
            <span className="avatar large-avatar">
              {employee ? "ЕС" : "АВ"}
            </span>
            <h3>{employee ? "Елена Смирнова" : "Александр Волков"}</h3>
            <p>
              {employee
                ? "Кредитный специалист"
                : "ООО «Мануфактура» · ИНН 5408123456"}
            </p>
          </div>
          {api.mode === "mock" && (
            <Notice>
              В демо переключение ролей служит для проверки сценария.
              Промышленная авторизация и доступы должны проверяться сервером.
            </Notice>
          )}
          <div className="profile-actions">
            {api.mode === "mock" && (
              <Button
                variant="secondary"
                icon="rotate"
                onClick={() => setPanel("reset")}
              >
                Восстановить демо-данные
              </Button>
            )}
            <Button
              variant="danger-quiet"
              icon="logout"
              loading={loggingOut}
              onClick={logout}
            >
              Выйти из кабинета
            </Button>
          </div>
        </Modal>
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
function Login({ onLogin }) {
  const [selected, setSelected] = useState("client");
  const [busy, setBusy] = useState(false);
  const [loginError, setLoginError] = useState("");
  async function checkSession() {
    setBusy(true);
    setLoginError("");
    try {
      const session = await api.session();
      if (!["client", "employee"].includes(session?.role))
        throw new Error("Сервер не вернул допустимую роль");
      onLogin(session.role);
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="login-page">
      <div className="login-brand">
        <Brand />
      </div>
      <section className="login-story">
        <span className="eyebrow">MILK TOWER · БИЗНЕС</span>
        <h1>
          Кредитный кабинет
          <br />
          вашей компании.
        </h1>
        <p>
          Подайте заявку, отправьте документы
          <br />и получите решение банка онлайн.
        </p>
        <img
          className="login-brand-art"
          src="/brand/milk-tower.svg"
          alt="Бутылка молока на стопке купюр — логотип Milk Tower"
        />
        <small>Кредитный кабинет предпринимателя</small>
      </section>
      <section className="login-form card">
        <span className="product-icon large">
          <Icon name="shield" size={26} />
        </span>
        <h2>Добро пожаловать</h2>
        <p>Войдите в свой кредитный кабинет</p>
        {api.mode === "mock" ? (
          <>
            <div className="role-switch login-role">
              <button
                className={selected === "client" ? "selected" : ""}
                onClick={() => setSelected("client")}
              >
                Я предприниматель
              </button>
              <button
                className={selected === "employee" ? "selected" : ""}
                onClick={() => setSelected("employee")}
              >
                Я сотрудник
              </button>
            </div>
            <div className="demo-user">
              <span className="avatar">
                {selected === "client" ? "АВ" : "ЕС"}
              </span>
              <div>
                <strong>
                  {selected === "client"
                    ? "Александр Волков"
                    : "Елена Смирнова"}
                </strong>
                <small>
                  {selected === "client"
                    ? "ООО «Мануфактура»"
                    : "Кредитный специалист"}
                </small>
              </div>
            </div>
            <Button onClick={() => onLogin(selected)}>
              Войти в демо-кабинет <Icon name="arrow" size={18} />
            </Button>
            <small className="legal-note">
              Синтетическая учётная запись. Пароль не требуется.
            </small>
          </>
        ) : (
          <>
            <Notice tone="amber">
              Подключён HTTP-адаптер. Для входа требуется серверная сессия.
              Авторизацию необходимо интегрировать с командой бэкенда.
            </Notice>
            {loginError && (
              <p className="error-text" role="alert">
                {loginError}
              </p>
            )}
            <Button loading={busy} onClick={checkSession}>
              Проверить серверную сессию
            </Button>
          </>
        )}
      </section>
      <div className="login-footer">
        © 2026 Milk Tower · Умный кредитный кабинет
      </div>
    </div>
  );
}
