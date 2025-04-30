const Router = require('express');
const router = new Router();
const chatController = require('../controllers/chatController');
const authMiddleware = require('../middleware/authMiddleware');



// Маршрут для получения списка одобренных докторов
router.post('/get-approved', chatController.getApprovedDoctors);
router.post('/create', chatController.createChatAndTransfer);
router.post('/get-chats', chatController.getChats);
router.post('/get-messages', chatController.getMessages);
router.post('/send-messages', chatController.sendMessage);
router.post('/lock-chat', chatController.lockChat);
router.post('/check-chat-lock', chatController.checkChatLock);
router.post('/delete-chat', chatController.deleteChat);
router.get('/patient-info/:chatId', chatController.getPatientFullInfo);
router.post('/medical-records/:chatId', chatController.addMedicalRecord);



module.exports = router;



