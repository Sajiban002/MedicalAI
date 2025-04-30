import json
import time
import os
import requests
from src.config import NEWS_CACHE_TIME, GNEWS_API_KEY

CACHE_FILE = "data/news_cache.json"
CATEGORY_CACHE_FILES = {
    "general": "data/news_cache_general.json",
    "flu": "data/news_cache_flu.json",
    "health_tech": "data/news_cache_health_tech.json",
    "research": "data/news_cache_research.json",
    "treatment": "data/news_cache_treatment.json"
}

os.makedirs(os.path.dirname(CACHE_FILE), exist_ok=True)
for cache_file in CATEGORY_CACHE_FILES.values():
    os.makedirs(os.path.dirname(cache_file), exist_ok=True)

def get_cached_news(category="general"):
    cache_file = CATEGORY_CACHE_FILES.get(category, CACHE_FILE)
    
    try:
        if os.path.exists(cache_file):
            with open(cache_file, "r") as f:
                cache = json.load(f)

            if time.time() - cache["timestamp"] < NEWS_CACHE_TIME:
                print(
                    f"Using news cache for {category}. Time until update: {NEWS_CACHE_TIME - (time.time() - cache['timestamp'])} sec."
                )
                return cache["data"]
    except Exception as e:
        print(f"Error reading news cache for {category}: {e}")

    return None

def cache_news(news_data, category="general"):
    cache_file = CATEGORY_CACHE_FILES.get(category, CACHE_FILE)
    
    try:
        cache = {
            "timestamp": time.time(),
            "data": news_data,
        }

        with open(cache_file, "w") as f:
            json.dump(cache, f)
        print(f"News successfully cached for {category}: {len(news_data)} entries")
    except Exception as e:
        print(f"Error saving news cache for {category}: {e}")

def fetch_news(category="general"):
    print(f"Running fetch_news() for category: {category}")

    category_queries = {
        "general": "medicine OR health OR medical OR healthcare",
        "flu": "flu OR influenza OR ORVI OR respiratory illness",
        "health_tech": "health technology OR medical devices OR digital health OR telehealth",
        "research": "medical research OR clinical trials OR medical breakthrough",
        "treatment": "treatment OR therapy OR medication OR medical procedure"
    }
    
    query = category_queries.get(category, category_queries["general"])

    cached_news = get_cached_news(category)
    if cached_news:
        print(f"Returning cached data for {category}")
        return cached_news
    
    try:
        print(f"Cache not found or expired for {category}, making request to GNews API")

        base_url = "https://gnews.io/api/v4/search"
        params = {
            "q": query,
            "lang": "en",
            "max": 12,
            "apikey": GNEWS_API_KEY,
        }

        response = requests.get(base_url, params=params)
        print(f"Request URL: {response.url}")
        print(f"Status code: {response.status_code}")
        
        response.raise_for_status()

        data = response.json()

        processed_news = []
        seen_urls = set()
        seen_titles = set()

        if data and "articles" in data:
            for item in data["articles"]:
                url = item.get("url", "")
                title = item.get("title", "")

                if url in seen_urls or title in seen_titles:
                    print(f"Skipping duplicate news: {title}")
                    continue

                seen_urls.add(url)
                seen_titles.add(title)

                news_item = {
                    "title": title,
                    "summary": item.get("description", ""),
                    "url": url,
                    "source": item.get("source", {}).get("name", ""),
                    "time_published": item.get("publishedAt", ""),
                    "image_url": item.get("image", "https://placehold.co/600x400?text=Medical+News"),
                    "category": category
                }
                processed_news.append(news_item)

        print(f"Received unique news from API: {len(processed_news)}")

        if processed_news:
            cache_news(processed_news, category)
            return processed_news

        print("Failed to get data from GNews API")
        return []

    except requests.exceptions.HTTPError as http_err:
        print(f"HTTP error getting news: {http_err}")
        print(f"Status code: {response.status_code}")
        print(f"Response text: {response.text}")
        import traceback
        traceback.print_exc()
        return []

    except Exception as e:
        print(f"Error getting news: {e}")
        import traceback
        traceback.print_exc()
        return []