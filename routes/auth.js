const express = require('express');
const router = express.Router();

// User CRUD func import
const {
    doLogin,
    createUser,
    resetPass,
    logout
} = require('../controllers/userAuth');

router.get('/logout', logout);
router.post('/login', doLogin);
router.post('/signup', createUser);
router.post('/reset', resetPass);

module.exports = router;


