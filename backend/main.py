from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware import Middleware
from api.endpoints import api_router
from config.settings import settings
from utils import vision_utils, gemini_utils
import os
import json

# Load settings
#settings = Settings() # no need to initialize here

app = FastAPI(
    title="Medical Analysis API",
    description="API для анализа медицинских изображений с использованием Gemini AI и Google Vision",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc"
)

# Add middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def log_requests(request, call_next):
    print(f"Получен запрос: {request.method} {request.url}")
    try:
        response = await call_next(request)
        print(f"Статус ответа: {response.status_code}")
        return response
    except Exception as e:
        print(f"Ошибка при обработке запроса: {str(e)}")
        raise

# Include routers
app.include_router(api_router)

@app.get("/health")
async def health_check():
    print("Проверка состояния API...")
    return {
        "status": "online",
        "api": "Medical Analysis API",
        "disease_data_count": len(settings.disease_data),
        "medical_keywords_count": len(settings.medical_keywords),
        "vision_api": "configured" if vision_utils.vision_client else "not configured",
        "translate_api": "configured" if vision_utils.translate_client else "not configured"
    }

if __name__ == "__main__":
    import uvicorn
    print("Запуск сервера MedicalAI API с поддержкой Google Vision...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)