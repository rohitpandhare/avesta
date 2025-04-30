const express = require('express');
const router = express.Router();

// Basic routes
router.get('/dashboard', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('dashboard/index');
});

router.get('/', (req, res) => {
    // if (req.session.user) {
    //     return res.redirect('/dashboard');
    // }
    res.render('dashboard/index');
});

router.get('/login', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
    res.render('dashboard/login');
});

router.get('/signup', (req, res) => {
    res.render('dashboard/signup');
});

router.get('/reset', (req, res) => {
    res.render('dashboard/resetPass');
});

module.exports = router;