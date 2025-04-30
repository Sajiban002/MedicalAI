// patientController.js
const {User} = require('../models/model');
const {Patient} = require('../models/model');
const ApiError = require('../error/ApiError');

class PatientController {
  async getProfile(req, res, next) {
    try {
      const patient = await Patient.findOne({
        where: { user_id: req.user.id },
        include: {
          model: User,
          attributes: ['first_name', 'last_name', 'email', 'date_of_birth', 'gender']
        }
      });

      if (!patient) {
        return next(ApiError.badRequest('Профиль пациента не найден'));
      }

      return res.json(patient);
    } catch (error) {
      console.error(error);
      next(ApiError.internal('Ошибка при получении профиля'));
    }
  }

  async updateProfile(req, res, next) {
    try {
      const patient = await Patient.findOne({ where: { user_id: req.user.id } });

      if (!patient) {
        return next(ApiError.badRequest('Профиль пациента не найден'));
      }

      await patient.update(req.body);
      return res.json({ message: 'Профиль обновлён', patient });
    } catch (error) {
      console.error(error);
      next(ApiError.internal('Ошибка при обновлении профиля'));
    }
  }

  async deleteAccount(req, res, next) {
    try {
      const patient = await Patient.findOne({ where: { user_id: req.user.id } });

      if (!patient) {
        return next(ApiError.badRequest('Пациент не найден'));
      }

      await patient.destroy();
      await User.destroy({ where: { id: req.user.id } });

      return res.json({ message: 'Аккаунт успешно удалён' });
    } catch (error) {
      console.error(error);
      next(ApiError.internal('Ошибка при удалении аккаунта'));
    }
  }
}

module.exports = new PatientController();