const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const ApiError = require('../error/ApiError');
const { User, Patient, Doctor } = require('../models/model');

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

      const newUser = await User.create({
        role,
        first_name,
        last_name,
        date_of_birth,
        gender,
        email,
        password: hashPassword
        // поле wallet создаётся по умолчанию (0.00)
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
        ]
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
  
}

module.exports = new UserController();