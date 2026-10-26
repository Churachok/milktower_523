"""Единственный источник правил переходов статусов заявки."""

# (из статуса, в статус) -> роль, которой разрешён переход
TRANSITIONS = {
    ("draft", "submitted"): "client",
    ("needs_info", "submitted"): "client",
    ("submitted", "manual_review"): "employee",
    ("manual_review", "needs_info"): "employee",
    ("manual_review", "approved"): "employee",
    ("manual_review", "rejected"): "employee",
    ("approved", "issued"): "client",
}
STATUSES = {
    "draft", "submitted", "manual_review", "needs_info",
    "approved", "rejected", "issued",
}
TERMINAL = {"rejected", "issued"}


def required_role(src: str, dst: str) -> str | None:
    """Роль, которой разрешён переход, или None, если перехода нет."""
    return TRANSITIONS.get((src, dst))
