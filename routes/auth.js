const express = require('express');
const router = express.Router();

// User CRUD func import
const {
    doLogin,
    createUser,
    resetPass,
    logout
} = require('../controllers/userAuth');

// Update route handlers to use the imported controller functions
router.get('/logout', logout);
router.post('/login', doLogin);
router.post('/signup', createUser);
router.post('/reset', resetPass);

router.get('/logout', (req, res) => {
    req.session.destroy();
    res.redirect('/login');
});


module.exports = router;


