import os
import sys
from io import BytesIO
from pathlib import Path
from typing import Any, Dict

from dotenv import load_dotenv
from fastapi import FastAPI, File, HTTPException, UploadFile
from groq import Groq
from pydantic import BaseModel, Field
from pypdf import PdfReader

sys.path.insert(0, str(Path(__file__).resolve().parent))
from demo import score_application as score_demo
from domain.result_builder import build_result_payload
from domain.scoring import calculate_score

load_dotenv()
app = FastAPI(title="ML Scoring API (optional AI helpers)")


def get_groq_client():
    key = os.getenv("GROQ_API_KEY")
    if not key:
        raise HTTPException(status_code=503, detail="GROQ_API_KEY not configured")
    return Groq(api_key=key, timeout=10, max_retries=0)


# --- Модели данных (Pydantic) ---

class CompanyData(BaseModel):
    inn: str
    name: str
    monthly_revenue_avg: float
    revenue_trend_6m: float
    net_profit_avg: float
    debt_burden_ratio: float
    bki_has_delays: bool
    bki_max_delay_days: int
    bki_credit_history_months: int
    egrul_status: str
    tax_arrears: bool

class ApplicationData(BaseModel):
    requested_amount: float
    requested_term_months: int
    documents_provided: bool = False

class ScoringRequest(BaseModel):
    company: CompanyData
    application: ApplicationData

class ExtractedDocumentData(BaseModel):
    revenue: float
    expenses: float
    other_items: Dict[str, Any] = Field(default_factory=dict)
    summary: str

# --- Эндпоинты ---

@app.get("/healthz")
def health_check():
    return {"status": "ok"}

@app.post("/score")
def score_frontend(payload: dict):
    try:
        return score_demo(payload)
    except (ValueError, TypeError, OverflowError) as error:
        raise HTTPException(status_code=422, detail=str(error)) from error


@app.post("/api/v1/score")
def score_application(req: ScoringRequest):
    try:
        company_dict = req.company.model_dump()
        application_dict = req.application.model_dump()
        score_result = calculate_score(company_dict, application_dict)
        final_result = build_result_payload(score_result, application_dict)
        return final_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/v1/extract-document")
def extract_document(file: UploadFile = File(...)):
    """Разбор PDF документа через Groq."""
    groq_client = get_groq_client()

    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=415, detail="Only PDF is supported")
    pdf_content = file.file.read(10 * 1024 * 1024 + 1)
    if not pdf_content or len(pdf_content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=413, detail="PDF must be nonempty and at most 10 MiB")
    try:
        reader = PdfReader(BytesIO(pdf_content))
        text = ""
        for page in reader.pages:
            text += page.extract_text() or ""
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read PDF: {e}")

    if not text.strip():
        raise HTTPException(status_code=400, detail="PDF contains no readable text")

    truncated_text = text[:15000]
    prompt = f"""
    Ты — финансовый аналитик банка. Извлеки из текста документа следующие данные и верни их СТРОГО в формате JSON:
    - revenue (число): общая выручка
    - expenses (число): общие расходы
    - other_items (объект): любые другие важные финансовые показатели (например, "чистая прибыль", "долг")
    - summary (строка): краткое кредитное резюме (2-3 предложения) о финансовом состоянии компании.

    Текст документа:
    {truncated_text}
    """

    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[
                {"role": "system", "content": "Ты — полезный ассистент, который возвращает только валидный JSON."},
                {"role": "user", "content": prompt}
            ],
            model="openai/gpt-oss-120b",
            temperature=0.2,
            response_format={"type": "json_object"},
        )
        result_json = chat_completion.choices[0].message.content
        return ExtractedDocumentData.model_validate_json(result_json)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq API error: {e}")

@app.post("/api/v1/generate-client-request")
def generate_client_request(application_data: dict):
    """Генерация AI-запроса клиенту от лица сотрудника."""
    groq_client = get_groq_client()

    prompt = f"""
    Ты — сотрудник кредитного отдела банка. На основе данных заявки сформируй вежливый и четкий запрос дополнительной информации у клиента.
    Данные заявки: {application_data}
    
    Сформируй запрос, если не хватает данных (например, о текущей долговой нагрузке, целях кредита, подтверждении выручки). 
    Если данных достаточно, напиши "Данных достаточно для принятия решения".
    """

    try:
        chat_completion = groq_client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model="openai/gpt-oss-120b",
            temperature=0.7,
        )
        return {"request_text": chat_completion.choices[0].message.content}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Groq API error: {e}")