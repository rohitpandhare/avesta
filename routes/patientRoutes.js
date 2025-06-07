const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlware/dc_middleware')

// User CRUD func import
const {  
    getPatients,
    viewPatients,
    viewRecords,
    viewPrescriptions,
    getPatientDetails, 
    updatePatientDetails,
    getPatientDashboardData
} = require('../controllers/patientAuth');

router.get('/',checkRole(['patient']), getPatients);

router.get('/viewDoc', viewPatients);
router.get('/viewRec', viewRecords);
router.get('/viewPres', viewPrescriptions);

router.get('/records', getPatientDashboardData);

// Route for logged-in patient to view/edit their own profile
router.get('/myProfile', getPatientDetails);
router.post('/updateProfile', updatePatientDetails); // Use POST for form submission, or PUT if using AJAX

module.exports = router;




