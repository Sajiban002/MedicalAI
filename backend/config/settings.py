# settings.py
import os
from dotenv import load_dotenv
import google.generativeai as genai
from fastapi import HTTPException
import json
from functools import lru_cache
import re
from typing import List, Dict

load_dotenv()

first_aid_instructions = {
    "высокая температура": [
        "Оставайтесь в прохладном помещении.",
        "Приложите холодный компресс ко лбу.",
        "Пейте много жидкости, чтобы избежать обезвоживания."
    ],
    "удар током": [
        "Не прикасайтесь к пострадавшему, если он все еще контактирует с источником тока.",
        "Отключите источник тока, если это безопасно.",
        "Вызовите скорую помощь.",
        "Осмотрите пострадавшего на предмет ожогов и других травм.",
    ],
    "потеря сознания": [
        "Убедитесь, что пострадавший дышит.",
        "Если пострадавший не дышит, начните сердечно-легочную реанимацию.",
        "Вызовите скорую помощь.",
        "Положите пострадавшего на бок в устойчивое положение, если он дышит.",
    ],
    "кровотечение": [
        "Наложите давящую повязку на рану.",
        "Поднимите поврежденную конечность выше уровня сердца.",
        "Вызовите скорую помощь, если кровотечение сильное или не останавливается.",
    ],
    "ожог": [
        "Охлаждайте место ожога прохладной водой в течение 10-20 минут.",
        "Накройте ожог стерильной повязкой.",
        "Не наносите мази или кремы на ожог.",
        "Обратитесь к врачу, если ожог серьезный.",
    ]
}

class Settings:
    gemini_api_key: str = os.getenv("GEMINI_API_KEY")
    medical_system_prompt: str = """
    Вы - профессиональный медицинский консультант.
    Ваша задача - анализировать симптомы и предлагать возможные объяснения.

    В своем ответе обязательно следуйте следующей структуре и включите все разделы:

    1. ОСНОВНОЙ ДИАГНОЗ: Укажите наиболее вероятный диагноз на основе симптомов. Если точный диагноз установить невозможно, укажите наиболее вероятные причины плохого самочувствия. ПИШИ ТОЛЬКО В ЭТОМ РАЗДЕЛЕ 1 СЛОВО И ЭТО САМЫЙ БЛИЗКИЙ ДИАГНОЗ ПО ТВОЕМУ МНЕНИЮ

    2. СИМПТОМАТИКА: Перечислите ключевые симптомы и объясните их возможное значение.

    3. РЕКОМЕНДАЦИИ: Предложите общие рекомендации по облегчению состояния, например, отдых, обильное питье и т.п. не рекомендуй медицинские препараты и лекарства и сиропы.

    4. ВАЖНО: В этом разделе укажите ИНДИВИДУАЛЬНЫЕ предупреждения, основанные на конкретных симптомах пациента и вероятном диагнозе. Не используйте общие шаблонные фразы. Вместо этого:
    - Укажите 2-3 конкретных тревожных признака, при которых нужно срочно обратиться к врачу, исходя из симптомов
    - Укажите временные рамки, в течение которых требуется медицинская помощь при отсутствии улучшений
    - Опишите конкретные случаи, когда следует вызвать скорую помощь
    - Адаптируйте рекомендации к возрасту пациента и особенностям состояния

    Примеры для раздела ВАЖНО:
    - Для простуды: "Обратитесь к врачу, если температура поднимется выше 39°C, появится сильная головная боль или затруднение дыхания. Детям до 3 лет необходимо показаться врачу в течение 24 часов от начала симптомов."
    - Для головной боли: "Немедленно вызовите скорую, если головная боль сопровождается потерей сознания, нарушением зрения или речи. При наличии регулярных мигреней запишитесь к неврологу для подбора постоянной терапии."
    - Для боли в животе: "Срочно обратитесь в больницу, если боль резко усилилась, появилась рвота с кровью или черный стул. При постоянной тупой боли в правом боку необходимо УЗИ брюшной полости."

    Всегда указывайте, что ваш анализ не заменяет консультацию с врачом.
    Строго следуйте указанной структуре и не добавляйте дополнительных разделов или информации.


    Вы - опытный фармацевт с многолетним стажем работы.
    
    ВАЖНЫЕ ИНСТРУКЦИИ:
    
    1. Вам нужно рекомендовать ТОЛЬКО лекарственные препараты для облегчения указанных симптомов.
    
    2. Формат ответа: препарат1, препарат2, препарат3, препарат4
       - Только названия препаратов, разделенные запятыми
       - БЕЗ дополнительного текста
       - БЕЗ точек в конце
       - БЕЗ разъяснений
       - БЕЗ приветствий или заключений
    
    3. Ограничения:
       - Максимум 4 препарата
       - Каждое название должно быть односложным (например: "Парацетамол", "Аспирин", "Нурофен")
       - Рекомендуйте только безрецептурные препараты
    
    4. Если симптомы неясны или недостаточны:
       - При минимальных симптомах рекомендуйте базовые препараты
       - При полном отсутствии медицинского запроса НЕ ОТВЕЧАЙТЕ ВООБЩЕ
       - При непонятном запросе отвечайте только: "Недостаточно информации"
    
    5. Если получите нерелевантный запрос (вопрос о вас, случайный текст и т.д.):
       - НЕ ОТВЕЧАЙТЕ вообще (оставьте поле ответа пустым)
    
    6. Примеры корректных ответов:
       - "Парацетамол, Ибупрофен, Аспирин, Цетрин"
       - "Супрастин, Нурофен"
       - "Недостаточно информации"
       - "" (пустой ответ при нерелевантном запросе)
    
    Всегда давайте минимум 1 препарат если запрос связан со здоровьем, даже если симптомы описаны минимально. Если симптомы тяжелые по типу простого перелома, то просто пиши коротко то что медикаментов нету и лучше обратиться врачу только очень коротко
    """
    
    
    disease_data: list = []
    medical_keywords: list = []
    google_credentials_path: str = os.path.join(os.path.dirname(__file__), "..", "key", "google_credentials.json")

    def __init__(self):
        self.load_disease_data()
        self.load_medical_keywords()
        print("Используем встроенные знания о препаратах.")
        self.load_gemini()

    @lru_cache()
    def load_gemini(self):
        if not self.gemini_api_key:
            print("ОШИБКА: Ключ API Gemini не найден!")
            raise HTTPException(status_code=500, detail="No GEMINI_API_KEY found")

        try:
            genai.configure(api_key=self.gemini_api_key)
            self.text_model = genai.GenerativeModel('gemini-2.0-flash')
            self.vision_model = genai.GenerativeModel('gemini-2.0-pro-vision')
            print("Модели Gemini успешно настроены.")
        except Exception as e:
            print(f"ОШИБКА при настройке моделей Gemini: {str(e)}")
            raise HTTPException(status_code=500, detail=f"Failed to configure Gemini: {str(e)}")
    
    @lru_cache()
    def load_disease_data(self):
        possible_disease_paths = [
            os.path.join("backend", "data", "disease_data.json"),
            os.path.join("data", "disease_data.json"),
            os.path.join("..", "data", "disease_data.json"),
            os.path.join(os.path.dirname(__file__), "..", "data", "disease_data.json")
        ]

        for path in possible_disease_paths:
            try:
                print(f"Пытаемся загрузить данные о заболеваниях из: {path}")
                with open(path, "r", encoding="utf-8") as f:
                    self.disease_data = json.load(f)
                disease_count = len(self.disease_data)
                print(f"Данные о заболеваниях успешно загружены. Найдено {disease_count} заболеваний.")
                break
            except FileNotFoundError:
                print(f"Файл не найден по пути: {path}")
                continue
            except json.JSONDecodeError:
                print(f"Некорректный JSON в файле: {path}")
                continue

    def load_medical_keywords(self):
        self.medical_keywords = []

settings = Settings()

def prepare_disease_context(symptoms, disease_data):
    if not symptoms or not disease_data:
        return ""
    
    diseases_to_include = []
    symptoms_lower = symptoms.lower()
    
    common_disease_names = {
        "грипп": ["грипп", "flu", "influenza"], 
        "орви": ["орви", "простуда", "cold"],
        "пневмония": ["пневмония", "воспаление легких", "pneumonia"],
        "бронхит": ["бронхит", "bronchitis"],
        "фарингит": ["фарингит", "pharyngitis"],
        "тонзиллит": ["тонзиллит", "ангина", "tonsillitis"],
        "лихорадка понтиак": ["понтиак", "pontiac"],
        "легионеллез": ["легионеллез", "легионелла", "legionella", "legionnaires"],
        "covid": ["ковид", "covid"]
    }
    
    disease_translations = {
        "pontiac fever": "Лихорадка Понтиак",
        "legionnaires": "Болезнь легионеров",
        "pneumonia": "Пневмония",
        "bronchitis": "Бронхит",
        "influenza": "Грипп",
        "common cold": "Простуда",
        "sinusitis": "Синусит",
        "pharyngitis": "Фарингит",
        "tonsillitis": "Тонзиллит",
        "covid": "COVID-19"
    }
    
    for disease_key, aliases in common_disease_names.items():
        for alias in aliases:
            if alias in symptoms_lower:
                if disease_key in disease_data:
                    diseases_to_include.append(disease_key)
                break
    
    if not diseases_to_include:
        symptom_to_disease = {
            "горло": ["фарингит", "тонзиллит", "орви"],
            "температура": ["грипп", "орви", "пневмония", "лихорадка понтиак"],
            "кашель": ["бронхит", "пневмония", "орви"],
            "насморк": ["орви", "грипп"],
            "головная боль": ["грипп", "орви", "лихорадка понтиак"],
            "мышечная боль": ["грипп", "лихорадка понтиак"],
            "слабость": ["грипп", "орви", "пневмония"]
        }
        
        for symptom, diseases in symptom_to_disease.items():
            if symptom in symptoms_lower:
                for disease in diseases:
                    if disease in disease_data and disease not in diseases_to_include:
                        diseases_to_include.append(disease)
    
    diseases_to_include = diseases_to_include[:4]
    
    if not diseases_to_include:
        if "орви" in disease_data:
            diseases_to_include.append("орви")
        if "грипп" in disease_data:
            diseases_to_include.append("грипп")
    
    disease_context = ""
    for disease in diseases_to_include:
        if disease in disease_data:
            disease_name = disease_data[disease].get("name", disease)
            for eng_name, rus_name in disease_translations.items():
                if eng_name.lower() == disease_name.lower():
                    disease_name = rus_name
                    break
            
            disease_context += f"\n### {disease_name}\n"
            disease_context += f"Симптомы: {disease_data[disease].get('symptoms', 'Нет данных')}\n"
            disease_context += f"Описание: {disease_data[disease].get('description', 'Нет данных')}\n"
    
    return disease_context

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
        "ОСНОВНОЙ ДИАГНОЗ": re.search(r"ОСНОВНОЙ ДИАГНОЗ:[\s]*(.*?)(?=\n*(?:СИМПТОМАТИКА:|РЕКОМЕНДАЦИИ:|РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ:|ВАЖНО:|$))", text, re.DOTALL),
        "СИМПТОМАТИКА": re.search(r"СИМПТОМАТИКА:[\s]*(.*?)(?=\n*(?:ОСНОВНОЙ ДИАГНОЗ:|РЕКОМЕНДАЦИИ:|РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ:|ВАЖНО:|$))", text, re.DOTALL),
        "РЕКОМЕНДАЦИИ": re.search(r"РЕКОМЕНДАЦИИ:[\s]*(.*?)(?=\n*(?:ОСНОВНОЙ ДИАГНОЗ:|СИМПТОМАТИКА:|РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ:|ВАЖНО:|$))", text, re.DOTALL),
        "РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ": re.search(r"РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ:[\s]*(.*?)(?=\n*(?:ОСНОВНОЙ ДИАГНОЗ:|СИМПТОМАТИКА:|РЕКОМЕНДАЦИИ:|ВАЖНО:|$))", text, re.DOTALL),
        "ВАЖНО": re.search(r"ВАЖНО:[\s]*(.*?)(?=\n*(?:ОСНОВНОЙ ДИАГНОЗ:|СИМПТОМАТИКА:|РЕКОМЕНДАЦИИ:|РЕКОМЕНДУЕМЫЕ ПРЕПАРАТЫ:|$))", text, re.DOTALL)
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

async def get_medication_recommendations(symptoms: str) -> List[str]:
    if not symptoms or not symptoms.strip():
        return []
    
    irrelevant_patterns = [
        r'\bкто ты\b', r'\bчто ты\b', r'\bкак тебя зовут\b', 
        r'\bпривет\b', r'\bздравствуй\b', r'\bрасскажи о себе\b',
        r'\bпомоги мне\b', r'\bкак дела\b'
    ]
    
    if any(re.search(pattern, symptoms.lower()) for pattern in irrelevant_patterns):
        return []
    
    try:
        prompt = f"{settings.pharmacist_prompt}\n\nСимптомы пациента: {symptoms}"
        response = await settings.text_model.generate_content_async(prompt)
        
        if not response or not response.text:
            return []
        
        response_text = response.text.strip()
        
        if response_text == "Недостаточно информации":
            return ["Недостаточно информации"]
        
        response_text = re.sub(r'[.]$', '', response_text)
        
        medications = [med.strip() for med in response_text.split(',') if med.strip()]
        
        if not medications and any(health_term in symptoms.lower() for health_term in ["болит", "боль", "температура", "простуда", "голова", "горло"]):
            return ["Парацетамол"]
            
        return medications[:4]  
    except Exception as e:
        print(f"Ошибка при получении рекомендаций лекарств: {str(e)}")
        return []

def format_medications_for_ui(recommended_meds: List[str]) -> List[Dict]:
    ui_recommendations = []
    
    if recommended_meds:
        if len(recommended_meds) == 1 and recommended_meds[0] == "Недостаточно информации":
            ui_recommendations.append({
                "title": "Недостаточно информации о симптомах",
                "subtitle": "Пожалуйста, опишите симптомы подробнее",
                "description": "",
                "warning": True
            })
        else:
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
    recommended_meds = await get_medication_recommendations(symptoms)
    return format_medications_for_ui(recommended_meds)