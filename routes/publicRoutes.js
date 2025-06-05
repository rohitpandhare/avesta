const { conPool } = require('../config/dbHandler')
const router = require('express').Router();

const {
    findDoctor,
    viewPrescriptions,
    printPres
} = require('../controllers/publicAuth');

router.get('/findDr', findDoctor);

// Amended routes
router.get('/viewPres', viewPrescriptions);

router.get('/printPrescription/:refId', printPres);

module.exports = router;
