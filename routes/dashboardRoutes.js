const express = require('express');
const router = express.Router();

router.get('/', (req, res) => {
    res.render('dashboard/index');
});

router.get('/login', (req, res) => {
    res.render('dashboard/login');
});

router.get('/signup', (req, res) => {
    res.render('dashboard/signup');
});

router.get('/reset', (req, res) => {
    res.render('dashboard/resetPass');
});

module.exports = router;