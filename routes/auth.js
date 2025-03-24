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
router.post('/resetPass', resetPass);

module.exports = router;
