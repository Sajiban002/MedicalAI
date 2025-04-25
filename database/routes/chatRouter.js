const Router = require('express');
const router = new Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');
const checkRole = require('../middleware/checkRoleMiddleware');


router.get('/approved_doctors',authMiddleware, chatController.getApprovedDoctors);
router.post('/create_chat',authMiddleware, chatController.createChatWithDoctor);
router.post('/message', authMiddleware, chatController.sendMessage);
router.get('/messages/:chatRoomId', authMiddleware, chatController.getMessages);
router.get('/', authMiddleware, chatController.getMyChats);



module.exports = router;

