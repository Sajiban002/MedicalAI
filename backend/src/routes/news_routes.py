from fastapi import APIRouter, HTTPException, Query
from src.news_service import fetch_news

router = APIRouter(tags=["news"])

@router.get("/")
def get_news(category: str = Query("general", description="News category")):
    """
    Get medical news by category.
    Available categories: general, flu, health_tech, research, treatment
    """
    if category not in ["general", "flu", "health_tech", "research", "treatment"]:
        raise HTTPException(status_code=400, detail="Invalid category. Available categories: general, flu, health_tech, research, treatment")
        
    news_data = fetch_news(category)

    if not news_data:
        raise HTTPException(status_code=404, detail="News not found")

    return news_data