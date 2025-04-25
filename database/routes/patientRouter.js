// routes/patientRouter.js
const Router = require('express');
const router = new Router();
const patientController = require('../controllers/patientController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/me', authMiddleware, patientController.getProfile);
router.put('/me', authMiddleware, patientController.updateProfile);
router.delete('/me', authMiddleware, patientController.deleteAccount);

module.exports = router;