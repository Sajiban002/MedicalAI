# api/diagnosis_routes.py
from fastapi import APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from typing import List, Dict, Any, Optional
from datetime import datetime
import os
import json
from utils.diagnosis_storage import get_user_diagnosis_history, get_diagnosis_by_id

# Create router
diagnosis_router = APIRouter(prefix="/diagnosis", tags=["diagnosis"])

# Function to check if user is authenticated
async def get_current_user(request: Request) -> Optional[str]:
    # Check Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        # You would normally decode and validate the token here
        # This is a placeholder for actual auth logic
        return "user_from_token"
    
    # Check user profile cookie
    user_cookie = request.cookies.get("user_profile_id")
    if user_cookie:
        return user_cookie
    
    return None

@diagnosis_router.get("/")
async def list_diagnoses(request: Request, limit: int = 10):
    """List all diagnoses for the authenticated user"""
    try:
        user_id = await get_current_user(request)
        
        if not user_id:
            # For anonymous users, we return an empty list
            # You could also return a 401 Unauthorized, depending on your requirements
            return JSONResponse(content={"diagnoses": [], "message": "No authenticated user found"})
        
        history = await get_user_diagnosis_history(user_id, limit)
        return JSONResponse(content={"diagnoses": history})
    except Exception as e:
        print(f"ОШИБКА при получении списка диагнозов: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@diagnosis_router.get("/{diagnosis_id}")
async def get_diagnosis_details(diagnosis_id: str, request: Request):
    """Get detailed information about a specific diagnosis"""
    try:
        user_id = await get_current_user(request)
        
        # If user is authenticated, look in their directory first
        diagnosis = await get_diagnosis_by_id(diagnosis_id, user_id)
        
        if not diagnosis:
            # If not found or no authenticated user, try to find it anywhere
            diagnosis = await get_diagnosis_by_id(diagnosis_id)
            
        if diagnosis:
            # Make a copy to avoid modifying the original
            result = dict(diagnosis)
            
            # Add a flag indicating whether this is from the current user or anonymous
            if user_id and result.get("user_id") == user_id:
                result["is_own"] = True
            else:
                result["is_own"] = False
                
            return JSONResponse(content=result)
        else:
            raise HTTPException(status_code=404, detail="Diagnosis not found")
    except Exception as e:
        print(f"ОШИБКА при получении деталей диагноза: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@diagnosis_router.get("/stats/summary")
async def get_diagnosis_stats(request: Request):
    """Get summary statistics for the user's diagnoses"""
    try:
        user_id = await get_current_user(request)
        
        if not user_id:
            return JSONResponse(content={"message": "No authenticated user found"})
        
        # Try to fetch stats from database API
        import httpx
        try:
            async with httpx.AsyncClient() as client:
                # Исправленный URL без слеша в конце
                response = await client.get(
                    f"{os.environ.get('DATABASE_API_URL', 'http://localhost:5001/api/diagnosis')}/stats/user",
                    headers={"Authorization": f"Bearer {user_id}"}
                )
                
                if response.status_code == 200:
                    return JSONResponse(content=response.json())
        except Exception as e:
            print(f"Error retrieving stats from database: {str(e)}")
        
        # Fallback to calculating from local files
        # Get all diagnoses for the user
        history = await get_user_diagnosis_history(user_id, limit=100)  # Increase limit to get more data
        
        if not history:
            return JSONResponse(content={"total_diagnoses": 0})
        
        # Process statistics
        stats = {
            "total_diagnoses": len(history),
            "first_diagnosis_date": min([item.get("timestamp", "") for item in history]),
            "latest_diagnosis_date": max([item.get("timestamp", "") for item in history]),
            "most_common_diagnoses": []
        }
        
        # Get most common diagnoses
        diagnoses_count = {}
        for item in history:
            main_diagnosis = item.get("main_diagnosis", "Unknown")
            if main_diagnosis in diagnoses_count:
                diagnoses_count[main_diagnosis] += 1
            else:
                diagnoses_count[main_diagnosis] = 1
        
        # Sort by frequency
        sorted_diagnoses = sorted(diagnoses_count.items(), key=lambda x: x[1], reverse=True)
        stats["most_common_diagnoses"] = [{"name": name, "count": count} for name, count in sorted_diagnoses[:5]]
        
        return JSONResponse(content=stats)
    except Exception as e:
        print(f"ОШИБКА при получении статистики: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@diagnosis_router.delete("/{diagnosis_id}")
async def delete_diagnosis(diagnosis_id: str, request: Request):
    """Delete a specific diagnosis (only for authenticated users and their own diagnoses)"""
    try:
        user_id = await get_current_user(request)
        
        if not user_id:
            raise HTTPException(status_code=401, detail="Authentication required")
        
        # Try to delete from database first
        import httpx
        try:
            async with httpx.AsyncClient() as client:
                # Исправленный URL без слеша в конце
                response = await client.delete(
                    f"{os.environ.get('DATABASE_API_URL', 'http://localhost:5001/api/diagnosis')}/{diagnosis_id}",
                    headers={"Authorization": f"Bearer {user_id}"}
                )
                
                if response.status_code == 200:
                    # Also delete from local file system if exists
                    storage_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "diagnoses")
                    file_path = os.path.join(storage_dir, user_id, f"{diagnosis_id}.json")
                    if os.path.exists(file_path):
                        os.remove(file_path)
                    
                    return JSONResponse(content=response.json())
        except Exception as e:
            print(f"Error deleting from database: {str(e)}")
        
        # Fallback to file system deletion
        # Check if diagnosis exists and belongs to the user
        diagnosis = await get_diagnosis_by_id(diagnosis_id, user_id)
        
        if not diagnosis:
            raise HTTPException(status_code=404, detail="Diagnosis not found or does not belong to you")
        
        # Get the file path
        storage_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "data", "diagnoses")
        file_path = os.path.join(storage_dir, user_id, f"{diagnosis_id}.json")
        
        # Delete the file
        if os.path.exists(file_path):
            os.remove(file_path)
            return JSONResponse(content={"message": "Diagnosis deleted successfully"})
        else:
            raise HTTPException(status_code=404, detail="Diagnosis file not found")
    except Exception as e:
        print(f"ОШИБКА при удалении диагноза: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))