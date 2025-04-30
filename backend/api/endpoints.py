# endpoints.py
import re
from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import JSONResponse
from models.schemas import PromptRequest
from utils import vision_utils, gemini_utils
from utils.diagnosis_storage import save_diagnosis_result, get_user_diagnosis_history, get_diagnosis_by_id
from config.settings import settings, clean_output, prepare_disease_context

api_router = APIRouter()

def extract_diagnosis_predictions(text):
    try:
        main_diagnosis_match = re.search(r"ОСНОВНОЙ ДИАГНОЗ:?\s*(.*?)(?=\n\n|\n[А-Я]{2,}|$)", text, re.DOTALL | re.IGNORECASE)
        main_diagnosis = main_diagnosis_match.group(1).strip() if main_diagnosis_match else "Неопределенный диагноз"
        main_diagnosis = re.sub(r'\d+\s*[-:]?\s*', '', main_diagnosis).strip()
        
        forecast_pattern = r"ПРОГНОЗ ЗАБОЛЕВАНИЙ:(?:(.*?)(?=\n\n|\n[А-Я]{2,}|$))"
        forecast_match = re.search(forecast_pattern, text, re.DOTALL | re.IGNORECASE)

        if forecast_match:
            forecast_text = forecast_match.group(1).strip()
            diagnosis_pattern = r"(\d+)%\s*[-–]\s*([А-Яа-я\s\w]+)"
            matches = re.findall(diagnosis_pattern, forecast_text)

            if matches:
                diagnoses = []
                for prob, name in matches:
                    name = name.strip()
                    if "," in name:
                        name = name.split(",")[0].strip()
                    words = name.split()
                    if len(words) > 2:
                        name = " ".join(words[:2])
                    diagnoses.append({"probability": int(prob), "name": name})
                
                if main_diagnosis not in [d["name"] for d in diagnoses]:
                    highest_prob = max(diagnoses, key=lambda x: x["probability"])
                    if highest_prob["probability"] > 50:
                        highest_prob["name"] = main_diagnosis
                
                total_probability = sum(diag["probability"] for diag in diagnoses)
                if total_probability > 0 and total_probability != 100:
                    factor = 100 / total_probability
                    for diag in diagnoses:
                        diag["probability"] = round(diag["probability"] * factor)
                    
                    total_after = sum(diag["probability"] for diag in diagnoses)
                    if total_after != 100:
                        diff = 100 - total_after
                        diagnoses[0]["probability"] += diff
                
                if 1 <= len(diagnoses) <= 6:
                    return diagnoses
        

        if "," not in main_diagnosis and not forecast_match:
            return [{"probability": 100, "name": main_diagnosis}]
        
        related_conditions = []
        if "гриппоподобн" in main_diagnosis.lower() or "орви" in main_diagnosis.lower():
            related_conditions = ["Сезонный грипп", "Риновирусная инфекция", "Парагрипп"]
        elif "бронхит" in main_diagnosis.lower():
            related_conditions = ["Трахеит", "Бронхиальная астма", "Пневмония"]
        elif "фарингит" in main_diagnosis.lower() or "тонзиллит" in main_diagnosis.lower():
            related_conditions = ["Стрептококковая инфекция", "Вирусная инфекция горла", "Ларингит"]
        elif "дерматит" in main_diagnosis.lower():
            related_conditions = ["Аллергическая реакция", "Экзема", "Контактный дерматит"]
        elif "головн" in main_diagnosis.lower() and "боль" in main_diagnosis.lower():
            related_conditions = ["Мигрень", "Напряжение мышц", "Гипертония"]
        elif "ринит" in main_diagnosis.lower():
            related_conditions = ["Синусит", "Аллергический ринит", "Назофарингит"]
        elif "простуд" in main_diagnosis.lower():
            related_conditions = ["ОРВИ", "Насморк", "Ларингит"]
        else:
            related_conditions = ["Респираторная инфекция", "Другая патология", "Вирусное заболевание"]
        
        # Формируем список диагнозов с вероятностями
        diagnoses = [
            {"probability": 60, "name": main_diagnosis},
            {"probability": 25, "name": related_conditions[0]},
            {"probability": 15, "name": related_conditions[1]}
        ]
        
        return diagnoses

    except Exception as e:
        print(f"Ошибка при извлечении диагнозов: {str(e)}")
        return [
            {"probability": 70, "name": main_diagnosis if main_diagnosis != "Неопределенный диагноз" else "Острая респираторная инфекция"},
            {"probability": 30, "name": "Вирусная инфекция"}
        ]

async def extract_recommended_medications(text):
    try:
        medications = []
        recommendations_section = re.search(r"РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ:?\s*(.*?)(?=\n\n|\n[А-Я]{2,}|$)", text, re.DOTALL | re.IGNORECASE)
        if recommendations_section:
            recs_text = recommendations_section.group(1).strip()
            med_matches = re.finditer(r'[-*•]\s*([А-Яа-я\s\d-]+)(?:\s*\(([^)]+)\))?', recs_text)
            for med_match in med_matches:
                name = med_match.group(1).strip()
                category = med_match.group(2).strip() if med_match.group(2) else "Симптоматическое лечение"
                if name and name not in [m["name"] for m in medications]:
                    medications.append({"name": name, "category": category})
            if not medications:
                lines = recs_text.split("\n")
                for line in lines:
                    line = line.strip()
                    if line and not line.startswith("РЕКОМЕНДУЕМЫЕ") and len(line) > 3:
                        if ":" in line:
                            parts = line.split(":", 1)
                            name = parts[0].strip()
                            category = parts[1].strip() if len(parts) > 1 else "Симптоматическое лечение"
                        else:
                            name = line
                            category = "Симптоматическое лечение"
                        if name and name not in [m["name"] for m in medications]:
                            medications.append({"name": name, "category": category})
        return medications

    except Exception as e:
        print(f"Ошибка при извлечении рекомендуемых медикаментов: {str(e)}")
        return []


@api_router.post("/generate")
async def generate_text(request: Request, prompt_request: PromptRequest):
    try:
        print(f"Получен запрос на генерацию текста с промптом: {prompt_request.prompt}")
        prompt = prompt_request.prompt or "Общая консультация"
        disease_context = prepare_disease_context(prompt, settings.disease_data)

        full_prompt = f"""
        {settings.medical_system_prompt}

        Данные о болезнях:
        {disease_context}

        Симптомы: {prompt}

        ВАЖНАЯ ИНСТРУКЦИЯ:

        1. ОБЯЗАТЕЛЬНО предоставьте список возможных диагнозов с их вероятностями в формате:
        ПРОГНОЗ ЗАБОЛЕВАНИЙ:
        XX% - [Короткое название болезни]
        YY% - [Короткое название болезни]
        ZZ% - [Короткое название болезни]

        2. ВАЖНО: Названия болезней должны быть КОРОТКИМИ (1-3 слова), без длинных объяснений или уточнений.
        Неправильно: "Острый вирусный ринофарингит с осложнением в виде бронхита"
        Правильно: "Острый бронхит"

        3. ОБЯЗАТЕЛЬНО включите минимум 2-3 различных заболевания с разными процентами вероятности.
        Общая сумма процентов должна равняться 100%.

        4. ВАЖНО: Никогда не используйте обобщенные диагнозы вроде "Другие возможные причины" или "Другие заболевания" - только конкретные заболевания.

        5. В разделе РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ ОБЯЗАТЕЛЬНО перечислите 2-4 конкретных безрецептурных препарата в точно таком формате (включая тире и скобки):
        РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ:
        - [Название препарата] (категория)
        - [Название препарата] (категория)
        - [Название препарата] (категория)
        - [Название препарата] (категория)

        6. НЕ ПРОПУСКАЙТЕ ни один из этих разделов. Каждый раздел ОБЯЗАТЕЛЕН к заполнению согласно инструкциям.

        Предоставьте медицинский анализ:
        """

        print(f"Отправляем запрос к Gemini...")
        response = settings.text_model.generate_content(full_prompt)
        response_text = response.text if response and hasattr(response, 'text') else "Нет ответа от модели."
        cleaned_response = clean_output(response_text)

        diagnosis_predictions = extract_diagnosis_predictions(cleaned_response)
        recommended_medications = await extract_recommended_medications(cleaned_response)

        for pred in diagnosis_predictions:
            pred["name"] = re.sub(r'\d+\s*[-:]?\s*', '', pred["name"]).strip()

        # Save the diagnosis results
        save_diagnosis_result(
            request=request,
            diagnosis_predictions=diagnosis_predictions,
            recommended_medications=recommended_medications,
            generated_text=cleaned_response,
            symptoms=prompt
        )

        result = {
            "generated_text": cleaned_response,
            "diagnosis_predictions": diagnosis_predictions,
            "recommended_medications": recommended_medications
        }

        print(f"Ответ получен успешно. Длина текста: {len(result['generated_text'])}")
        return JSONResponse(content=result)
    except Exception as e:
        print(f"ОШИБКА при генерации текста: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@api_router.post("/analyze-image")
async def analyze_image(request: Request, file: UploadFile = File(...), description: str = Form("")):
    try:
        print(f"Получен запрос на анализ изображения с описанием: {description}")
        if not file.content_type.startswith('image/'):
            print(f"Ошибка: Получен файл неверного типа: {file.content_type}")
            raise HTTPException(status_code=400, detail="Only images allowed")

        file_content = await file.read()
        vision_analysis = await vision_utils.analyze_image_with_vision(file_content)
        print(f"Результат анализа Vision API получен")

        vision_description = vision_analysis["ru_description"]
        medical_terms = vision_analysis.get("medical_terms", [])
        medical_terms_str = ", ".join(medical_terms) if medical_terms else ""
        medical_relevance = vision_analysis.get("medical_relevance", "unknown")
        medical_relevance_ru = vision_utils.translate_text(medical_relevance, 'ru')

        combined_description = description + "\n" + vision_description
        if medical_terms_str:
            combined_description += "\n\nВозможные медицинские термины: " + medical_terms_str

        disease_context = prepare_disease_context(combined_description, settings.disease_data)

        prompt_text = f"""
        {settings.medical_system_prompt}

        {"ВНИМАНИЕ: Это изображение имеет высокую медицинскую релевантность." if medical_relevance == "high" else ""}
        {"ВАЖНО: Это изображение может иметь отношение к медицинской тематике." if medical_relevance == "medium" else ""}

        Данные о болезнях:
        {disease_context}

        Медицинская релевантность изображения: {medical_relevance_ru.upper()}

        Симптомы и анализ изображения: {combined_description}

        ВАЖНАЯ ИНСТРУКЦИЯ:

        1. ОБЯЗАТЕЛЬНО предоставьте список возможных диагнозов с их вероятностями в формате:
        ПРОГНОЗ ЗАБОЛЕВАНИЙ:
        XX% - [Короткое название болезни]
        YY% - [Короткое название болезни]
        ZZ% - [Короткое название болезни]

        2. ВАЖНО: Названия болезней должны быть КОРОТКИМИ (1-3 слова), без длинных объяснений или уточнений.
        Неправильно: "Острый вирусный ринофарингит с осложнением в виде бронхита"
        Правильно: "Острый бронхит"

        3. ОБЯЗАТЕЛЬНО включите минимум 2-3 различных заболевания с разными процентами вероятности.
        Общая сумма процентов должна равняться 100%.

        4. ВАЖНО: Никогда не используйте обобщенные диагнозы вроде "Другие возможные причины" или "Другие заболевания" - только конкретные заболевания.

        5. В разделе РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ ОБЯЗАТЕЛЬНО перечислите 2-4 конкретных безрецептурных препарата в точно таком формате (включая тире и скобки):
        РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ:
        - [Название препарата] (категория)
        - [Название препарата] (категория)
        - [Название препарата] (категория)
        - [Название препарата] (категория)

        6. НЕ ПРОПУСКАЙТЕ ни один из этих разделов. Каждый раздел ОБЯЗАТЕЛЕН к заполнению согласно инструкциям.

        Предоставьте медицинский анализ:
        """

        print(f"Отправляем данные на анализ в Gemini...")
        response = settings.text_model.generate_content(prompt_text)
        response_text = response.text if response and hasattr(response, 'text') else "Нет ответа от модели."
        cleaned_response = clean_output(response_text)
        diagnosis_predictions = extract_diagnosis_predictions(cleaned_response)
        main_diagnosis = None
        main_diagnosis_match = re.search(r"ОСНОВНОЙ ДИАГНОЗ:?\s*(.*?)(?=\n\n|\n[А-Я]{2,}|$)", cleaned_response, re.DOTALL | re.IGNORECASE)
        if main_diagnosis_match:
            main_diagnosis = re.sub(r'\d+\s*[-:]?\s*', '', main_diagnosis_match.group(1).strip())
        if main_diagnosis and main_diagnosis not in [pred["name"] for pred in diagnosis_predictions]:
            highest_pred = max(diagnosis_predictions, key=lambda x: x["probability"]) if diagnosis_predictions else None
            if highest_pred and highest_pred["probability"] > 50:
                highest_pred["name"] = main_diagnosis
        recommended_medications = await extract_recommended_medications(cleaned_response)

        for pred in diagnosis_predictions:
            pred["name"] = re.sub(r'\d+\s*[-:]?\s*', '', pred["name"]).strip()
        
        # Save the diagnosis results
        save_diagnosis_result(
            request=request,
            diagnosis_predictions=diagnosis_predictions,
            recommended_medications=recommended_medications,
            generated_text=cleaned_response,
            symptoms=combined_description
        )

        result = {
            "description": description,
            "vision_analysis": vision_description,
            "medical_terms": medical_terms,
            "medical_relevance": medical_relevance_ru,
            "raw_text": vision_analysis["raw_text"],
            "generated_text": cleaned_response,
            "diagnosis_predictions": diagnosis_predictions,
            "recommended_medications": recommended_medications
        }

        print(f"Анализ изображения успешно завершен.")
        return JSONResponse(content=result)
    except Exception as e:
        print(f"ОШИБКА при анализе изображения: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Image analysis error: {str(e)}")


@api_router.post("/generate-from-image-and-prompt")
async def generate_from_image_and_prompt(request: Request, file: UploadFile = File(...), prompt: str = Form(...)):
    try:
        print(f"Получен запрос на анализ изображения с промптом: {prompt}")
        if not file.content_type.startswith('image/'):
            print(f"Ошибка: Получен файл неверного типа: {file.content_type}")
            raise HTTPException(status_code=400, detail="Only images allowed")

        file_content = await file.read()
        vision_analysis = await vision_utils.analyze_image_with_vision(file_content)
        print(f"Результат анализа Vision API получен")

        vision_description = vision_analysis["ru_description"]
        medical_terms = vision_analysis.get("medical_terms", [])
        medical_terms_str = ", ".join(medical_terms) if medical_terms else ""
        medical_relevance = vision_analysis.get("medical_relevance", "unknown")
        medical_relevance_ru = vision_utils.translate_text(medical_relevance, 'ru')

        combined_prompt = prompt
        if medical_terms_str:
            combined_prompt += "\n\nВозможные медицинские термины на изображении: " + medical_terms_str

        combined_info = combined_prompt + " " + vision_description
        disease_context = prepare_disease_context(combined_info, settings.disease_data)

        prompt_text = f"""
        {settings.medical_system_prompt}

        {"ВНИМАНИЕ: Это изображение имеет высокую медицинскую релевантность." if medical_relevance == "high" else ""}
        {"ВАЖНО: Это изображение может иметь отношение к медицинской тематике." if medical_relevance == "medium" else ""}

        Данные о болезнях:
        {disease_context}

        Медицинская релевантность изображения: {medical_relevance_ru.upper()}

        Симптомы из запроса: {combined_prompt}

        Анализ изображения: {vision_description}

        ВАЖНАЯ ИНСТРУКЦИЯ:

        1. ОБЯЗАТЕЛЬНО предоставьте список возможных диагнозов с их вероятностями в формате:
        ПРОГНОЗ ЗАБОЛЕВАНИЙ:
        XX% - [Короткое название болезни]
        YY% - [Короткое название болезни]
        ZZ% - [Короткое название болезни]

        2. ВАЖНО: Названия болезней должны быть КОРОТКИМИ (1-3 слова), без длинных объяснений или уточнений.
        Неправильно: "Острый вирусный ринофарингит с осложнением в виде бронхита"
        Правильно: "Острый бронхит"

        3. ОБЯЗАТЕЛЬНО включите минимум 2-3 различных заболевания с разными процентами вероятности.
        Общая сумма процентов должна равняться 100%.

        4. ВАЖНО: Никогда не используйте обобщенные диагнозы вроде "Другие возможные причины" или "Другие заболевания" - только конкретные заболевания.

        5. В разделе РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ ОБЯЗАТЕЛЬНО перечислите 2-4 конкретных безрецептурных препарата в точно таком формате (включая тире и скобки):
        РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ:
        - [Название препарата] (категория)
        - [Название препарата] (категория)
        - [Название препарата] (категория)
        - [Название препарата] (категория)

        6. НЕ ПРОПУСКАЙТЕ ни один из этих разделов. Каждый раздел ОБЯЗАТЕЛЕН к заполнению согласно инструкциям.

        Предоставьте медицинский анализ:
        """

        print(f"Отправляем данные на анализ в Gemini...")
        response = settings.text_model.generate_content(prompt_text)
        response_text = response.text if response and hasattr(response, 'text') else "Нет ответа от модели."
        cleaned_response = clean_output(response_text)

        diagnosis_predictions = extract_diagnosis_predictions(cleaned_response)
        recommended_medications = await extract_recommended_medications(cleaned_response)

        for pred in diagnosis_predictions:
            pred["name"] = re.sub(r'\d+\s*[-:]?\s*', '', pred["name"]).strip()
        
        # Save the diagnosis results
        save_diagnosis_result(
            request=request,
            diagnosis_predictions=diagnosis_predictions,
            recommended_medications=recommended_medications,
            generated_text=cleaned_response,
            symptoms=combined_prompt
        )

        result = {
            "description": prompt,
            "vision_analysis": vision_description,
            "medical_terms": medical_terms,
            "medical_relevance": medical_relevance_ru,
            "raw_text": vision_analysis["raw_text"],
            "generated_text": cleaned_response,
            "diagnosis_predictions": diagnosis_predictions,
            "recommended_medications": recommended_medications
        }

        print(f"Анализ изображения и текста успешно завершен.")
        return JSONResponse(content=result)
    except Exception as e:
        print(f"ОШИБКА при анализе изображения и текста: {str(e)}")
        raise HTTPException(status_code=500, detail=f"Generation error: {str(e)}")

# Add new routes for diagnosis history and retrieval
@api_router.get("/history/{user_id}")
async def get_history(user_id: str, limit: int = 10):
    """Get diagnosis history for a specific user"""
    try:
        history = get_user_diagnosis_history(user_id, limit)
        return JSONResponse(content={"history": history})
    except Exception as e:
        print(f"ОШИБКА при получении истории: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))

@api_router.get("/diagnosis/{diagnosis_id}")
async def get_diagnosis(diagnosis_id: str, request: Request):
    """Get a specific diagnosis by ID"""
    try:
        # Get user ID if available
        user_id = None
        auth_header = request.headers.get("Authorization")
        
        if auth_header and auth_header.startswith("Bearer "):
            # You would normally decode and validate the token here
            user_id = "user_from_token"  # This should be replaced with actual auth logic
        
        # Check if user has a profile cookie
        user_cookie = request.cookies.get("user_profile_id")
        if user_cookie:
            user_id = user_cookie
            
        diagnosis = get_diagnosis_by_id(diagnosis_id, user_id)
        if diagnosis:
            return JSONResponse(content=diagnosis)
        else:
            raise HTTPException(status_code=404, detail="Diagnosis not found")
    except Exception as e:
        print(f"ОШИБКА при получении диагноза: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))