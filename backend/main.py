# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware import Middleware
from api.endpoints import api_router
from api.diagnosis_routes import diagnosis_router
from config.settings import settings
from utils import vision_utils, gemini_utils
import os
import json
from src.routes.news_routes import router as news_router

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
app.include_router(diagnosis_router, prefix="/api")  # Mount diagnosis router at /api/diagnosis

# Include news router
app.include_router(news_router, prefix="/api/news")

@app.get("/health")
async def health_check():
    print("Проверка состояния API...")
    
    # Check if diagnoses directory exists and create it if not
    diagnoses_dir = os.path.join(os.path.dirname(__file__), "data", "diagnoses")
    if not os.path.exists(diagnoses_dir):
        os.makedirs(diagnoses_dir, exist_ok=True)
        os.makedirs(os.path.join(diagnoses_dir, "anonymous"), exist_ok=True)
    
    anon_count = 0
    user_count = 0
    
    # Count anonymous diagnoses
    anon_dir = os.path.join(diagnoses_dir, "anonymous")
    if os.path.exists(anon_dir):
        anon_count = len([f for f in os.listdir(anon_dir) if f.endswith('.json')])
    
    # Count user diagnoses
    for root, dirs, files in os.walk(diagnoses_dir):
        if root != anon_dir:
            user_count += len([f for f in files if f.endswith('.json')])
    
    return {
        "status": "online",
        "api": "Medical Analysis API",
        "disease_data_count": len(settings.disease_data),
        "medical_keywords_count": len(settings.medical_keywords),
        "vision_api": "configured" if vision_utils.vision_client else "not configured",
        "translate_api": "configured" if vision_utils.translate_client else "not configured",
        "news_api": "configured",
        "diagnoses_storage": {
            "anonymous_diagnoses": anon_count,
            "user_diagnoses": user_count
        }
    }

if __name__ == "__main__":
    import uvicorn
    print("Запуск сервера MedicalAI API с поддержкой Google Vision и новостным сервисом...")
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)