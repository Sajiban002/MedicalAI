# gemini_utils.py
import re
from typing import List, Dict
import asyncio

from config.settings import settings  # Импорт settings


def prepare_disease_context(symptoms: str, disease_data: list) -> str:
    context = ""
    if not disease_data:
        return "Данные о болезнях не найдены. Проверьте подключение к базе данных заболеваний."

    symptoms = symptoms or ""
    symptom_keywords = [word.lower() for word in re.findall(r'\b\w+\b', symptoms.lower())]

    relevant_diseases = []
    for disease in disease_data:
        definition = disease.get('definition', '') or ''
        name = disease.get('name', '') or ''

        definition_words = re.findall(r'\b\w+\b', definition.lower())
        name_words = re.findall(r'\b\w+\b', name.lower())

        symptom_matches = sum(1 for keyword in symptom_keywords if keyword in definition_words or keyword in name_words)

        if symptom_matches > 0:
            relevant_diseases.append({
                'disease': disease,
                'relevance': symptom_matches
            })

    relevant_diseases.sort(key=lambda x: x['relevance'], reverse=True)
    top_diseases = relevant_diseases[:5]

    for item in top_diseases:
        disease = item['disease']
        name = disease.get('name', 'Неизвестно') or 'Неизвестно'
        definition = disease.get('definition', 'Нет описания') or 'Нет описания'
        context += f"Болезнь: {name}. Описание: {definition}\n"

    if not context:
        context = "Точных совпадений с базой заболеваний не найдено. Проведу общий анализ симптомов."

    return context


def clean_output(text: str) -> str:
    if text is None:
        return (
            "ОСНОВНОЙ ДИАГНОЗ: Не удалось определить диагноз.\n\n"
            "СИМПТОМАТИКА: Недостаточно данных для анализа симптомов.\n\n"
            "РЕКОМЕНДАЦИИ: Обратитесь к врачу для уточнения диагноза.\n\n"
            "РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ: Нет данных для рекомендаций.\n\n"
            "ВАЖНО: Немедленно обратитесь к врачу, если симптомы ухудшаются.\n\n"
        )

    text = re.sub(r'\*\*', '', text)

    sections = {
        "ОСНОВНОЙ ДИАГНОЗ": re.search(r"ОСНОВНОЙ ДИАГНОЗ:\s*(.*?)(?=\n\n|$)", text, re.DOTALL),
        "СИМПТОМАТИКА": re.search(r"СИМПТОМАТИКА:\s*(.*?)(?=\n\n|$)", text, re.DOTALL),
        "РЕКОМЕНДАЦИИ": re.search(r"РЕКОМЕНДАЦИИ:\s*(.*?)(?=\n\n|$)", text, re.DOTALL),
        "РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ": re.search(r"РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ:\s*(.*?)(?=\n\n|$)", text, re.DOTALL),
        "ВАЖНО": re.search(r"ВАЖНО:\s*(.*?)(?=\n\n|$)", text, re.DOTALL)
    }

    formatted_text = ""

    if sections["ОСНОВНОЙ ДИАГНОЗ"]:
        formatted_text += f"ОСНОВНОЙ ДИАГНОЗ: {sections['ОСНОВНОЙ ДИАГНОЗ'].group(1).strip()}\n\n"
    else:
        formatted_text += "ОСНОВНОЙ ДИАГНОЗ: Не удалось определить точный диагноз на основе предоставленных данных.\n\n"

    if sections["СИМПТОМАТИКА"]:
        formatted_text += f"СИМПТОМАТИКА: {sections['СИМПТОМАТИКА'].group(1).strip()}\n\n"
    else:
        formatted_text += "СИМПТОМАТИКА: Недостаточно данных для анализа симптомов.\n\n"

    if sections["РЕКОМЕНДАЦИИ"]:
        formatted_text += f"РЕКОМЕНДАЦИИ: {sections['РЕКОМЕНДАЦИИ'].group(1).strip()}\n\n"
    else:
        formatted_text += "РЕКОМЕНДАЦИИ: Обратитесь к врачу для получения рекомендаций.\n\n"

    if sections["РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ"]:
        formatted_text += f"РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ: {sections['РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ'].group(1).strip()}\n\n"
    else:
        formatted_text += "РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ: Нет данных для рекомендаций.\n\n"

    if sections["ВАЖНО"]:
        formatted_text += f"ВАЖНО: {sections['ВАЖНО'].group(1).strip()}\n\n"
    else:
        formatted_text += "ВАЖНО: Немедленно обратитесь к врачу, если симптомы ухудшаются или сохраняются более 3 дней.\n\n"

    return formatted_text


async def get_medication_recommendations(symptoms: str) -> List[str]:  # Убрали text_model
    """
    Получает рекомендации лекарств от модели Gemini, используя промпт фармацевта
    """
    if not symptoms:
        return []

    try:
        prompt = f"{settings.pharmacist_prompt}\n\nСимптомы пациента: {symptoms}"
        response = await settings.text_model.generate_content_async(prompt) # Используем settings.text_model

        if not response or not response.text:
            return []

        medications = response.text.strip().split(',')
        medications = [med.strip() for med in medications if med.strip()]

        return medications[:4]
    except Exception as e:
        print(f"Ошибка при получении рекомендаций лекарств: {str(e)}")
        return []


def format_medications_for_ui(recommended_meds: List[str]) -> List[Dict]:
    ui_recommendations = []

    if recommended_meds:
        for med in recommended_meds:
            ui_recommendations.append({
                "title": med,
                "subtitle": "Рекомендуемый препарат",
                "description": "Симптоматическое лечение"
            })

    ui_recommendations.append({
        "title": "Перед применением любых лекарств проконсультируйтесь с врачом",
        "subtitle": "",
        "description": "",
        "warning": True
    })

    return ui_recommendations


async def get_recommended_medications(symptoms: str) -> List[Dict]:
    """
    Получает рекомендуемые лекарства и форматирует их для UI
    """
    recommended_meds = await get_medication_recommendations(symptoms)
    return format_medications_for_ui(recommended_meds)