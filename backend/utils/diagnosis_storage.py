# utils/diagnosis_storage.py
import os
import json
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Any
from fastapi import Request
import httpx
import asyncio

# Backup path for JSON storage
STORAGE_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data", "diagnoses")
os.makedirs(STORAGE_DIR, exist_ok=True)

# Database API endpoint
DATABASE_API_URL = os.environ.get("DATABASE_API_URL", "http://localhost:5001/api/diagnosis")  

def get_user_id_from_request(request: Request) -> Optional[str]:
    """
    Extract user ID from request if user is authenticated
    Return None for anonymous users
    """
    auth_header = request.headers.get("Authorization")
    
    if auth_header and auth_header.startswith("Bearer "):
        return "user_from_token"  
    
    user_cookie = request.cookies.get("user_profile_id")
    if user_cookie:
        return user_cookie
    
    return None

async def save_to_database(data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Save diagnosis data to database API
    """
    try:
        async with httpx.AsyncClient() as client:
            # Используем URL без завершающего слеша
            response = await client.post(
                DATABASE_API_URL, 
                json={
                    "diagnosis_id": data["diagnosis_id"],
                    "symptoms": data["symptoms"],
                    "diagnosis_data": data  # Pass the entire data structure
                },
                headers={
                    "Content-Type": "application/json",
                    "Authorization": f"Bearer {data.get('user_id')}" if data.get('user_id') else ""
                }
            )
            
            # Улучшенная обработка ответа: сначала проверяем статус
            if response.status_code != 200:
                 print(f"Warning: Database API returned status code {response.status_code}")
                 print(f"Response body: {response.text}")
                 # Вместо попытки парсить HTML как JSON, возвращаем ошибку
                 return {"success": False, "error": f"Database API returned status {response.status_code}"}

            # Теперь парсим JSON только если статус 200
            response_data = response.json()
            return response_data
            
    except Exception as e:
        print(f"Error saving to database: {str(e)}") 
        return {"success": False, "error": str(e)}

def save_diagnosis_result(
    request: Request,
    diagnosis_predictions: List[Dict[str, Any]], 
    recommended_medications: List[Dict[str, Any]],
    generated_text: str,
    symptoms: str
) -> Dict[str, Any]:
    """
    Save diagnosis results to database and JSON file backup
    Returns the saved data structure
    """
    user_id = get_user_id_from_request(request)
    diagnosis_id = str(uuid.uuid4())
    timestamp = datetime.now().isoformat()
    
    data = {
        "diagnosis_id": diagnosis_id,
        "timestamp": timestamp,
        "symptoms": symptoms,
        "diagnosis_predictions": diagnosis_predictions,
        "recommended_medications": recommended_medications,
        "generated_text": generated_text,
    }
    
    if user_id:
        data["user_id"] = user_id
        user_dir = os.path.join(STORAGE_DIR, user_id)
        os.makedirs(user_dir, exist_ok=True)
        file_path = os.path.join(user_dir, f"{diagnosis_id}.json")
    else:
        anon_dir = os.path.join(STORAGE_DIR, "anonymous")
        os.makedirs(anon_dir, exist_ok=True)
        file_path = os.path.join(anon_dir, f"{diagnosis_id}.json")
    
    # Save to database asynchronously
    asyncio.create_task(save_to_database(data)) 
    
    # Write to file as backup
    try:
        with open(file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        print(f"Diagnosis saved to {file_path}")
    except Exception as e:
        print(f"Error saving diagnosis to file: {str(e)}")
    
    return data

async def get_user_diagnosis_history(user_id: str, limit: int = 10) -> List[Dict[str, Any]]:
    """
    Retrieve diagnosis history for a specific user
    Uses database API with fallback to JSON files
    """
    if not user_id:
        return []
    
    try:
        async with httpx.AsyncClient() as client:
            # Используем URL без завершающего слеша и добавляем параметры запроса
            response = await client.get(
                f"{DATABASE_API_URL}?limit={limit}&offset=0",
                headers={
                    "Authorization": f"Bearer {user_id}"
                }
            )
            
            if response.status_code == 200:
                data = response.json()
                # Node.js возвращает { rows: [...], count: ... }
                return data.get("rows", []) 
            else:
                 print(f"Warning: Database API (history) returned status code {response.status_code}")
                 print(f"Response body: {response.text}")
                 return [] # При ошибке или отсутствии данных возвращаем пустой список
                 
    except Exception as e:
        print(f"Error retrieving from database: {str(e)}")
    
    # Fallback to JSON files
    history = []
    user_dir = os.path.join(STORAGE_DIR, user_id)
    if not os.path.exists(user_dir):
        return []
    
    for filename in os.listdir(user_dir):
        if filename.endswith('.json'):
            try:
                with open(os.path.join(user_dir, filename), 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    # Add a simplified version to history 
                    history.append({
                        "diagnosis_id": data.get("diagnosis_id"),
                        "timestamp": data.get("timestamp"),
                        "symptoms": data.get("symptoms"),
                        "main_diagnosis": data.get("diagnosis_predictions", [{}])[0].get("name", "Unknown") 
                                        if data.get("diagnosis_predictions") else "Unknown",
                    })
            except Exception as e:
                print(f"Error reading diagnosis file {filename}: {str(e)}")
    
    history.sort(key=lambda x: x.get("timestamp", ""), reverse=True)
    return history[:limit]

async def get_diagnosis_by_id(diagnosis_id: str, user_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Retrieve a specific diagnosis by ID
    Uses database API with fallback to JSON files
    """
    try:
        async with httpx.AsyncClient() as client:
            headers = {}
            if user_id:
                headers["Authorization"] = f"Bearer {user_id}"
            
            # Используем URL без завершающего слеша и добавляем ID
            response = await client.get(
                f"{DATABASE_API_URL}/{diagnosis_id}",
                headers=headers
            )
            
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 404:
                 print(f"Diagnosis {diagnosis_id} not found in database API (status 404)")
                 return None # Не найден в БД
            else:
                 print(f"Error retrieving diagnosis {diagnosis_id} from database API: Status {response.status_code}")
                 print(f"Response body: {response.text}")
                 return None # При других ошибках тоже считаем, что не найден

    except Exception as e:
        print(f"Error retrieving diagnosis {diagnosis_id} from database: {str(e)}")
    
    # Fallback to JSON files (без изменений)
    # If user_id is provided, look only in their directory
    if user_id:
        user_dir = os.path.join(STORAGE_DIR, user_id)
        if os.path.exists(user_dir):
            file_path = os.path.join(user_dir, f"{diagnosis_id}.json")
            if os.path.exists(file_path):
                try:
                    with open(file_path, 'r', encoding='utf-8') as f:
                        return json.load(f)
                except Exception as e:
                    print(f"Error reading diagnosis file: {str(e)}")
    else:
        # Look in both user directories and anonymous directory
        anon_path = os.path.join(STORAGE_DIR, "anonymous", f"{diagnosis_id}.json")
        if os.path.exists(anon_path):
            try:
                with open(anon_path, 'r', encoding='utf-8') as f:
                    return json.load(f)
            except Exception as e:
                print(f"Error reading anonymous diagnosis file: {str(e)}")
                
        for root, dirs, files in os.walk(STORAGE_DIR):
            if f"{diagnosis_id}.json" in files:
                # Проверяем, что это не папка anonymous, если user_id не был указан
                # и не папка пользователя, если user_id был указан
                is_anonymous_dir = "anonymous" in root.split(os.sep)
                is_user_dir = user_id is not None and str(user_id) in root.split(os.sep)

                if (user_id is None and is_anonymous_dir) or (user_id is not None and is_user_dir):
                     file_path = os.path.join(root, f"{diagnosis_id}.json")
                     try:
                         with open(file_path, 'r', encoding='utf-8') as f:
                            return json.load(f)
                     except Exception as e:
                        print(f"Error reading diagnosis file: {str(e)}")


    return None