const Router = require('express');
const router = new Router();
const recordController = require('../controllers/recordController');
const authMiddleware = require('../middleware/authMiddleware');
const checkRole = require('../middleware/checkRoleMiddleware');

// Добавить мед. запись — только врач
router.post(
  '/',
  authMiddleware,
  checkRole(['doctor']),
  recordController.addMedicalRecord
);

// Получить свои записи — только пациент
router.get(
  '/my',
  authMiddleware,
  checkRole(['user']),
  recordController.getMyMedicalRecords
);

// Получить записи, созданные врачом — только врач
router.get(
  '/doctor/my',
  authMiddleware,
  checkRole(['doctor']),
  recordController.getRecordsByDoctor
);

module.exports = router;
