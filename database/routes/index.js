// routes/index.js
const Router = require('express');
const router = new Router();
const userRouter = require('./userRouter'); // Оставляем только одно объявление
const patientRouter = require('./patientRouter');
const doctorRouter = require('./doctorRouter');
const chatRouter = require('./chatRouter');
const diagnosisHistoryRouter = require('./diagnosisHistoryRouter'); // Эта строка была правильной


router.use('/user', userRouter); // Использование роутера
router.use('/patient', patientRouter);
router.use('/doctor', doctorRouter);
router.use('/chat', chatRouter);
router.use('/diagnosis', diagnosisHistoryRouter);

module.exports = router;