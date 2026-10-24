FROM python:3.12.12-alpine
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
RUN addgroup -S scoring && adduser -S -G scoring scoring
COPY domain ./domain
COPY fixtures ./fixtures
COPY demo.py server.py ./
USER scoring
EXPOSE 8001
HEALTHCHECK --interval=10s --timeout=3s --start-period=3s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8001/healthz', timeout=2)"
CMD ["python", "server.py", "--host", "0.0.0.0", "--port", "8001"]
