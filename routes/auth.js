const express = require('express');
const router = express.Router();

// User CRUD func import
const { 
    createUser, 
    doLogin,
    reserPass,
    logout
} = require('../controllers/userAuth');

// Update route handlers to use the imported controller functions
router.get('/logout', logout);

router.post('/login', doLogin);
router.post('/signup', createUser);
router.post('/restPass', reserPass);

module.exports = router;
