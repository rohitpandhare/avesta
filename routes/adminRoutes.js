const express = require('express');
const router = express.Router();
// const { checkRole } = require('../middlware/dc_middleware')

// User CRUD func import
const {
    getAdmin,
    createAdmin
} = require('../controllers/adminAuth');


router.get('/golden', (req, res) => {
    res.render('secret/adminCreate');
});

router.post('/golden', createAdmin);

router.get('/silver', (req, res) => {
    res.render('secret/adminLogin');
});

router.post('/silver', getAdmin);

// At the end of each route file
module.exports = router;