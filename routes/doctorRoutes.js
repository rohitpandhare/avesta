const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlware/dc_middleware')

// User CRUD func import
const {  
    getDoctor,
    // getDocProfile,
    addPatient,
    addPrescription,
    addMedRecords,
    deleteRelation,
    deleteRecord,
    deletePres
} = require('../controllers/doctorAuth');

router.get('/',checkRole(['doctor']), getDoctor);
// router.post('/profile', getDocProfile);

router.post('/addPatient', addPatient);
router.post('/addPres', checkRole(['doctor']),addPrescription);
router.post('/addMedRec', addMedRecords);

router.delete('/deleteRelation/:id',deleteRelation)
router.delete('/deleteRecord/:id',deleteRecord)
router.delete('/deletePres/:id',deletePres) 

module.exports = router;


