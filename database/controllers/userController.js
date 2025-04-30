// userController.js
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ApiError = require('../error/ApiError');
const { User, Patient, Doctor } = require('../models/model');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Создание директории для хранения аватаров в database
const createAvatarDir = () => {
  const avatarDir = path.join(__dirname, '..', 'database', 'images');
  if (!fs.existsSync(avatarDir)) {
    fs.mkdirSync(avatarDir, { recursive: true });
  }
  return avatarDir;
};

const generateJwt = (id, email, role) => {
  return jwt.sign(
    { id, email, role },
    process.env.SECRET_KEY,
    { expiresIn: '24h' }
  );
};

class UserController {
  async registration(req, res, next) {
    try {
      const { role, first_name, last_name, date_of_birth, gender, email, password } = req.body;

      if (!role || !first_name || !last_name || !date_of_birth || !gender || !email || !password) {
        return next(ApiError.badRequest('Заполнены не все обязательные поля'));
      }

      const candidate = await User.findOne({ where: { email } });
      if (candidate) {
        return next(ApiError.badRequest('Пользователь с таким email уже существует'));
      }

      const hashPassword = await bcrypt.hash(password, 5);

      // При регистрации устанавливаем стандартный путь к аватару по умолчанию в зависимости от роли
      const defaultAvatarPath = role === 'doctor' 
        ? '/database/images/default_doctor_avatar.jpg' 
        : '/database/images/default_patient_avatar.jpg';
      
      // Копируем файлы по умолчанию, если они не существуют
      const avatarDir = createAvatarDir();
      const defaultDoctorPath = path.join(avatarDir, 'default_doctor_avatar.jpg');
      const defaultPatientPath = path.join(avatarDir, 'default_patient_avatar.jpg');
      
      // Создаем пустые файлы-заглушки, если их нет
      // В реальном приложении здесь должны быть предустановленные изображения
      if (!fs.existsSync(defaultDoctorPath)) {
        // Копирование из исходных файлов или создание пустых файлов
        fs.writeFileSync(defaultDoctorPath, '');
      }
      if (!fs.existsSync(defaultPatientPath)) {
        fs.writeFileSync(defaultPatientPath, '');
      }

      const newUser = await User.create({
        role,
        first_name,
        last_name,
        date_of_birth,
        gender,
        email,
        password: hashPassword,
        avatar: defaultAvatarPath,
        ai_history_enabled: true // По умолчанию разрешаем сохранение истории
      });

      if (role === 'user') {
        await Patient.create({ user_id: newUser.id });
      }

      if (role === 'doctor') {
        await Doctor.create({ user_id: newUser.id });
      }

      const token = generateJwt(newUser.id, newUser.email, newUser.role);
      return res.json({ token });

    } catch (err) {
      console.error(err);
      next(ApiError.internal('Ошибка при регистрации'));
    }
  }

  async login(req, res, next) {
    try {
      const { email, password } = req.body;

      const user = await User.findOne({ where: { email } });
      if (!user) {
        return next(ApiError.badRequest('Пользователь не найден'));
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);
      if (!isPasswordValid) {
        return next(ApiError.badRequest('Неверный пароль'));
      }

      const token = generateJwt(user.id, user.email, user.role);
      return res.json({ token });
    } catch (err) {
      console.error(err);
      next(ApiError.internal('Ошибка при авторизации'));
    }
  }

  async check(req, res, next) {
    try {
      const token = generateJwt(req.user.id, req.user.email, req.user.role);
      return res.json({ token });
    } catch (err) {
      console.error(err);
      next(ApiError.internal('Ошибка при проверке токена'));
    }
  }

  async getProfile(req, res, next) {
    try {
      const user = await User.findByPk(req.user.id, {
        include: [
          { model: Patient, as: 'patient' },
          { model: Doctor, as: 'doctor' }
        ],
        attributes: { exclude: ['password'] }
      });
  
      if (!user) {
        return next(ApiError.notFound('Пользователь не найден'));
      }
  
      return res.json(user);
    } catch (err) {
      console.error(err);
      next(ApiError.internal('Ошибка при получении данных профиля'));
    }
  }

  async topUpWallet(req, res, next) {
    try {
      const { amount } = req.body;
      const userId = req.user.id;
  
      if (!amount || isNaN(amount) || amount <= 0) {
        return next(ApiError.badRequest('Некорректная сумма пополнения'));
      }
  
      const user = await User.findByPk(userId);
      if (!user) {
        return next(ApiError.notFound('Пользователь не найден'));
      }
  
      user.wallet = parseFloat(user.wallet) + parseFloat(amount);
      await user.save();
  
      return res.json({ wallet: user.wallet });
    } catch (err) {
      console.error(err);
      next(ApiError.internal('Ошибка при пополнении баланса'));
    }
  }

  // Обновленный метод для загрузки аватара в директорию database/images
  async uploadAvatar(req, res, next) {
    try {
      const userId = req.user.id;
      const user = await User.findByPk(userId);
      
      if (!user) {
        return next(ApiError.notFound('Пользователь не найден'));
      }
      
      if (!req.files || !req.files.avatar) {
        return next(ApiError.badRequest('Файл аватара не загружен'));
      }
      
      const avatarFile = req.files.avatar;
      const avatarDir = createAvatarDir();
      
      // Проверка типа файла (принимаем только изображения)
      const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(avatarFile.mimetype)) {
        return next(ApiError.badRequest('Недопустимый формат файла. Разрешены только JPEG, PNG, GIF, WEBP'));
      }
      
      // Удаляем старый аватар, если он существует и не является аватаром по умолчанию
      if (user.avatar && 
          !user.avatar.includes('default_doctor_avatar.jpg') && 
          !user.avatar.includes('default_patient_avatar.jpg')) {
        const oldAvatarPath = path.join(__dirname, '..', user.avatar);
        if (fs.existsSync(oldAvatarPath)) {
          fs.unlinkSync(oldAvatarPath);
        }
      }
      
      // Генерируем уникальное имя файла
      const fileExtension = path.extname(avatarFile.name);
      const fileName = `avatar_${userId}_${uuidv4()}${fileExtension}`;
      const filePath = path.join(avatarDir, fileName);
      const dbPath = `/database/images/${fileName}`;
      
      // Сохраняем файл
      await avatarFile.mv(filePath);
      
      // Обновляем запись пользователя
      user.avatar = dbPath;
      await user.save();
      
      return res.json({ 
        success: true,
        message: 'Аватар успешно обновлен',
        avatar: user.avatar
      });
      
    } catch (err) {
      console.error('Ошибка при загрузке аватара:', err);
      next(ApiError.internal('Ошибка при загрузке аватара'));
    }
  }
  
  // Метод для управления настройками сохранения истории
  async updateAiHistorySettings(req, res, next) {
    try {
      const userId = req.user.id;
      const { enabled } = req.body;
      
      if (enabled === undefined) {
        return next(ApiError.badRequest('Не указан параметр enabled'));
      }
      
      const user = await User.findByPk(userId);
      if (!user) {
        return next(ApiError.notFound('Пользователь не найден'));
      }
      
      user.ai_history_enabled = !!enabled;
      await user.save();
      
      return res.json({ 
        success: true,
        message: `История диагнозов ${user.ai_history_enabled ? 'включена' : 'отключена'}`,
        ai_history_enabled: user.ai_history_enabled
      });
      
    } catch (err) {
      console.error('Ошибка при обновлении настроек сохранения истории:', err);
      next(ApiError.internal('Ошибка при обновлении настроек сохранения истории'));
    }
  }
}

module.exports = new UserController();