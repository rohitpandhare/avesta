const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlware/dc_middleware')

// User CRUD func import
const {  
    getPatients,
    viewPatients,
    viewRecords,
    viewPrescriptions
} = require('../controllers/patientAuth');

router.get('/',checkRole(['patient']), getPatients);

router.get('/viewDoc', viewPatients);
router.get('/viewRec', viewRecords);
router.get('/viewPres', viewPrescriptions);

module.exports = router;




