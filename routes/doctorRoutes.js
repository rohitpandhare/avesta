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

router.get('/list', getPatients); // Modified route to '/list' (or keep '/patients' if you prefer)
router.post('/create', createPrescription); // Modified route to '/create'
router.post('/update', updatePrescription); // Modified route to '/update'

router.get('/delete', deletePrescription); // Modified route to '/delete'
router.put('/removePatient', removePatient); // Modified route to '/removePatient'
router.get('/getPresHistory', getPrescriptionHistory); // Modified route to '/getPresHistory'

router.post('/createMRecord', createMedicalRecord); // Modified route to '/createMRecord'
router.get('/getMedHistory', getPatientMedicalHistory); // Modified route to '/getMedHistory'
router.post('/addPatient', addPatient); // Modified route to '/addPatient'

router.post('/createGlobalPres', generateReferenceId); // Modified route to '/createGlobalPres'

module.exports = router;