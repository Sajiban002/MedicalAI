// doctorController
const { User, Doctor } = require('../models/model');
const ApiError = require('../error/ApiError');

class DoctorController {
  async getProfile(req, res, next) {
    try {
      const doctor = await Doctor.findOne({
        where: { user_id: req.user.id },
        include: {
          model: User,
          attributes: ['first_name', 'last_name', 'email', 'date_of_birth', 'gender']
        }
      });

      if (!doctor) {
        return next(ApiError.badRequest('Профиль врача не найден'));
      }

      return res.json(doctor);
    } catch (error) {
      console.error(error);
      next(ApiError.internal('Ошибка при получении профиля врача'));
    }
  }

  async updateProfile(req, res, next) {
    try {
      const doctor = await Doctor.findOne({ where: { user_id: req.user.id } });

      if (!doctor) {
        return next(ApiError.badRequest('Профиль врача не найден'));
      }

      await doctor.update(req.body);
      return res.json({ message: 'Профиль врача обновлён', doctor });
    } catch (error) {
      console.error(error);
      next(ApiError.internal('Ошибка при обновлении профиля врача'));
    }
  }

  async deleteAccount(req, res, next) {
    try {
      const doctor = await Doctor.findOne({ where: { user_id: req.user.id } });

      if (!doctor) {
        return next(ApiError.badRequest('Врач не найден'));
      }

      await doctor.destroy();
      await User.destroy({ where: { id: req.user.id } });

      return res.json({ message: 'Аккаунт врача успешно удалён' });
    } catch (error) {
      console.error(error);
      next(ApiError.internal('Ошибка при удалении аккаунта врача'));
    }
  }
}

module.exports = new DoctorController();