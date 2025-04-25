const Router = require('express')
const router =new Router()
const userRouter = require('./userRouter')
const patientRouter = require('./patientRouter')
const doctorRouter = require('./doctorRouter')
const chatRouter = require('./chatRouter');
const medicalRecordRouter = require('./medicalRecordRouter');


router.use('/user',userRouter)
router.use('/patient',patientRouter)
router.use('/record',medicalRecordRouter)
router.use('/doctor',doctorRouter)
router.use('/chat',chatRouter);

module.exports = router