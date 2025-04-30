// routes/doctorRouter.js
const Router = require('express');
const router = new Router();
const doctorController = require('../controllers/doctorController');
const authMiddleware = require('../middleware/authMiddleware');

router.get('/me', authMiddleware, doctorController.getProfile);
router.put('/me', authMiddleware, doctorController.updateProfile);
router.delete('/me', authMiddleware, doctorController.deleteAccount);

module.exports = router;