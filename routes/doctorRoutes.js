const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlware/dc_middleware')
const {conPool } = require('../config/dbHandler')

// User CRUD func import
const {  
    getDoctor,
    addPatient,
    addPrescription,
    addMedRecords,
    deleteRelation,
    deleteRecord,
    deletePres,
    revivePrescription,
    viewPatient,
    requestOtpForDoctorAction,
    verifyOtpForDoctorAction,
    getDocLogs
} = require('../controllers/doctorAuth');

router.get('/',checkRole(['doctor']), getDoctor);

router.post('/addPatient', addPatient);
router.post('/addPres', addPrescription);
router.post('/addMedRec', addMedRecords);

router.delete('/deleteRelation/:id',deleteRelation)
router.delete('/deleteRecord/:id',deleteRecord)
router.delete('/deletePres/:id',deletePres) 

// Apply checkRole middleware to the OTP routes
router.post('/request-otp-for-action', checkRole(['doctor']), requestOtpForDoctorAction);
router.post('/verify-otp-for-action', checkRole(['doctor']), verifyOtpForDoctorAction);

// Deactivation routes (CORRECTED - changed from router.delete to router.post)
router.post('/deactivate-medical-record/:id',deleteRecord);
router.post('/deactivate-prescription/:id', deletePres);

router.get('/viewRelation/:id',viewPatient);

router.put('/revivePres/:id',revivePrescription )

// Route to view Doctor logs
router.get('/logs', getDocLogs);

module.exports = router;


