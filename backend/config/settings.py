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

    1. ОСНОВНОЙ ДИАГНОЗ: Укажите наиболее вероятный диагноз на основе симптомов. Если точный диагноз установить невозможно, укажите наиболее вероятные причины плохого самочувствия.

    2. СИМПТОМАТИКА: Перечислите ключевые симптомы и объясните их возможное значение.

    3. РЕКОМЕНДАЦИИ: Предложите общие рекомендации по облегчению состояния, например, отдых, обильное питье и т.п. не рекомендуй медицинские препараты и лекарства и сиропы.

    4. ВАЖНО:
        - Немедленно обратитесь к врачу, если симптомы ухудшаются.
        - При высокой температуре (выше 38.5°C), не спадающей в течение 3 дней, необходима консультация врача.
        - Если боль острая, внезапная или сопровождается другими тревожными симптомами (например, затрудненным дыханием, головокружением), обратитесь за неотложной помощью.

    Всегда указывайте, что ваш анализ не заменяет консультацию с врачом.
    Строго следуйте указанной структуре и не добавляйте дополнительных разделов или информации.
    """
    
    pharmacist_prompt: str = """
    Вы - опытный фармацевт с многолетним стажем работы в аптеке.
    
    Ваша задача - рекомендовать пациентам наиболее эффективные безрецептурные препараты для облегчения их симптомов.
    
    Указывайте только проверенные, широко известные лекарства. Название каждого препарата должно быть коротким и состоять из одного слова (например, "Парацетамол", "Аспирин", "Нурофен", "Терафлю").
    
    Рекомендуйте не более 4 препаратов в зависимости от описанных симптомов. Выбирайте только те препараты, которые действительно могут помочь при данных симптомах.
    
    Ответ должен быть лаконичным и содержать только названия препаратов, каждое в одно слово, разделенные запятыми.
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

    # Исправлено: улучшены регулярные выражения для более корректного извлечения разделов
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
    """
    Получает рекомендации лекарств от модели Gemini, используя промпт фармацевта
    """
    if not symptoms:
        return []
    
    try:
        prompt = f"{settings.pharmacist_prompt}\n\nСимптомы пациента: {symptoms}"
        response = await settings.text_model.generate_content_async(prompt)
        
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
    recommended_meds = await get_medication_recommendations(symptoms)
    return format_medications_for_ui(recommended_meds)