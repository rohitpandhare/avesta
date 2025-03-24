const express = require('express');
const router = express.Router();

// User CRUD func import
const {
    doLogin,
    createUser,
    resetPass,
    logout
} = require('../controllers/userAuth');
const { conPool } = require('../config/dbHandler');

// Update route handlers to use the imported controller functions
router.get('/logout', logout);
// router.post('/login', doLogin);
router.post('/signup', createUser);
router.post('/resetPass', resetPass);

router.post('/login', async (req, res) => {
    try {
        const { Username, Password, Role, adminCode } = req.body;

        // Admin validation
        if (Role === 'ADMIN' && adminCode !== 'your_admin_code') {
            return res.render('dashboard/login', {
                error: 'Invalid admin code'
            });
        }

        // Query user table
        const [users] = await conPool.query(
            'SELECT * FROM user WHERE Username = ? AND Password = ? AND Role = ?',
            [Username, Password, Role]
        );

        if (users.length === 0) {
            return res.render('dashboard/login', {
                error: 'Invalid credentials'
            });
        }

        // Set session
        req.session.loggedIn = true;
        req.session.user = users[0];

        // Redirect based on role
        switch(Role) {
            case 'DOCTOR':
                res.redirect('/doctor');
                break;
            case 'PATIENT':
                res.redirect('/patient');
                break;
            case 'ADMIN':
                res.redirect('/admin');
                break;
            default:
                res.redirect('/');
        }

    } catch (err) {
        console.error('Login error:', err);
        res.render('dashboard/login', {
            error: 'Server error, please try again'
        });
    }
});

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});


module.exports = router;
