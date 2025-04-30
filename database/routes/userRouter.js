// userRouter.js
const Router = require('express');
const router = new Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/authMiddleware');

router.post('/registration', userController.registration);
router.post('/login', userController.login);
router.get('/auth', authMiddleware, userController.check);
router.get('/profile', authMiddleware, userController.getProfile);
router.post('/topup', authMiddleware, userController.topUpWallet);

// Новые маршруты для аватара и настроек истории
router.post('/avatar', authMiddleware, userController.uploadAvatar);
router.put('/ai-history-settings', authMiddleware, userController.updateAiHistorySettings);

module.exports = router;