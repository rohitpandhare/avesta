const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlware/dc_middleware')

// User CRUD func import
const {  
    getPatients,
	getPatientProfile
} = require('../controllers/patientAuth');

router.get('/',checkRole(['patient']), getPatients);
router.post('/profile', getPatientProfile);


module.exports = router;




