# endpoints.py
import re
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from models.schemas import PromptRequest
from utils import vision_utils, gemini_utils
from config.settings import settings, clean_output, prepare_disease_context

api_router = APIRouter()

def extract_diagnosis_predictions(text):
    try:
        main_diagnosis_match = re.search(r"ОСНОВНОЙ ДИАГНОЗ:?\s*(.*?)(?=\n\n|\n[А-Я]{2,}|$)", text, re.DOTALL | re.IGNORECASE)
        main_diagnosis = main_diagnosis_match.group(1).strip() if main_diagnosis_match else "Неопределенный диагноз"
        forecast_pattern = r"ПРОГНОЗ ЗАБОЛЕВАНИЙ:(?:(.*?)(?=\n\n|\n[А-Я]{2,}|$))"
        forecast_match = re.search(forecast_pattern, text, re.DOTALL | re.IGNORECASE)

        if forecast_match:
            forecast_text = forecast_match.group(1).strip()
            diagnosis_pattern = r"(\d+)%\s*[-–]\s*([А-Яа-я\s\w]+)"
            matches = re.findall(diagnosis_pattern, forecast_text)

            if matches and len(matches) >= 2:
                diagnoses = []
                for prob, name in matches:
                    name = name.strip()
                    if "," in name:
                        name = name.split(",")[0].strip()
                    words = name.split()
                    if len(words) > 2:
                        name = " ".join(words[:2])
                    diagnoses.append({"probability": int(prob), "name": name})
                total_probability = sum(diag["probability"] for diag in diagnoses)
                if total_probability > 0:
                    if total_probability != 100:
                        factor = 100 / total_probability
                        for diag in diagnoses:
                            diag["probability"] = round(diag["probability"] * factor)
                    total_after = sum(diag["probability"] for diag in diagnoses)
                    if total_after != 100:
                        diff = 100 - total_after
                        diagnoses[0]["probability"] += diff
                    return diagnoses

        related_conditions = []
        if "гриппоподобн" in main_diagnosis.lower() or "орви" in main_diagnosis.lower():
            related_conditions = ["Сезонный грипп", "Риновирусная инфекция"]
        elif "бронхит" in main_diagnosis.lower():
            related_conditions = ["Трахеит", "Бронхиальная астма"]
        elif "фарингит" in main_diagnosis.lower() or "тонзиллит" in main_diagnosis.lower():
            related_conditions = ["Стрептококковая инфекция", "Вирусная инфекция горла"]
        elif "дерматит" in main_diagnosis.lower():
            related_conditions = ["Аллергическая реакция", "Экзема"]
        elif "головн" in main_diagnosis.lower() and "боль" in main_diagnosis.lower():
            related_conditions = ["Мигрень", "Напряжение мышц"]
        elif "ринит" in main_diagnosis.lower():
            related_conditions = ["Синусит", "Аллергический ринит"]
        else:
            related_conditions = ["Респираторная инфекция", "Другая патология"]

        diagnoses = [
            {"probability": 65, "name": main_diagnosis},
            {"probability": 25, "name": related_conditions[0]},
            {"probability": 10, "name": related_conditions[1]}
        ]
        return diagnoses

    except Exception as e:
        print(f"Ошибка при извлечении диагнозов: {str(e)}")
        return [
            {"probability": 40, "name": "Неопределенный диагноз"},
            {"probability": 35, "name": "Возможная вирусная инфекция"},
            {"probability": 25, "name": "Другие возможные причины"}
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
async def generate_text(request: PromptRequest):
    try:
        print(f"Получен запрос на генерацию текста с промптом: {request.prompt}")
        prompt = request.prompt or "Общая консультация"
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
async def analyze_image(file: UploadFile = File(...), description: str = Form("")):
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

        4. ВАЖНО: Никогда не используйте обобщенные диагнозы вроде "Другие возможные причины" или "Другие заболевания" - только конкретные заболевания.

        5. В разделе ОСНОВНОЙ ДИАГНОЗ укажите только КРАТКОЕ название болезни (не более 3 слов).

        6. В разделе РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ перечислите 2-4 конкретных безрецептурных препарата в формате:
        РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ:
        - [Название препарата] (категория)
        - [Название препарата] (категория)

        7. ВАЖНО: Даже если вы не уверены в диагнозе на 100%, вы ОБЯЗАНЫ перечислить конкретные возможные заболевания.

        Предоставьте медицинский анализ:
        """

        print(f"Отправляем данные на анализ в Gemini...")
        response = settings.text_model.generate_content(prompt_text)
        response_text = response.text if response and hasattr(response, 'text') else "Нет ответа от модели."
        cleaned_response = clean_output(response_text)

        diagnosis_predictions = extract_diagnosis_predictions(cleaned_response)
        recommended_medications = await extract_recommended_medications(cleaned_response)

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
async def generate_from_image_and_prompt(file: UploadFile = File(...), prompt: str = Form(...)):
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

        4. ВАЖНО: Никогда не используйте обобщенные диагнозы вроде "Другие возможные причины" или "Другие заболевания" - только конкретные заболевания.

        5. В разделе ОСНОВНОЙ ДИАГНОЗ укажите только КРАТКОЕ название болезни (не более 3 слов).

        6. В разделе РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ перечислите 2-4 конкретных безрецептурных препарата в формате:
        РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ:
        - [Название препарата] (категория)
        - [Название препарата] (категория)

        7. ВАЖНО: Даже если вы не уверены в диагнозе на 100%, вы ОБЯЗАНЫ перечислить конкретные возможные заболевания.

        Предоставьте медицинский анализ:
        """

        print(f"Отправляем данные на анализ в Gemini...")
        response = settings.text_model.generate_content(prompt_text)
        response_text = response.text if response and hasattr(response, 'text') else "Нет ответа от модели."
        cleaned_response = clean_output(response_text)

        diagnosis_predictions = extract_diagnosis_predictions(cleaned_response)
        recommended_medications = await extract_recommended_medications(cleaned_response)

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
