// diagnosisHistoryController.js
const ApiError = require('../error/ApiError');
const { DiagnosisHistory, User } = require('../models/model');
const { Op } = require('sequelize');
const sequelize = require('../db');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

class DiagnosisHistoryController {
  // Метод для сохранения истории диагноза
  async saveDiagnosis(req, res, next) {
    try {
      const { symptoms, diagnosis_id, diagnosis_data } = req.body;
      
      if (!symptoms || !diagnosis_data) {
        return next(ApiError.badRequest('Не предоставлены необходимые данные для сохранения'));
      }
      
      // Создаем запись в истории
      const diagnosisEntry = {
        diagnosis_id: diagnosis_id || uuidv4(), // Используем переданный ID или генерируем новый
        symptoms,
        diagnosis_data,
      };
      
      // Путь для JSON файла, если применимо
      let file_path = null;
      
      // Если пользователь авторизован, прикрепляем к его аккаунту
      if (req.user) {
        const user = await User.findByPk(req.user.id);
        if (!user) {
          return next(ApiError.notFound('Пользователь не найден'));
        }
        
        // Проверка включенного хранения истории
        if (!user.ai_history_enabled) {
          // Если сохранение истории отключено пользователем, возвращаем сообщение
          return res.json({ 
            success: false, 
            message: 'История диагнозов отключена в настройках' 
          });
        }
        
        diagnosisEntry.user_id = user.id;
        
        // Формируем путь к файлу для привязки к пользователю
        file_path = path.join('data', 'diagnoses', String(user.id), `${diagnosisEntry.diagnosis_id}.json`);
      } else {
        // Для анонимных пользователей сохраняем с null user_id
        diagnosisEntry.user_id = null;
        
        // Формируем путь для анонимных диагнозов
        file_path = path.join('data', 'diagnoses', 'anonymous', `${diagnosisEntry.diagnosis_id}.json`);
      }
      
      // Сохраняем путь к файлу в базе данных для дальнейшего доступа
      diagnosisEntry.file_path = file_path;
      
      // Создаем директорию, если она не существует
      const dirPath = path.dirname(path.join(__dirname, '..', '..', file_path));
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
      
      // Сохраняем JSON файл на диск
      fs.writeFileSync(
        path.join(__dirname, '..', '..', file_path),
        JSON.stringify(diagnosis_data),
        'utf8'
      );
      
      const history = await DiagnosisHistory.create(diagnosisEntry);
      
      return res.json({ 
        success: true, 
        message: 'История диагноза сохранена', 
        diagnosis_id: history.diagnosis_id 
      });
    } catch (err) {
      console.error('Ошибка при сохранении истории диагноза:', err);
      next(ApiError.internal('Ошибка при сохранении истории диагноза'));
    }
  }
  
  // Получение истории диагнозов пользователя
  async getUserHistory(req, res, next) {
    try {
      const { limit = 10, offset = 0 } = req.query;
      
      // Пагинация для большого количества результатов
      const history = await DiagnosisHistory.findAndCountAll({
        where: { user_id: req.user.id },
        order: [['created_at', 'DESC']],  // От новых к старым
        limit: parseInt(limit),
        offset: parseInt(offset),
        attributes: [
          'diagnosis_id', 
           'created_at', 
           'symptoms',
           'file_path',
           [
             // Извлекаем главный диагноз из JSON данных
             sequelize.literal(`(diagnosis_data->'diagnosis_predictions'->0->>'name')`),
             'main_diagnosis'
           ]
        ]
      });
      
      return res.json(history);
    } catch (err) {
      console.error('Ошибка при получении истории диагнозов:', err);
      next(ApiError.internal('Ошибка при получении истории диагнозов'));
    }
  }
  
  // Получение конкретного диагноза по ID
  async getDiagnosisById(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return next(ApiError.badRequest('Не указан ID диагноза'));
      }
      
      // Поиск диагноза в базе данных
      const diagnosis = await DiagnosisHistory.findOne({ 
        where: { diagnosis_id: id } 
      });
      
      if (!diagnosis) {
        // Если не найден в базе, пытаемся загрузить из файла
        try {
          // Проверяем директории на наличие файла
          const baseDir = path.join(__dirname, '..', '..', 'data', 'diagnoses');
          let filePath = null;
          
          // Если авторизован, сначала проверяем директорию пользователя
          if (req.user) {
            filePath = path.join(baseDir, String(req.user.id), `${id}.json`);
            if (fs.existsSync(filePath)) {
              const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
              
              // Сохраняем в базу для будущих запросов
              await DiagnosisHistory.create({
                diagnosis_id: id,
                user_id: req.user.id,
                symptoms: fileData.symptoms || '',
                diagnosis_data: fileData,
                file_path: filePath.replace(path.join(__dirname, '..', '..'), '')
              });
              
              // Добавляем флаг принадлежности
              fileData.is_own = true;
              return res.json(fileData);
            }
          }
          
          // Проверяем анонимную директорию
          filePath = path.join(baseDir, 'anonymous', `${id}.json`);
          if (fs.existsSync(filePath)) {
            const fileData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
            
            // Сохраняем в базу для будущих запросов
            await DiagnosisHistory.create({
              diagnosis_id: id,
              user_id: null, // Анонимный
              symptoms: fileData.symptoms || '',
              diagnosis_data: fileData,
              file_path: filePath.replace(path.join(__dirname, '..', '..'), '')
            });
            
            // Добавляем флаг принадлежности
            fileData.is_own = false;
            return res.json(fileData);
          }
          
          // Не найден и в файлах
          return next(ApiError.notFound('Диагноз не найден'));
        } catch (fileErr) {
          console.error('Ошибка чтения файла диагноза:', fileErr);
          return next(ApiError.notFound('Диагноз не найден или недействителен'));
        }
      }
      
      // Проверка доступа для приватных диагнозов
      if (diagnosis.user_id && (!req.user || diagnosis.user_id !== req.user.id)) {
        return next(ApiError.forbidden('У вас нет доступа к этому диагнозу'));
      }
      
      // Добавляем флаг, указывающий принадлежит ли диагноз текущему пользователю
      const result = diagnosis.toJSON();
      result.is_own = req.user && diagnosis.user_id === req.user.id;
      
      return res.json(result.diagnosis_data ? result.diagnosis_data : result);
    } catch (err) {
      console.error('Ошибка при получении диагноза:', err);
      next(ApiError.internal('Ошибка при получении диагноза'));
    }
  }
  
  // Удаление диагноза из истории
  async deleteDiagnosis(req, res, next) {
    try {
      const { id } = req.params;
      
      if (!id) {
        return next(ApiError.badRequest('Не указан ID диагноза'));
      }
      
      // Проверяем, что диагноз существует и принадлежит пользователю
      const diagnosis = await DiagnosisHistory.findOne({
        where: { 
          diagnosis_id: id,
          user_id: req.user.id  // Важно: проверяем, что удаляет владелец
        }
      });
      
      if (!diagnosis) {
        return next(ApiError.notFound('Диагноз не найден или не принадлежит вам'));
      }
      
      // Удаляем файл, если он существует
      if (diagnosis.file_path) {
        const fullPath = path.join(__dirname, '..', '..', diagnosis.file_path);
        if (fs.existsSync(fullPath)) {
          fs.unlinkSync(fullPath);
        }
      }
      
      // Удаляем запись из базы
      await diagnosis.destroy();
      
      return res.json({ message: 'Диагноз успешно удален из истории' });
    } catch (err) {
      console.error('Ошибка при удалении диагноза:', err);
      next(ApiError.internal('Ошибка при удалении диагноза'));
    }
  }
  
  // Получение статистики пользователя по диагнозам
  async getUserStats(req, res, next) {
    try {
      // Получаем общее количество диагнозов пользователя
      const totalDiagnoses = await DiagnosisHistory.count({
        where: { user_id: req.user.id }
      });
      
      // Если у пользователя нет диагнозов, возвращаем только нули
      if (totalDiagnoses === 0) {
        return res.json({
          total_diagnoses: 0,
        });
      }
      
      // Получаем первый и последний диагноз пользователя
      const firstDiagnosis = await DiagnosisHistory.findOne({
        where: { user_id: req.user.id },
        order: [['created_at', 'ASC']]
      });
      
      const latestDiagnosis = await DiagnosisHistory.findOne({
        where: { user_id: req.user.id },
        order: [['created_at', 'DESC']]
      });
      
      // Получаем наиболее частые диагнозы
      const mostCommonQuery = `
        SELECT diagnosis_data->'diagnosis_predictions'->0->>'name' as diagnosis_name, 
               COUNT(*) as count
        FROM diagnosis_history
        WHERE user_id = :userId
        GROUP BY diagnosis_name
        ORDER BY count DESC
        LIMIT 5
      `;
      
      const mostCommon = await sequelize.query(mostCommonQuery, {
        replacements: { userId: req.user.id },
        type: sequelize.QueryTypes.SELECT
      });
      
      // Собираем статистику в один объект
      const stats = {
        total_diagnoses: totalDiagnoses,
        first_diagnosis_date: firstDiagnosis ? firstDiagnosis.created_at : null,
        latest_diagnosis_date: latestDiagnosis ? latestDiagnosis.created_at : null,
        most_common_diagnoses: mostCommon.map(item => ({
          name: item.diagnosis_name,
          count: parseInt(item.count)
        }))
      };
      
      return res.json(stats);
    } catch (err) {
      console.error('Ошибка при получении статистики диагнозов:', err);
      next(ApiError.internal('Ошибка при получении статистики диагнозов'));
    }
  }
  
  // Импорт диагнозов из файловой системы в базу данных
  async importFileSystemDiagnoses(req, res, next) {
    try {
      // Этот метод должен вызываться администратором
      if (!req.user || req.user.role !== 'admin') {
        return next(ApiError.forbidden('Доступ запрещен'));
      }
      
      const baseDir = path.join(__dirname, '..', '..', 'data', 'diagnoses');
      let importedCount = 0;
      let errorCount = 0;
      
      // Функция для обработки файлов в директории
      const processDirectory = async (dirPath, userId = null) => {
        if (!fs.existsSync(dirPath)) return;
        
        const files = fs.readdirSync(dirPath);
        
        for (const file of files) {
          const filePath = path.join(dirPath, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            // Если это директория пользователя (название - числовой ID)
            if (/^\d+$/.test(file)) {
              await processDirectory(filePath, parseInt(file));
            }
          } else if (stat.isFile() && file.endsWith('.json')) {
            try {
              // Извлекаем diagnosis_id из имени файла
              const diagnosisId = file.replace('.json', '');
              
              // Проверяем, существует ли уже такая запись
              const existing = await DiagnosisHistory.findOne({
                where: { diagnosis_id: diagnosisId }
              });
              
              if (!existing) {
                const diagnosisData = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                
                await DiagnosisHistory.create({
                  diagnosis_id: diagnosisId,
                  user_id: userId,
                  symptoms: diagnosisData.symptoms || '',
                  diagnosis_data: diagnosisData,
                  file_path: filePath.replace(path.join(__dirname, '..', '..'), '')
                });
                
                importedCount++;
              }
            } catch (err) {
              console.error(`Ошибка импорта файла ${filePath}:`, err);
              errorCount++;
            }
          }
        }
      };
      
      // Начинаем обработку с корневой директории
      await processDirectory(baseDir);
      
      return res.json({
        success: true,
        message: `Импортировано ${importedCount} записей, ошибок: ${errorCount}`
      });
    } catch (err) {
      console.error('Ошибка при импорте диагнозов:', err);
      next(ApiError.internal('Ошибка при импорте диагнозов из файловой системы'));
    }
  }
}

module.exports = new DiagnosisHistoryController();