const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlware/dc_middleware')

// User CRUD func import
const {  
    getPatients,
} = require('../controllers/patientAuth');

router.get('/',checkRole(['patient']), getPatients);

module.exports = router;




