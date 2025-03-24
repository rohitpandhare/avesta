const express = require('express');
const router = express.Router();

// User CRUD func import
const { 
    getPatients,
    createPrescription,
    updatePrescription,
    deletePrescription,
    removePatient,
    getPrescriptionHistory,
    createMedicalRecord,
    getPatientMedicalHistory,
    addPatient,
    generateReferenceId
} = require('../controllers/doctorAuth');

// Update route handlers to use the imported controller functions

router.get('/doctor/list', getPatients);
router.post('/doctor/create',createPrescription)
router.post('/doctor/update',updatePrescription)

router.get('/doctor/delete',deletePrescription)
router.put('/doctor/removePatient',removePatient)
router.get('/doctor/getPresHistory', getPrescriptionHistory)

router.post('/doctor/createMRecord',createMedicalRecord)
router.get('/doctor/getMedHistory', getPatientMedicalHistory)
router.post('/doctor/addPatient', addPatient)

router.post('/doctor/createGlobalPres', generateReferenceId)

module.exports = router;
