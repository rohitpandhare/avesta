const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlware/dc_middleware')

// User CRUD func import
const {
    getAdmin
} = require('../controllers/adminAuth');

router.get('/',checkRole(['admin']), getAdmin);
module.exports = router;

// router.delete('/delete-user/:id', deleteUser);

// router.delete('/delete-doctor/:id', deleteDoctor);
// router.delete('/delete-patient/:id', deletePatient);


// deleteUser,
    // deleteDoctor,
    // deletePatient
