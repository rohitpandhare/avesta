const express = require('express');
const router = express.Router();
// const { conPool } = require('../config/dbHandler');

// // Middleware to check if user is authenticated
// function ensureAuthenticated(req, res, next) {
//     if (req.session.user) {
//         return next();
//     }
//     res.redirect('/login');
// }

// // Dashboard main route - redirects to role-specific dashboards
// router.get('/dashboard', ensureAuthenticated, (req, res) => {
//     const user = req.session.user;
    
//     // Redirect based on role
//     switch(user.role.toLowerCase()) { // Case-insensitive check
//         case 'admin':
//             return res.redirect('/admin/dashboard');
//         case 'doctor':
//             return res.redirect('/doctor/dashboard');
//         case 'patient':
//             return res.redirect('/patient/dashboard');
//         default:
//             return res.render('dashboard/index');
//     }
// });

// Basic routes
router.get('/', (req, res) => {
    if (req.session.user) {
        return res.redirect('/dashboard');
    }
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