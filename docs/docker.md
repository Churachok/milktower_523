# Docker: полный продукт и отдельное демо

Нужны работающий Docker Engine / Docker Desktop и Compose 2.20+. Проверить `docker info` и `docker compose version`. Основной стек рассчитан на обычный CPU, 4 ядра / 8 ГБ ОЗУ; Node.js и Python на хосте не нужны.

## Полный продукт

```bash
./scripts/run.sh
```

Адрес: [http://localhost:8080](http://localhost:8080). `compose.yaml` запускает все три компонента:

| Сервис | Назначение | Лимит CPU / RAM |
|---|---|---|
| frontend | Node.js 22 при сборке, Nginx/React, `VITE_API_MODE=http`, `/api/` → backend | 0,5 / 128 МиБ |
| backend | FastAPI, SQLite, cookie-сессии, API на :8000, ML по внутренней сети | 1 / 1 ГиБ |
| ml | Python 3.12.12, правила и `/score` на :8001, без внешних API | 0,5 / 128 МиБ |

Общий runtime-лимит — 2 CPU / 1,25 ГиБ; сборка и Docker требуют память дополнительно. Healthchecks ожидают ML → backend → frontend. Backend и ML наружу не опубликованы. Сервисы запускаются непривилегированными пользователями, корневая файловая система read-only; backend пишет в том `/data`, временные файлы — в `/tmp`.

Без настроек работает порт 8080. Для другого порта скопировать `.env.example` в `.env` и изменить `APP_PORT`. Пример имён локальных образов — `.env.integration.example`; `.env.integration` передавать явно через `--env-file`.

```bash
docker compose ps
docker compose logs --tail=100
docker compose exec -T frontend nginx -t
node scripts/smoke.mjs http://127.0.0.1:8080
docker compose down
```

Smoke проверяет SPA, статику, cache headers, локальный Swagger, совпадение commit frontend/backend, Nginx API, сессии и права, загрузку двух PDF, настоящий скоринг, дозапрос, предложение и выдачу. CI также перезапускает backend и сравнивает сохранённую заявку с исходным результатом. Для него нужен Node.js 22.12+. Обычный `down` сохраняет SQLite в `backend-data`; `down -v` удаляет данные. Seed создаётся только в новой БД, миграции применяются при старте.

`compose.integration.yaml` оставлен для совместимости старой команды `-f compose.yaml -f compose.integration.yaml`: отдельного включения backend больше не требуется.

## Отдельное браузерное демо

```bash
docker compose -f compose.demo.yaml up --build -d --wait
node scripts/smoke.mjs http://127.0.0.1:8080 --demo
docker compose -f compose.demo.yaml down
```

Этот состав содержит frontend target `demo` и ML. Заявки находятся в localStorage; `/ml-api/` проксируется в ML, `/api/` возвращает JSON 503. Для переключения режимов сначала остановить текущий состав. При смене порта/origin браузерное хранилище другое; серверный режим localStorage не использует.

## Опциональные AI-помощники ML

```bash
# GROQ_API_KEY передаётся только ML; хранить ключ в локальном .env.
docker compose -f compose.yaml -f compose.ai.yaml up --build -d --wait
```

ML использует `Dockerfile.ai` и FastAPI вместо stdlib-сервера. Контракт `/score` сохраняется, поэтому backend продолжает работать. AI endpoints доступны внутри Docker-сети; публичный UI их пока не вызывает. Без ключа healthcheck и локальный скоринг работают, AI endpoints возвращают 503. Внешние запросы выполняются только при явном вызове помощников. Детали — [ML](../ml/README.md).

## GPU и проверки конфигурации

Текущим правилам GPU не требуется. `compose.gpu.yaml` — резерв для будущего `ml/Dockerfile.gpu`; такого Dockerfile в поставке нет, GPU-запуск не поддерживается. CPU остаётся рабочим вариантом.

```bash
docker compose config --quiet
docker compose -f compose.demo.yaml config --quiet
docker compose -f compose.yaml -f compose.integration.yaml config --quiet
docker compose -f compose.yaml -f compose.ai.yaml config --quiet
docker compose -f compose.yaml -f compose.gpu.yaml config --quiet
```

Проверка конфигурации не подтверждает сборку или запуск. Фактические результаты — [verification.md](verification.md). При ошибке подключения к `/var/run/docker.sock` сначала требуется запустить Docker на хосте.

## Версия и внешний сервер

`./scripts/run.sh` передаёт полный hash из Git / SOURCE_COMMIT в Docker. Прямой Compose без BUILD_COMMIT помечает версию как development. Базовые образы Node, Nginx, Python и uv закреплены по digest; Swagger UI также включён локально по npm lock-файлу. Сам backend проверяется Python urllib, curl в образе не нужен.

[HTTPS-конфигурация сервера](../deploy/README.md) находится в compose.server.yaml; по умолчанию не включена. [Подготовка сдаваемого архива](submission.md) сохраняет только исходники точного commit и контрольные суммы.
