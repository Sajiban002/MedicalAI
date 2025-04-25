import React, { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { initializeModel } from './models'; // Импортируем функцию из нового файла
import '../style/news.css';

const MedNewsComponent = () => {
  const [newsData, setNewsData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeCategory, setActiveCategory] = useState('general');
  
  // Создаем ref для контейнера 3D модели
  const modelContainer = useRef(null);
  // Сохраняем результат инициализации модели
  const modelResources = useRef(null);

  const medCategories = [
    { id: 'general', name: 'Общие медицинские новости' },
    { id: 'flu', name: 'ОРВИ и грипп' },
    { id: 'health_tech', name: 'Медицинские технологии' },
    { id: 'research', name: 'Медицинские исследования' },
    { id: 'treatment', name: 'Методы лечения' }
  ];

  useEffect(() => {
    const fetchCategoryNews = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const apiUrl = `http://localhost:8000/api/news/?category=${activeCategory}`;
        console.log(`Fetching news from: ${apiUrl}`);
        
        const response = await fetch(apiUrl);
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(`Ошибка запроса: ${response.status} ${response.statusText} - ${errorData.detail || ''}`);
        }
        
        const data = await response.json();
        
        if (Array.isArray(data)) {
          setNewsData(data);
        } else {
          console.error('API вернул не массив:', data);
          setError('Получены некорректные данные с сервера');
        }
      } catch (err) {
        console.error('Ошибка при загрузке новостей:', err);
        setError(`Произошла ошибка при загрузке новостей: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchCategoryNews();
  }, [activeCategory]);

  // Инициализация 3D модели
  useEffect(() => {
    if (!modelContainer.current) return;

    // Инициализируем модель с помощью нашей новой функции
    modelResources.current = initializeModel(modelContainer.current);

    // Очистка при размонтировании
    return () => {
      if (modelResources.current) {
        modelResources.current.cleanup();
      }
    };
  }, []);

  const formatNewsDate = (dateString) => {
    try {
      const date = new Date(dateString);
      if (isNaN(date.getTime())) {
        return dateString;
      }
      return formatDistanceToNow(date, { addSuffix: true, locale: ru });
    } catch (e) {
      return dateString;
    }
  };

  const handleRetryFetch = () => {
    setError(null);
    setActiveCategory(activeCategory); // Trigger a refetch
  };

  return (
    <div className="medNewsContainer">
      <div className="medNewsHeader">
        <div className="medNewsTitleWrapper">
          <h1 className="medNewsMainTitle">Медицинские Новости</h1>
          <p className="medNewsSubtitle">Актуальная информация о здоровье и медицине</p>
        </div>
        {/* Восстанавливаем контейнер для 3D модели */}
        <div className="medNewsModelContainer" ref={modelContainer}></div>
      </div>

      <div className="medNewsCategorySection">
        <h2 className="medNewsCategoryTitle">Выберите категорию новостей:</h2>
        <div className="medNewsCategoryButtonGroup">
          {medCategories.map(category => (
            <button
              key={category.id}
              className={`medNewsCategoryBtn ${activeCategory === category.id ? 'medNewsCategoryBtnActive' : ''}`}
              onClick={() => setActiveCategory(category.id)}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      <div className="medNewsContentArea">
        {loading ? (
          <div className="medNewsLoadingContainer">
            <div className="medNewsSpinnerAnimation"></div>
            <p className="medNewsLoadingText">Загрузка новостей...</p>
          </div>
        ) : error ? (
          <div className="medNewsErrorBox">
            <p className="medNewsErrorMessage">{error}</p>
            <button className="medNewsRetryButton" onClick={handleRetryFetch}>Попробовать снова</button>
          </div>
        ) : (
          <>
            <h2 className="medNewsSectionHeading">{medCategories.find(cat => cat.id === activeCategory).name}</h2>
            <div className="medNewsArticleGrid">
              {Array.isArray(newsData) && newsData.length > 0 ? (
                newsData.map((item, index) => (
                  <div className="medNewsArticleCard" key={index}>
                    <div className="medNewsArticleImageWrapper">
                      <img src={item.image_url} alt={item.title} className="medNewsArticleImage" />
                      <span className="medNewsArticleSource">{item.source}</span>
                    </div>
                    <div className="medNewsArticleContent">
                      <h3 className="medNewsArticleTitle">
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="medNewsArticleLink">
                          {item.title}
                        </a>
                      </h3>
                      {item.summary && <p className="medNewsArticleSummary">{item.summary}</p>}
                      <div className="medNewsArticleFooter">
                        {item.time_published && (
                          <span className="medNewsArticleTimestamp">{formatNewsDate(item.time_published)}</span>
                        )}
                        <a href={item.url} target="_blank" rel="noopener noreferrer" className="medNewsReadMoreLink">
                          Читать далее
                        </a>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <p className="medNewsEmptyMessage">Нет доступных новостей в данной категории.</p>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default MedNewsComponent;