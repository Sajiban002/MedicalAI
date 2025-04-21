# endpoints.py
from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from fastapi.responses import JSONResponse
from models.schemas import PromptRequest
from utils import vision_utils, gemini_utils
from config.settings import settings, clean_output, prepare_disease_context
import re

api_router = APIRouter()


def extract_short_diagnosis(text):
    words = text.split()
    if len(words) > 3:
        return ' '.join(words[:3])
    return text


def extract_diagnosis_predictions(text):
    try:
        diagnosis_pattern = r"(\d+)%\s*-\s*([А-Яа-я\s\w]+)"
        matches = re.findall(diagnosis_pattern, text)

        if matches:
            diagnoses = [{"probability": int(prob), "name": name.strip()} for prob, name in matches]
            return diagnoses

        main_diagnosis_section = re.search(r"ОСНОВНОЙ ДИАГНОЗ:\s*(.*?)(?=\n\n|$)", text, re.DOTALL)
        if main_diagnosis_section:
            main_diagnosis = main_diagnosis_section.group(1).strip()
            main_disease = extract_short_diagnosis(main_diagnosis.split('\n')[0] if '\n' in main_diagnosis else main_diagnosis)

            diagnoses = [
                {"probability": 75, "name": main_disease},
                {"probability": 15, "name": "Альтернативный диагноз"},
                {"probability": 10, "name": "Другие возможные причины"}
            ]
            return diagnoses

        return []
    except Exception as e:
        print(f"Ошибка при извлечении диагнозов: {str(e)}")
        return []


async def extract_recommended_medications(text, symptoms=None):
    try:
        # Попробуем сначала получить препараты через функцию из gemini_utils
        if symptoms:
            from utils.gemini_utils import get_medication_recommendations
            medications = await get_medication_recommendations(symptoms) # Убрали settings.text_model
            if medications:
                return [{"name": med, "category": "Симптоматическое лечение"} for med in medications]

        # Если не получилось, извлекаем из текста
        medications = []
        medication_pattern = r'\*([А-Яа-я\s]+)\*|(?:препарат[ыа]?|лекарств[ао]?|капли|спрей|леденцы|пастилки):\s*([А-Яа-я\s,]+)'
        direct_matches = re.finditer(medication_pattern, text, re.IGNORECASE)

        for match in direct_matches:
            medication_text = match.group(1) if match.group(1) else match.group(2)
            if medication_text:
                med_items = [item.strip() for item in re.split(r'[,;]', medication_text) if item.strip()]
                for med in med_items:
                    med_parts = re.match(r'(.*?)(?:\s*\((.*?)\))?$', med)
                    if med_parts:
                        name = med_parts.group(1).strip()
                        category = med_parts.group(2).strip() if med_parts.group(2) else "Симптоматическое лечение"
                        if name and name not in [m["name"] for m in medications]:
                            medications.append({"name": name, "category": category})

        # Если нет лекарств, проверим секцию рекомендаций
        if not medications:
            recommendations_section = re.search(r"РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ:\s*(.*?)(?=\n\n|$)", text, re.DOTALL)
            if recommendations_section:
                recs_text = recommendations_section.group(1).strip()
                specific_meds = {"Стрепсилс": "Леденцы для горла",
                                "Тантум Верде": "Спрей для горла",
                                "Лазолван": "Сироп от кашля",
                                "Називин": "Капли от насморка",
                                "Зодак": "Антигистаминное",
                                "Парацетамол": "Жаропонижающее",
                                "Ибупрофен": "Противовоспалительное"}

                for med_name, category in specific_meds.items():
                    if med_name.lower() in recs_text.lower() and med_name not in [m["name"] for m in medications]:
                        medications.append({"name": med_name, "category": category})

        # Если нет лекарств и есть симптомы, подберем стандартные
        if not medications and symptoms:
            lower_symptoms = symptoms.lower()
            symptom_to_med = {
                "боль в горле": [{"name": "Стрепсилс", "category": "Леденцы для горла"},
                               {"name": "Тантум Верде", "category": "Спрей для горла"}],
                "кашель": [{"name": "Лазолван", "category": "Сироп от кашля"}],
                "температура": [{"name": "Парацетамол", "category": "Жаропонижающее"}],
                "головная боль": [{"name": "Ибупрофен", "category": "Противовоспалительное"}],
                "насморк": [{"name": "Називин", "category": "Капли от насморка"}],
                "аллергия": [{"name": "Зодак", "category": "Антигистаминное"}]
            }

            for symptom, meds in symptom_to_med.items():
                if symptom in lower_symptoms:
                    for med in meds:
                        if med["name"] not in [m["name"] for m in medications]:
                            medications.append(med)

        # Если всё ещё нет лекарств, проверим ключевые слова в тексте
        if not medications:
            if "ангина" in text.lower() or "фарингит" in text.lower() or "тонзиллит" in text.lower():
                medications = [
                    {"name": "Стрепсилс", "category": "Леденцы для горла"},
                    {"name": "Тантум Верде", "category": "Спрей для горла"}
                ]
            elif "грипп" in text.lower() or "простуда" in text.lower() or "орви" in text.lower():
                medications = [
                    {"name": "Парацетамол", "category": "Жаропонижающее"},
                    {"name": "Називин", "category": "Капли от насморка"}
                ]

        # Ограничиваем до 4 уникальных лекарств
        unique_meds = []
        seen_names = set()
        for med in medications:
            if med["name"] not in seen_names:
                seen_names.add(med["name"])
                unique_meds.append(med)
                if len(unique_meds) >= 4:
                    break

        return unique_meds[:4]
    except Exception as e:
        print(f"Ошибка при извлечении рекомендуемых медикаментов: {str(e)}")
        return []


def prepare_medications_context(symptoms):
    if not symptoms:
        return ""

    medications_context = "Рекомендуемые безрецептурные препараты для указанных симптомов:\n"

    # Ищем препараты на основе симптомов
    lower_symptoms = symptoms.lower()
    symptom_to_med = {
        "боль в горле": ["Стрепсилс", "Тантум Верде"],
        "кашель": ["Лазолван"],
        "температура": ["Парацетамол"],
        "головная боль": ["Ибупрофен"],
        "насморк": ["Називин"],
        "аллергия": ["Зодак"]
    }

    added_meds = []
    for symptom, meds in symptom_to_med.items():
        if symptom in lower_symptoms:
            for med in meds:
                if med not in added_meds and len(added_meds) < 4:
                    added_meds.append(med)
                    medications_context += f"- {med}\n"

    if not added_meds:
        return ""

    return medications_context


@api_router.post("/generate")
async def generate_text(request: PromptRequest):
    try:
        print(f"Получен запрос на генерацию текста с промптом: {request.prompt}")
        prompt = request.prompt or "Общая консультация"
        disease_context = prepare_disease_context(prompt, settings.disease_data)
        medications_context = prepare_medications_context(prompt)

        full_prompt = f"""
        {settings.medical_system_prompt}

        Данные о болезнях:
        {disease_context}

        {medications_context}

        Симптомы: {prompt}

        Важно:
        1. Предоставьте список возможных диагнозов с их вероятностями в процентах (в сумме 100%).
        Формат:
        ПРОГНОЗ ЗАБОЛЕВАНИЙ:
        XX% - [Название болезни]
        YY% - [Название болезни]
        ZZ% - [Название болезни]
        и т.д. вероятность сколько болезней неограниченно но если вы уверенны что это 1 заболевание на 100% то укажите только его.

        2. В разделе ОСНОВНОЙ ДИАГНОЗ укажите только короткое название болезни, без дополнительных объяснений.
        3. В разделе РЕКОМЕНДАЦИИ обязательно укажите не более 4 конкретных безрецептурных препарата, если это уместно.

        Предоставьте анализ:
        """

        print(f"Отправляем запрос к Gemini...")
        response = settings.text_model.generate_content(full_prompt)
        response_text = response.text if response and hasattr(response, 'text') else "Нет ответа от модели."
        cleaned_response = clean_output(response_text)

        diagnosis_predictions = extract_diagnosis_predictions(cleaned_response)
        recommended_medications = await extract_recommended_medications(cleaned_response, prompt)

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
        medications_context = prepare_medications_context(combined_description)

        prompt_text = f"""
        {settings.medical_system_prompt}

        {"ВНИМАНИЕ: Это изображение имеет высокую медицинскую релевантность." if medical_relevance == "high" else ""}
        {"ВАЖНО: Это изображение может иметь отношение к медицинской тематике." if medical_relevance == "medium" else ""}

        Данные о болезнях:
        {disease_context}

        {medications_context}

        Медицинская релевантность изображения: {medical_relevance_ru.upper()}

        Симптомы и анализ изображения: {combined_description}

        Важно:
        1. Предоставьте список возможных диагнозов с их вероятностями в процентах (в сумме 100%).
        Формат:
        ПРОГНОЗ ЗАБОЛЕВАНИЙ:
        XX% - [Название болезни]
        YY% - [Название болезни]
        ZZ% - [Название болезни]
        и т.д.

        2. В разделе ОСНОВНОЙ ДИАГНОЗ укажите только короткое название болезни, без дополнительных объяснений.
        3. В разделе РЕКОМЕНДАЦИИ обязательно укажите не более 4 конкретных безрецептурных препарата, если это уместно.

        Предоставьте медицинский анализ:
        """

        print(f"Отправляем данные на анализ в Gemini...")
        response = settings.text_model.generate_content(prompt_text)
        response_text = response.text if response and hasattr(response, 'text') else "Нет ответа от модели."
        cleaned_response = clean_output(response_text)

        diagnosis_predictions = extract_diagnosis_predictions(cleaned_response)
        recommended_medications = await extract_recommended_medications(cleaned_response, combined_description)

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
        medications_context = prepare_medications_context(combined_info)

        prompt_text = f"""
        {settings.medical_system_prompt}

        {"ВНИМАНИЕ: Это изображение имеет высокую медицинскую релевантность." if medical_relevance == "high" else ""}
        {"ВАЖНО: Это изображение может иметь отношение к медицинской тематике." if medical_relevance == "medium" else ""}

        Данные о болезнях:
        {disease_context}

        {medications_context}

        Медицинская релевантность изображения: {medical_relevance_ru.upper()}

        Симптомы из запроса: {combined_prompt}

        Анализ изображения: {vision_description}

        Важно:
        1. Предоставьте список возможных диагнозов с их вероятностями в процентах (в сумме 100%).
        Формат:
        ПРОГНОЗ ЗАБОЛЕВАНИЙ:
        XX% - [Название болезни]
        YY% - [Название болезни]
        ZZ% - [Название болезни]
        и т.д.

        2. В разделе ОСНОВНОЙ ДИАГНОЗ укажите только короткое название болезни, без дополнительных объяснений.
        3. В разделе РЕКОМЕНДАЦИИ обязательно укажите не более 4 конкретных безрецептурных препарата, если это уместно.

        Предоставьте медицинский анализ:
        """

        print(f"Отправляем данные на анализ в Gemini...")
        response = settings.text_model.generate_content(prompt_text)
        response_text = response.text if response and hasattr(response, 'text') else "Нет ответа от модели."
        cleaned_response = clean_output(response_text)

        diagnosis_predictions = extract_diagnosis_predictions(cleaned_response)
        recommended_medications = await extract_recommended_medications(cleaned_response, combined_info)

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