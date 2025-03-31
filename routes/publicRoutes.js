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

// router.get('/viewPres', viewPrescriptions);
// router.post('/viewPres', viewCreatedPres);
router.get('/viewPres', async (req, res) => {
    if (req.query.refId) {
        return await viewCreatedPres(req, res);
    }
    return viewPrescriptions(req, res);
});


module.exports = router;


