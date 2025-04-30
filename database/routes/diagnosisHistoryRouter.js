// diagnosisHistoryRouter.js
const Router = require('express');
const router = new Router();
const diagnosisHistoryController = require('../controllers/diagnosisHistoryController');
const authMiddleware = require('../middleware/authMiddleware');
const optionalAuthMiddleware = require('../middleware/optionalAuthMiddleware');
const adminMiddleware = require('../middleware/adminMiddleware');

// Save diagnosis history (works for both authenticated and anonymous users)
router.post('/', optionalAuthMiddleware, diagnosisHistoryController.saveDiagnosis);

// Get user diagnosis history (only for authenticated users)
router.get('/', authMiddleware, diagnosisHistoryController.getUserHistory);

// Get anonymous diagnoses (public access for anonymous diagnoses)
router.get('/anonymous', async (req, res, next) => {
  try {
    const { limit = 10, offset = 0 } = req.query;
    const history = await require('../models/model').DiagnosisHistory.findAndCountAll({
      where: { user_id: null },
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });
    return res.json(history);
  } catch (err) {
    console.error('Error fetching anonymous diagnoses:', err);
    next(require('../error/ApiError').internal('Error fetching anonymous diagnoses'));
  }
});

// Get user diagnosis statistics (only for authenticated users)
router.get('/stats/user', authMiddleware, diagnosisHistoryController.getUserStats);

// Import diagnoses from file system to database (admin only)
router.post('/import', authMiddleware, adminMiddleware, diagnosisHistoryController.importFileSystemDiagnoses);

// Get specific diagnosis by ID (accessible to anonymous users if the diagnosis is anonymous)
router.get('/:id', optionalAuthMiddleware, diagnosisHistoryController.getDiagnosisById);

// Delete diagnosis (only for authenticated users and their own diagnoses)
router.delete('/:id', authMiddleware, diagnosisHistoryController.deleteDiagnosis);

module.exports = router;