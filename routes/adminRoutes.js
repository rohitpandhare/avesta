const express = require('express');
const router = express.Router();

const { conPool } = require('../config/dbHandler');

// --- TEMPORARY TEST ROUTE: ADD THIS AFTER 'const router = express.Router();' ---
// router.post('/admin/*', (req, res, next) => {
//     console.log("!!! TEMPORARY ADMIN CATCH-ALL POST ROUTE HIT !!!");
//     console.log(`Path: ${req.originalUrl}, Method: ${req.method}`);
//     // IMPORTANT: Do NOT send a response here. Call next() to allow other routes to be tried.
//     next();
// });

// Admin controller functions
const {
    requestAdminOTP, 
    verifyAdminOTP,
    deleteUser,
    deleteDoctor,
    deletePatient,
    reviveUser
} = require('../controllers/adminAuth');

// Admin creation & login views
router.get('/golden', (req, res) => res.render('secret/adminCreate'));

// OTP request endpoint
router.post('/golden/request-otp', requestAdminOTP);

// OTP verification + final creation
router.post('/golden/verify-otp', verifyAdminOTP);

router.get('/admin', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    const [userList] = await conPool.query('SELECT * FROM user');

    const [doctorList] = await conPool.query(`
        SELECT d.*, u.Username
        FROM doctor d
        JOIN user u ON d.UserID = u.UserID
        WHERE u.Role = 'DOCTOR'
    `);

    const [prescriptionStats] = await conPool.query(`
        SELECT 
            d.Specialty, 
            SUM(CASE WHEN p.Status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
            SUM(CASE WHEN p.Status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
        FROM prescription p
        JOIN doctor d ON p.DoctorID = d.DoctorID
        GROUP BY d.Specialty
    `);

    const [patientList] = await conPool.query(`
        SELECT p.*, u.Username
        FROM patient p
        JOIN user u ON p.UserID = u.UserID
        WHERE u.Role = 'PATIENT'
    `);

    const specialtyStats = {};
    doctorList.forEach(doctor => {
        const spec = doctor.Specialty || 'Other';
        if (!specialtyStats[spec]) {
            specialtyStats[spec] = {
                doctorCount: 0,
                activePrescriptions: 0,
                completedPrescriptions: 0
            };
        }
        specialtyStats[spec].doctorCount++;
    });

    prescriptionStats.forEach(row => {
        const spec = row.Specialty || 'Other';
        if (specialtyStats[spec]) {
            specialtyStats[spec].activePrescriptions = row.active;
            specialtyStats[spec].completedPrescriptions = row.completed;
        }
    });

    const specialties = Object.entries(specialtyStats)
        .map(([name, stats]) => ({ name, ...stats }))
        .sort((a, b) => b.doctorCount - a.doctorCount);

    return res.render('users/admin', {
        user: req.session.user,
        specialties,
        userList,
        doctorList,
        prescriptionStats,
        patientList
    });
});

router.get('/admin/users', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    const [userList] = await conPool.query('SELECT * FROM user');
    return res.render('users/adm/adminUsers', {
        user: req.session.user,
        userList
    });
});

router.get('/admin/doc', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    const [userList] = await conPool.query('SELECT * FROM user');

    const [doctorList] = await conPool.query(`
        SELECT d.*, u.Username, u.UserID
        FROM doctor d
        JOIN user u ON d.UserID = u.UserID
        WHERE u.Role = 'DOCTOR'
    `);

    return res.render('users/adm/adminDoc', {
        user: req.session.user,
        doctorList,
        userList
    });
});

router.get('/admin/pat', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }
    const [userList] = await conPool.query('SELECT * FROM user');

    const [patientList] = await conPool.query(`
        SELECT p.*, u.Username, u.UserID
        FROM patient p
        JOIN user u ON p.UserID = u.UserID
        WHERE u.Role = 'PATIENT'
    `);

    return res.render('users/adm/adminPat', {
        user: req.session.user,
        patientList,
        userList
    });
});

router.get('/admin/reviveUser', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    try {
        const [userList] = await conPool.query('SELECT * FROM user WHERE Flag = 1');
        return res.render('users/adm/reviveUser', {
            user: req.session.user,
            userList
        });
    } catch (err) {
        console.error('Error fetching users:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Route to view admin logs
router.get('/admin/logs', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/adminLogin');
    }

    const [logs] = await conPool.query(`
        SELECT
            aa.ActivityID,
            u.Username AS AdminUsername,
            aa.ActionPerformed,
            aa.Description,
            aa.TargetType,
            aa.TargetID,
            aa.ActivityTimestamp
        FROM
            admin_activity aa
        JOIN
            user u ON aa.AdminUserID = u.UserID
        ORDER BY
            aa.ActivityTimestamp DESC
    `);

    return res.render('users/adm/logs', {
        user: req.session.user,
        logs
    });
});


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

// Admin dashboard
router.delete('/delete-user/:id', deleteUser);
router.delete('/delete-doctor/:id', deleteDoctor);
router.delete('/delete-patient/:id', deletePatient);

router.put('/revive-user/:id', reviveUser);

module.exports = router;
