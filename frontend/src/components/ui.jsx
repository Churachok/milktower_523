import React, { useEffect, useRef, useId } from "react";
import { STATUS } from "../domain/application";

const paths = {
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
  file: (
    <>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M8 13h8M8 17h5" />
    </>
  ),
  wallet: (
    <>
      <path d="M20 8V5a2 2 0 0 0-2-2H5a3 3 0 0 0 0 6h15v11H5a3 3 0 0 1-3-3V6" />
      <path d="M20 12h-5v5h5" />
      <path d="M16.5 14.5h.01" />
    </>
  ),
  folder: (
    <path d="M3 7V5a2 2 0 0 1 2-2h5l2 3h7a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
  ),
  arrow: (
    <>
      <path d="M4 12h16m-6-6 6 6-6 6" />
    </>
  ),
  arrowUp: (
    <>
      <path d="M6 18 18 6M6 6h12v12" />
    </>
  ),
  chevron: <path d="m9 5 7 7-7 7" />,
  down: <path d="m6 9 6 6 6-6" />,
  back: <path d="m14 6-6 6 6 6" />,
  check: <path d="m5 12 4 4L19 6" />,
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  bell: (
    <>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  chat: (
    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5H3l2.6-4.5A8.5 8.5 0 1 1 21 11.5Z" />
  ),
  shield: (
    <>
      <path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6z" />
      <path d="m8 12 3 3 5-6" />
    </>
  ),
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v6m0-10v.01" />
    </>
  ),
  search: (
    <>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="m16 16 5 5" />
    </>
  ),
  download: (
    <>
      <path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4M7 9l5-5 5 5M4 16v5h16v-5" />
    </>
  ),
  x: <path d="m6 6 12 12M6 18 18 6" />,
  trash: (
    <>
      <path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7" />
    </>
  ),
  logout: (
    <>
      <path d="M9 3H4v18h5M9 12h12m-5-5 5 5-5 5" />
    </>
  ),
  building: (
    <>
      <path d="M3 21V7l9-4v18M12 9l9-3v15M1 21h22M6 9h2m-2 4h2m-2 4h2m7-5h3m-3 4h3" />
    </>
  ),
  rotate: (
    <>
      <path d="M20 7A9 9 0 0 0 4 7L2 10m0-6v6h6M4 17a9 9 0 0 0 16 0l2-3m0 6v-6h-6" />
    </>
  ),
  percent: (
    <>
      <circle cx="6" cy="6" r="3" />
      <circle cx="18" cy="18" r="3" />
      <path d="M20 4 4 20" />
    </>
  ),
  star: (
    <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-3-5.6 3 1.1-6.2L3 9.6l6.2-.9z" />
  ),
  menu: <path d="M3 6h18M3 12h18M3 18h18" />,
  help: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M9.5 8.5a2.6 2.6 0 0 1 5 .8c0 2-2.5 2.5-2.5 4m0 3v.01" />
    </>
  ),
  users: (
    <>
      <circle cx="9" cy="8" r="3" />
      <path d="M2 21v-3a7 7 0 0 1 14 0v3m0-16a3 3 0 0 1 0 6m4 10v-3a7 7 0 0 0-3-5" />
    </>
  ),
  sparkle: (
    <>
      <path d="m12 2 2.7 7.3L22 12l-7.3 2.7L12 22l-2.7-7.3L2 12l7.3-2.7z" />
    </>
  ),
  briefcase: (
    <>
      <rect x="3" y="7" width="18" height="14" rx="2" />
      <path d="M8 7V3h8v4M3 12a25 25 0 0 0 18 0M12 12v4" />
    </>
  ),
};
export function Icon({ name, size = 20, className = "", ...props }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    >
      {paths[name] || paths.file}
    </svg>
  );
}
export function Brand({ compact = false }) {
  return (
    <div className="brand">
      <img
        className="brand-mark"
        src="/brand/milk-tower.svg"
        alt=""
        aria-hidden="true"
      />
      {!compact && (
        <span className="brand-wordmark">
          milk tower<span className="brand-caption">КРЕДИТНЫЙ КАБИНЕТ</span>
        </span>
      )}
    </div>
  );
}
export function Button({
  children,
  variant = "primary",
  icon,
  className = "",
  loading,
  ...props
}) {
  return (
    <button
      className={`button button-${variant} ${className}`}
      disabled={loading || props.disabled}
      {...props}
    >
      {loading ? (
        <span className="spinner" />
      ) : (
        icon && <Icon name={icon} size={18} />
      )}{" "}
      {children}
    </button>
  );
}
export function Badge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return (
    <span className={`badge badge-${s.tone}`}>
      <i />
      {s.label}
    </span>
  );
}
export function PageHeading({ eyebrow, title, description, children }) {
  return (
    <div className="page-heading">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="heading-actions">{children}</div>}
    </div>
  );
}
export function Empty({
  icon = "folder",
  title = "Здесь пока ничего нет",
  text,
  children,
}) {
  return (
    <div className="empty">
      <span className="empty-icon">
        <Icon name={icon} size={28} />
      </span>
      <h3>{title}</h3>
      <p>{text}</p>
      {children}
    </div>
  );
}
export function Field({ label, error, hint, children, className = "" }) {
  const generatedId = useId();
  const controlId = children.props.id || generatedId;
  const messageId = `${controlId}-message`;
  const control = React.cloneElement(children, {
    id: controlId,
    "aria-invalid": error ? true : children.props["aria-invalid"],
    "aria-describedby": error || hint ? messageId : undefined,
  });
  return (
    <div className={`field ${className} ${error ? "field-error" : ""}`}>
      <label htmlFor={controlId} className="field-label">
        {label}
      </label>
      {control}
      {error ? (
        <span id={messageId} className="field-message" role="alert">
          {error}
        </span>
      ) : (
        hint && (
          <span id={messageId} className="field-hint">
            {hint}
          </span>
        )
      )}
    </div>
  );
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef();
  const previous = useRef(document.activeElement);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const node = ref.current;
    node.focus();
    const scroll = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function key(e) {
      if (e.key === "Escape") closeRef.current();
      if (e.key === "Tab") {
        const els = node.querySelectorAll(
          'button:not(:disabled), input, textarea, select, a[href], [tabindex="0"]',
        );
        if (!els.length) {
          e.preventDefault();
          return;
        }
        const first = els[0],
          last = els[els.length - 1];
        if (
          e.shiftKey &&
          (document.activeElement === first || document.activeElement === node)
        ) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("keydown", key);
      document.body.style.overflow = scroll;
      previous.current?.focus();
    };
  }, []);
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        tabIndex={-1}
        className={`modal ${wide ? "modal-wide" : ""}`}
      >
        <div className="modal-heading">
          <h2 id="modal-title">{title}</h2>
          <button
            className="icon-button"
            aria-label="Закрыть"
            onClick={onClose}
          >
            <Icon name="x" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
export function Notice({ tone = "blue", children, icon = "info" }) {
  return (
    <div className={`notice notice-${tone}`}>
      <Icon name={icon} />
      <div>{children}</div>
    </div>
  );
}
export function Timeline({ history }) {
  return (
    <div className="timeline">
      {[...history].reverse().map((item, i) => (
        <div
          className={`timeline-item ${i === 0 ? "latest" : ""}`}
          key={item.id}
        >
          <span className="timeline-dot">
            {i === 0 && <Icon name="check" size={11} />}
          </span>
          <div>
            <strong>{item.title}</strong>
            <p>{item.detail}</p>
            <small>
              {new Date(item.at).toLocaleString("ru-RU", {
                day: "numeric",
                month: "long",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "Asia/Novosibirsk",
              })}{" "}
              · {item.actor}
            </small>
          </div>
        </div>
      ))}
    </div>
  );
}
export function DownloadSummary({ app, notify }) {
  return (
    <Button
      variant="secondary"
      icon="download"
      onClick={() => {
        const text = `Milk Tower — демонстрационная заявка\n${app.id}\nКомпания: ${app.company.name}\nСумма: ${app.amount} ₽\nСрок: ${app.term} мес.\nСтатус: ${STATUS[app.status].label}\n${app.offer ? `Предложение: ${app.offer.amount} ₽, ${app.offer.term} мес., ${app.offer.rate}% годовых\n` : ""}${app.rejectionReason || ""}\nСинтетические данные. Не является кредитным договором.`;
        const url = URL.createObjectURL(
          new Blob([text], { type: "text/plain;charset=utf-8" }),
        );
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `${app.id}.txt`;
        anchor.click();
        URL.revokeObjectURL(url);
        notify("Сводка по заявке скачана");
      }}
    >
      Скачать сводку
    </Button>
  );
}
