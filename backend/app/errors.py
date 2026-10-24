from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class ApiError(Exception):
    def __init__(self, status: int, code: str, message: str):
        self.status, self.code, self.message = status, code, message


def _resp(status: int, code: str, message: str) -> JSONResponse:
    return JSONResponse(status_code=status, content={"code": code, "message": message})


def register_errors(app: FastAPI) -> None:
    @app.exception_handler(ApiError)
    async def api_error(_: Request, e: ApiError):
        return _resp(e.status, e.code, e.message)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(_: Request, e: StarletteHTTPException):
        msg = {404: "Не найдено", 405: "Метод не поддерживается"}.get(
            e.status_code, str(e.detail)
        )
        return _resp(e.status_code, "http_error", msg)

    @app.exception_handler(RequestValidationError)
    async def validation_error(_: Request, e: RequestValidationError):
        return _resp(400, "validation_error", "Проверьте введённые данные")

    @app.exception_handler(Exception)
    async def unexpected(_: Request, e: Exception):
        return _resp(500, "internal_error", "Внутренняя ошибка сервера")