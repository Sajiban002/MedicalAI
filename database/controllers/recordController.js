// controllers/recordController.js
const { MedicalRecord, Doctor, Patient, User } = require('../models/model');
const ApiError = require('../error/ApiError');

class RecordController {
  // Врач добавляет медицинскую запись для пациента
  async addMedicalRecord(req, res, next) {
    try {
      const doctorUserId = req.user.id;
      const { patientId, diagnosis, treatment } = req.body;

      // Находим врача и пациента в базе
      const doctor = await Doctor.findOne({ where: { user_id: doctorUserId } });
      const patient = await Patient.findOne({ where: { user_id: patientId } });

      if (!doctor || !patient) {
        return next(ApiError.badRequest('Неверный ID врача или пациента'));
      }

      // Создаём запись
      const record = await MedicalRecord.create({
        doctor_id: doctor.id,
        patient_id: patient.id,
        diagnosis,
        treatment
      });

      return res.json({ message: 'Медицинская запись добавлена', record });
    } catch (err) {
      console.error(err);
      return next(ApiError.internal('Ошибка при сохранении мед. записи'));
    }
  }

  // Пациент получает свои медицинские записи
  async getMyMedicalRecords(req, res, next) {
    try {
      const patientUserId = req.user.id;
      const patient = await Patient.findOne({ where: { user_id: patientUserId } });

      if (!patient) {
        return next(ApiError.badRequest('Профиль пациента не найден'));
      }

      const records = await MedicalRecord.findAll({
        where: { patient_id: patient.id },
        include: [
          {
            model: Doctor,
            as: 'doctor',
            include: [{ model: User, attributes: ['id', 'first_name', 'last_name', 'specialization'] }]
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return res.json(records);
    } catch (err) {
      console.error(err);
      return next(ApiError.internal('Ошибка при получении мед. записей'));
    }
  }

  // Врач получает все свои созданные записи
  async getRecordsByDoctor(req, res, next) {
    try {
      const doctorUserId = req.user.id;
      const doctor = await Doctor.findOne({ where: { user_id: doctorUserId } });

      if (!doctor) {
        return next(ApiError.badRequest('Профиль врача не найден'));
      }

      const records = await MedicalRecord.findAll({
        where: { doctor_id: doctor.id },
        include: [
          {
            model: Patient,
            as: 'patient',
            include: [{ model: User, attributes: ['id', 'first_name', 'last_name', 'email'] }]
          }
        ],
        order: [['created_at', 'DESC']]
      });

      return res.json(records);
    } catch (err) {
      console.error(err);
      return next(ApiError.internal('Ошибка при получении мед. записей врача'));
    }
  }
}

module.exports = new RecordController();
