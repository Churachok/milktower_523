# Docker: демо и командная интеграция

## Окружение

Целевой ПК: 4 ядра CPU, 8 ГБ ОЗУ, современный браузер. Нужны запущенный Docker Engine с Compose 2.20+ или Docker Desktop с Linux-контейнерами. Для демо оставить около 2 ГБ диска под образы/кэш; размер ML-артефактов позднее укажет Михаил. Установка: [Docker Engine](https://docs.docker.com/engine/install/), [Docker Desktop](https://docs.docker.com/desktop/).

`docker info` и `docker compose version` должны выполняться успешно. Если `/var/run/docker.sock` отсутствует, запустить Docker Desktop или службу Docker по правилам ОС. Node.js и Python на хосте для Docker-запуска не нужны. GPU не требуется для CPU-режима.

## 1. Доступное frontend-демо

Из корня:

```bash
docker compose up --build -d --wait --wait-timeout 60
```

Открыть [http://localhost:8080](http://localhost:8080). `compose.yaml` собирает target `demo`: Node.js 22 устанавливает npm-пакеты по lock-файлу и собирает `VITE_API_MODE=mock`; финальный Nginx-образ содержит только готовые файлы. `/api/` возвращает JSON с HTTP 503. Healthcheck проверяет `/index.html`.

Публикация только на localhost сохраняет браузерный secure context. При необходимости скопировать `.env.example` в `.env` и изменить `APP_PORT`. В `.env` для демонстрации нет обязательных настроек.

## 2. Подготовленная CPU-интеграция команды

В конфигурации уже согласованы имена сервисов, порты, тома и порядок готовности. До запуска Дмитрий добавляет `backend/Dockerfile` и сервер, Михаил — `ml/Dockerfile` и inference; вместе они согласуют ML API, сессии, синтетический seed и серверные проверки. Сейчас этих реализаций нет, поэтому общий стек ещё не запускается.

```bash
docker compose --parallel 1 -f compose.yaml -f compose.integration.yaml up --build -d --wait --wait-timeout 180
```

| Сервис | Контейнерный адрес | Подготовлено |
|---|---|---|
| frontend | `:8080`, снаружи `localhost:8080` | Target `integration`: `VITE_API_MODE=http`, Nginx сохраняет `/api/v1/...` при проксировании на backend |
| backend | `backend:8000` | Build context `./backend`, `ML_BASE_URL=http://ml:8001`, `DATA_DIR=/data`, том `backend-data` |
| ml | `ml:8001` | Build context `./ml`, `ML_DEVICE=cpu`, BLAS/OpenMP по 2 потока, том `ml-cache` в `/cache` |

Порты backend и ML наружу не опубликованы. Оба образа должны содержать `curl` и предоставлять `GET /healthz` без авторизации. HTTP 200 означает готовность хранилища / загруженной модели. Compose ожидает ML, затем backend, затем frontend. Таймаут готовности не включает время сборки.

Образы запускают непривилегированный процесс, слушают `0.0.0.0`, заранее создают `/data` или `/cache` с нужными правами. Файловая система read-only; запись доступна в соответствующий том и `/tmp`. Исполнение из `/tmp` отключено. Runtime, которому нужен JIT или дополнительные writable-каталоги, владелец сервиса отдельно проверяет и согласует с этими настройками.

Дополнительные теги настраиваются через `.env.integration.example`. Скопировать его в `.env.integration` и передать явно:

```bash
docker compose --parallel 1 --env-file .env.integration -f compose.yaml -f compose.integration.yaml up --build -d --wait --wait-timeout 180
```

`BACKEND_IMAGE`, `ML_IMAGE` задают имена локальных сборок. Готовые образы можно загрузить заранее, собрать frontend через `docker compose -f compose.yaml -f compose.integration.yaml build frontend`, затем запустить общую конфигурацию с `--no-build`; доступность и версии образов остаются ответственностью команды. В финальном комплекте предпочтителен общий воспроизводимый `--build` из исходников.

## 3. Опциональная NVIDIA GPU

Этот вариант применяется после CPU-интеграции. Нужны совместимая NVIDIA GPU, драйвер и NVIDIA Container Toolkit; Михаил добавляет `ml/Dockerfile.gpu` с совместимым runtime и поддержкой `ML_DEVICE=cuda`. Модель, её CPU/GPU-совместимость и расход VRAM пока не определены. AMD/Intel и ПК без дискретной карты используют CPU-режим.

```bash
docker compose --parallel 1 -f compose.yaml -f compose.integration.yaml -f compose.gpu.yaml up --build -d --wait --wait-timeout 180
```

Дополнение выделяет одну NVIDIA GPU только ML-сервису, выбирает `ML_GPU_IMAGE` и `Dockerfile.gpu`. Оно не входит в запуск по умолчанию. Документация: [GPU в Compose](https://docs.docker.com/compose/how-tos/gpu-support/).

## Бюджет для 4 CPU / 8 ГБ

| Режим / сервис | Лимит CPU | Лимит ОЗУ |
|---|---|---|
| Отдельное демо frontend | 1 | 128 МиБ |
| Интеграция: frontend | 0,5 | 128 МиБ |
| Интеграция: backend | 1 | 1 ГиБ |
| Интеграция: ML | 2 | 3 ГиБ |
| Интеграция: сумма | 3,5 | 4,125 ГиБ |

Сборка выполняется вне runtime-лимитов. Heap Node.js ограничен 1 ГиБ; npm, native-код и Docker расходуют память дополнительно. Для демо Docker Desktop ориентир — 2 CPU / 2 ГБ, для интеграции виртуальной машине потребуется больше памяти в общем бюджете ПК. Команды общего запуска используют `--parallel 1`, чтобы ограничить параллельные операции Compose. Для отдельной последовательной сборки после добавления Dockerfiles можно выполнить `docker compose --parallel 1 -f compose.yaml -f compose.integration.yaml build`, затем общий `up --no-build`.

Лимит ML — бюджет, а не измеренное потребление модели: Михаил проверяет холодный старт, размер и пиковую память вместе с runtime. Логи каждого сервиса ротируются: два файла по 5 МиБ. tmpfs учитывается в памяти соответствующего контейнера. Для rootless Docker применение лимитов зависит от cgroups хоста. Если добавляется отдельная БД, её память включается в общий бюджет и таблица пересматривается.

## Проверки и данные

```bash
docker compose config --quiet
docker compose -f compose.yaml -f compose.integration.yaml config --quiet
docker compose -f compose.yaml -f compose.integration.yaml -f compose.gpu.yaml config --quiet
node scripts/check-repository.mjs
```

Последняя команда требует Node.js 22.12+. Против работающего **демо** выполнить `node scripts/smoke.mjs`, при другом порте передать URL аргументом. Скрипт проверяет HTML, JS/CSS, шрифты, графику, SPA fallback, cache headers, HTTP 404 для отсутствующего asset и JSON 503 для API. Для интеграции надо отдельно проверить серверные сессии, API и сквозной [сценарий](test-scenarios.md); ожидание JSON 503 относится только к демо.

Для каждой команды управления интеграцией использовать те же `-f` и `--env-file`, что при запуске: `ps`, `logs --tail=100`, `exec -T frontend nginx -t`, `down`. Обычный `docker compose down` относится к базовому демо и не является командой полной остановки интеграционного состава.

Демо хранит заявки в браузере; сохранять тот же адрес, порт и профиль для доступа к прежним данным. Интеграционный `/data` и ML-кэш находятся в Docker volumes, обычный `down` их сохраняет. `down -v` удаляет эти данные. В Git они не попадают.

Модель должна входить в воспроизводимую сборку с лицензией, версией и checksum; получать её при каждом inference-запуске не следует. Базовые теги Node/Nginx обновляемые, digest пока не закреплены; ключевые npm-зависимости зафиксированы lock-файлом. При подготовке финальной версии владельцы сервисов фиксируют свои runtime/зависимости, необходимые артефакты и THIRD_PARTY_NOTICES.

Конфигурации сверены с [Compose Services](https://docs.docker.com/reference/compose-file/services/) и [правилами объединения Compose](https://docs.docker.com/compose/how-tos/multiple-compose-files/merge/). Фактически выполненные проверки — в [verification.md](verification.md).
