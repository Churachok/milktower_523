FROM python:3.12.12-slim@sha256:f3fa41d74a768c2fce8016b98c191ae8c1bacd8f1152870a3f9f87d350920b7c
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 \
    UV_PROJECT_ENVIRONMENT=/opt/venv PATH="/opt/venv/bin:$PATH" \
    DATA_DIR=/data
COPY --from=ghcr.io/astral-sh/uv:0.13.5@sha256:32a7bb39b496babbd997b0a39a4d66c126bdaf5661b302bf6f06abda8deca6ff /uv /usr/local/bin/uv
ARG BUILD_COMMIT=development
ENV BUILD_COMMIT=$BUILD_COMMIT RELEASE_VERSION=1.1.0
LABEL org.opencontainers.image.source="https://github.com/Churachok/milktower_523" \
      org.opencontainers.image.revision=$BUILD_COMMIT \
      org.opencontainers.image.version="1.1.0"
WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY app ./app
COPY migrations ./migrations
RUN useradd -r -u 10001 app && mkdir /data && chown app /data
USER app
EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
