const express = require('express');
const router = express.Router();

// User CRUD func import
const {
    findDoctor,
    findPerticularDoctor,
    viewPrescriptions,
    viewCreatedPres
} = require('../controllers/publicAuth');

router.get('/findDr', findDoctor);
router.get('/findDr/search', findPerticularDoctor);

router.get('/viewPres', viewPrescriptions);
router.post('/viewPres', viewCreatedPres);

module.exports = router;


