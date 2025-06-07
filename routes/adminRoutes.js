const express = require('express');
const router = express.Router();
const { conPool } = require('../config/dbHandler');

// Admin controller functions
const {
    getAdmin,
    getUnderUser,
    getUnderDoc,
    getUnderPat,
    reviveUser,
    getLogs,
    activateUser
} = require('../controllers/adminAuth');

const{
    requestAdminOTP, 
    verifyAdminOTP

} = require('../controllers/helperAuth');

// Admin creation & login views
router.get('/golden', (req, res) => res.render('secret/adminCreate'));
router.post('/golden/request-otp', requestAdminOTP);
router.post('/golden/verify-otp', verifyAdminOTP);

router.get('/admin',getAdmin);
router.get('/admin/users',getUnderUser);
router.get('/admin/doc', getUnderDoc);
router.get('/admin/pat', getUnderPat);

router.get('/admin/reviveUser',reviveUser);
router.get('/admin/logs',getLogs);

router.get('/admin/deactivate/:id', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    const refId = req.params.id; // This is the UserID

    const [userList] = await conPool.query('SELECT * FROM user WHERE userID = ?', [refId]);

    return res.render('users/adm/adminDel', {
        user: req.session.user,
        userList // This will contain either one user or an empty array
    });
});

// New route for activating users with OTP verification
router.post('/admin/activate-user/:userID', activateUser);

// Correct route for deactivating a user
router.post('/admin/deactivate-user/:userID', async (req, res) => {
    const { userID } = req.params; // Get userID from URL parameters
    console.log(`[Deactivate User Route] Attempting to deactivate user with ID: ${userID}`);

    // --- Start: Your actual database logic to update the user's Flag ---
    try {
        const [result] = await conPool.execute(
            'UPDATE User SET Flag = 1 WHERE UserID = ?',
            [userID]
        );


        if (result.affectedRows > 0) {
            await conPool.query(
               'INSERT INTO admin_activity (AdminUserID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
               [req.session.user.UserID, 'DEACTIVATE', 'Admin deactivated user', 'USER', userID]);
            console.log(`[Deactivate User Route] User ${userID} deactivated (Flag = 1) successfully.`);
            return res.status(200).json({ success: true, message: `User ${userID} deactivated successfully.` });
        } else {
            console.log(`[Deactivate User Route] User ${userID} not found or already deactivated.`);
            return res.status(404).json({ success: false, error: 'User not found or already deactivated.' });
        }
    } catch (error) {
        console.error('[Deactivate User Route] Database error during deactivation:', error);
        return res.status(500).json({ success: false, error: 'Internal server error during deactivation.' });
    }
    // --- End: Your actual database logic ---
});

router.get('/admin/activate/:id', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    const refId = req.params.id; // This is the UserID

    const [userList] = await conPool.query('SELECT * FROM user WHERE userID = ?', [refId]);

    return res.render('users/adm/adminRevive', {
        user: req.session.user,
        userList // This will contain either one user or an empty array
    });
});

// Correct route for deactivating a user
router.post('/admin/activate-user/:userID', async (req, res) => {
    const { userID } = req.params; // Get userID from URL parameters
    console.log(`[Activate User Route] Attempting to deactivate user with ID: ${userID}`);

    // --- Start: Your actual database logic to update the user's Flag ---
    try {
        const [result] = await conPool.execute(
            'UPDATE User SET Flag = 0 WHERE UserID = ?',
            [userID]
        );

        if (result.affectedRows > 0) {
            await conPool.query(
               'INSERT INTO admin_activity (AdminUserID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
               [req.session.user.UserID, 'ACTIVATE', 'Admin activated user', 'USER', userID]);
            console.log(`[Activate User Route] User ${userID} activated (Flag = 0) successfully.`);
            return res.status(200).json({ success: true, message: `User ${userID} activated successfully.` });
        } else {
            console.log(`[Activate User Route] User ${userID} not found or already deactivated.`);
            return res.status(404).json({ success: false, error: 'User not found or already deactivated.' });
        }
    } catch (error) {
        console.error('[Deactivate User Route] Database error during activation:', error);
        return res.status(500).json({ success: false, error: 'Internal server error during activation.' });
    }
});

router.put('/revive-user/:id', reviveUser);




module.exports = router;

// Admin dashboard
// router.delete('/delete-user/:id', deleteUser);
// router.delete('/delete-doctor/:id', deleteDoctor);
// router.delete('/delete-patient/:id', deletePatient);