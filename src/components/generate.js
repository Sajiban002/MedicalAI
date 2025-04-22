import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import { FaHeartbeat, FaStethoscope, FaUpload, FaTrash, FaCapsules, FaUserMd, FaExclamationTriangle, FaPrescriptionBottleAlt } from 'react-icons/fa';
import DiagnosisPieChart from './piechart';
import '../style/generate.css';

function Generate() {
  const [prompt, setPrompt] = useState('');
  const [generatedText, setGeneratedText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [useImage, setUseImage] = useState(false);
  const [diagnosisPredictions, setDiagnosisPredictions] = useState([]);
  const [recommendedMedications, setRecommendedMedications] = useState([]);
  const fileInputRef = useRef(null);
  const resultRef = useRef(null);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
      setUseImage(true);
    }
  };

  const removeImage = () => {
    setImage(null);
    setImagePreview(null);
    setUseImage(false);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setGeneratedText('');
    setDiagnosisPredictions([]);
    setRecommendedMedications([]);

    try {
      let response;

      if (useImage && image) {
        if (prompt.trim()) {
          const formData = new FormData();
          formData.append('file', image);
          formData.append('prompt', prompt);

          response = await axios.post('http://localhost:8000/generate-from-image-and-prompt', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        } else {
          const formData = new FormData();
          formData.append('file', image);
          formData.append('description', '');

          response = await axios.post('http://localhost:8000/analyze-image', formData, {
            headers: {
              'Content-Type': 'multipart/form-data'
            }
          });
        }
      } else {
        response = await axios.post('http://localhost:8000/generate', {
          prompt: prompt
        });
      }

      setGeneratedText(response.data.generated_text);
      
      if (response.data.diagnosis_predictions) {
        setDiagnosisPredictions(response.data.diagnosis_predictions);
      } else {
        const extractedDiagnoses = extractDiagnosesFromText(response.data.generated_text);
        setDiagnosisPredictions(extractedDiagnoses);
      }

      if (response.data.recommended_medications) {
        const limitedMedications = response.data.recommended_medications.slice(0, 4);
        setRecommendedMedications(limitedMedications);
      } else {
        const extractedMedications = extractMedicationsFromText(response.data.generated_text);
        const limitedExtractedMedications = extractedMedications.slice(0, 4);
        setRecommendedMedications(limitedExtractedMedications);
      }

      setTimeout(() => {
        if (resultRef.current) {
          resultRef.current.scrollIntoView({ behavior: 'smooth' });
        }
      }, 500);
    } catch (err) {
      setError(`Ошибка при анализе: ${err.response?.data?.detail || err.message}`);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const extractDiagnosesFromText = (text) => {
    if (!text) return [];
    
    const diagnosisPattern = /([А-Яа-я\s]+(?:\(?\d+%\)?|\s*-\s*\d+%))/g;
    const percentagePattern = /(\d+)%/;
    const namePattern = /(.+?)(?:\s*\(?\d+%\)?|\s*-\s*\d+%)/;

    const diagnosisMatches = text.match(diagnosisPattern) || [];
    
    const diagnoses = diagnosisMatches.map(match => {
      const percentMatch = match.match(percentagePattern);
      const nameMatch = match.match(namePattern);
      
      if (percentMatch && nameMatch) {
        return {
          name: nameMatch[1].trim(),
          probability: parseInt(percentMatch[1], 10)
        };
      }
      return null;
    }).filter(Boolean);
    
    if (diagnoses.length === 0) {
      const mainDiagnosisPart = text.match(/ОСНОВНОЙ ДИАГНОЗ:(.*?)(?=\n\n|$)/s);
      if (mainDiagnosisPart && mainDiagnosisPart[1]) {
        const mainDiagnosis = mainDiagnosisPart[1].trim();
        return [
          { name: mainDiagnosis, probability: 75 },
          { name: "Альтернативный диагноз", probability: 15 },
          { name: "Другие возможные причины", probability: 10 }
        ];
      }
    }
    
    return diagnoses;
  };

  const extractMedicationsFromText = (text) => {
    if (!text) return [];
    
    const recommendationsSection = text.match(/РЕКОМЕНДАЦИИ:(.*?)(?=\n\n|$)/s);
    if (recommendationsSection && recommendationsSection[1]) {
      const recommendations = recommendationsSection[1].trim();
      
      const medicationMention = recommendations.match(/(?:Безрецептурные препараты|Используйте лекарства|препараты|таблетки|капсулы|спрей|леденцы|пастилки|сироп):(.*?)(?=\n|$)/s);
      
      if (medicationMention && medicationMention[1]) {
        const medicationText = medicationMention[1].trim();
        const medicationItems = medicationText.split(/[,;]/).map(item => item.trim()).filter(Boolean);
        
        if (medicationItems.length > 0) {
          const limitedItems = medicationItems.slice(0, 4);
          return limitedItems.map(med => ({
            name: med,
            category: 'Симптоматическое лечение'
          }));
        }
      }
    }
    
    if (text.includes('парацетамол') || text.includes('ибупрофен')) {
      return [
        { name: 'Парацетамол', category: 'Жаропонижающее' },
        { name: 'Ибупрофен', category: 'Противовоспалительное' }
      ].slice(0, 4);
    }
    
    if (text.toLowerCase().includes('боль в горле')) {
      return [
        { name: 'Леденцы для горла', category: 'Местное обезболивающее' },
        { name: 'Спрей для горла с обезболивающим', category: 'Местное обезболивающее' }
      ].slice(0, 4);
    }
    
    return [];
  };

  const formatResults = (text) => {
    if (!text) return [];

    const mainDiagnosisPart = text.match(/ОСНОВНОЙ ДИАГНОЗ:(.*?)(?=\n\n|$)/s);
    const symptomsPart = text.match(/СИМПТОМАТИКА:(.*?)(?=\n\n|$)/s);
    const recommendationsPart = text.match(/РЕКОМЕНДАЦИИ:(.*?)(?=\n\n|$)/s);
    const importantPart = text.match(/ВАЖНО:(.*?)(?=\n\n|$)/s);

    const sections = [];

    if (mainDiagnosisPart && mainDiagnosisPart[1]) {
      let content = mainDiagnosisPart[1].trim().split('\n');
      content = content.map(item => item.replace(/^\s*\*\s+/gm, '- '));

      sections.push({
        title: 'ОСНОВНОЙ ДИАГНОЗ',
        content: content,
        special: 'main-diagnosis'
      });
    }

    if (symptomsPart && symptomsPart[1]) {
      let content = symptomsPart[1].trim().split('\n');
      content = content.map(item => item.replace(/^\s*\*\s+/gm, '- '));

      sections.push({
        title: 'СИМПТОМАТИКА',
        content: content
      });
    }

    if (recommendationsPart && recommendationsPart[1]) {
      let content = recommendationsPart[1].trim().split('\n');
      content = content.map(item => item.replace(/^\s*\*\s+/gm, '- '));

      sections.push({
        title: 'РЕКОМЕНДАЦИИ',
        content: content
      });
    }

    if (importantPart && importantPart[1]) {
      let content = importantPart[1].trim().split('\n');
      content = content.map(item => item.replace(/^\s*\*\s+/gm, '- '));

      sections.push({
        title: 'ВАЖНО',
        content: content,
        special: 'warning'
      });
    }

    if (sections.length === 0) {
      let content = text.split('\n').filter(line => line.trim() !== '');
      content = content.map(item => item.replace(/^\s*\*\s+/gm, '- '));

      return [{ title: 'Результат анализа', content: content }];
    }

    return sections;
  };

  const MedicationsSection = ({ medications }) => {
    if (!medications || medications.length === 0) {
      return null;
    }
    
    return (
      <div className="medications-container">
        <h3 className="chart-title">
          <FaPrescriptionBottleAlt className="medications-icon" />
          Рекомендуемые медикаменты
        </h3>
        <div className="medications-list">
          {medications.map((med, index) => (
            <div key={index} className="medication-item">
              <div className="medication-icon-container">
                <FaCapsules className="medication-pill-icon" />
              </div>
              <div className="medication-info">
                <span className="medication-name">{med.name.replace(/^\*\s*/, '')}</span>
                {med.category && <span className="medication-category">{med.category}</span>}
              </div>
            </div>
          ))}
        </div>
        <div className="medication-disclaimer">
          <FaExclamationTriangle className="medication-disclaimer-icon" />
          <span>Перед применением любых лекарств проконсультируйтесь с врачом</span>
        </div>
      </div>
    );
  };

  return (
    <main className="medical-main">
      <motion.section
        className="form-section"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
      >
        <div className="section-header">
          <FaStethoscope className="section-icon" />
          <h2>Описание симптомов</h2>
        </div>

        <form onSubmit={handleSubmit} className="medical-form">
          <div className="input-group">
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Опишите симптомы пациента подробно (например: температура 38°C, сухой кашель, затрудненное дыхание, снижение аппетита...)"
              className="medical-textarea"
              rows={4}
            />
          </div>

          <div className="image-upload-section">
            <div className="section-header small">
              <FaUpload className="section-icon small" />
              <h3>Загрузить медицинское изображение</h3>
            </div>

            <div className="upload-controls">
              <label className="upload-button">
                <input
                  type="file"
                  onChange={handleImageChange}
                  ref={fileInputRef}
                  accept="image/*"
                  className="file-input"
                />
                <span className="button-text">Выбрать изображение</span>
              </label>

              {imagePreview && (
                <button
                  type="button"
                  onClick={removeImage}
                  className="remove-button"
                >
                  <FaTrash /> Удалить
                </button>
              )}
            </div>

            <AnimatePresence>
              {imagePreview && (
                <motion.div
                  className="image-preview-container"
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.3 }}
                >
                  <img
                    src={imagePreview}
                    alt="Медицинское изображение"
                    className="preview-image"
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <motion.button
            type="submit"
            className="medical-button"
            disabled={loading || (!prompt.trim() && !imagePreview)}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            {loading ? (
              <>
                <div className="spinner"></div>
                <span>Анализ...</span>
              </>
            ) : (
              <>
                <FaUserMd />
                <span>Провести анализ</span>
              </>
            )}
          </motion.button>
        </form>
      </motion.section>

      <AnimatePresence>
        {error && (
          <motion.div
            className="error-message"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.3 }}
          >
            <div className="error-icon">!</div>
            <p>{error}</p>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {loading && (
          <motion.div
            className="loading-container"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            <div className="medical-loader">
              <div className="loading-icon"></div>
              <p className="loading-text">Анализ данных пациента...</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {generatedText && (
          <motion.section
            className="results-section"
            ref={resultRef}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <div className="section-header">
              <FaHeartbeat className="section-icon pulse" />
              <h2>Результаты анализа</h2>
            </div>

            <div className="medical-card result-card">
              <div className="results-layout">
                <div className="medical-report">
                  {formatResults(generatedText).map((section, index) => (
                    <div key={index} className={`report-section ${section.special ? section.special : ''}`}>
                      <h3 className="report-section-title">
                        {section.special === 'warning' && <FaExclamationTriangle className="warning-icon" />}
                        {section.title}
                      </h3>
                      <div className="report-content">
                        {section.content.map((para, i) => (
                          <p key={i}>{para}</p>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="chart-section">
                  {diagnosisPredictions.length > 0 && (
                    <DiagnosisPieChart diagnoses={diagnosisPredictions} />
                  )}
                  
                  {recommendedMedications.length > 0 && (
                    <MedicationsSection medications={recommendedMedications} />
                  )}
                </div>
              </div>

              <div className="disclaimer">
                <FaCapsules className="disclaimer-icon" />
                <p>Данная информация предоставляется исключительно в ознакомительных целях и не заменяет консультацию квалифицированного медицинского специалиста. Точность анализа не гарантирована.</p>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>
    </main>
  );
}

export default Generate;