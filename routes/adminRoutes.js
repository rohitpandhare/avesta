const express = require('express');
const router = express.Router();

const { conPool } = require('../config/dbHandler');

// Admin controller functions
const {
    requestAdminOTP, 
    verifyAdminOTP,
    deleteUser,
    deleteDoctor,
    deletePatient,
    reviveUser
    // getAdminDashboard
} = require('../controllers/adminAuth');

// Admin creation & login views
router.get('/golden', (req, res) => res.render('secret/adminCreate'));

// OTP request endpoint
router.post('/golden/request-otp', requestAdminOTP);

// OTP verification + final creation
router.post('/golden/verify-otp', verifyAdminOTP);

router.get('/admin', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/login');
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
        return res.redirect('/login');
    }

    const [userList] = await conPool.query('SELECT * FROM user');
    return res.render('users/adminUsers', {
        user: req.session.user,
        userList
    });
});

router.get('/admin/doc', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/login');
    }

    const [userList] = await conPool.query('SELECT * FROM user');

    const [doctorList] = await conPool.query(`
        SELECT d.*, u.Username
        FROM doctor d
        JOIN user u ON d.UserID = u.UserID
        WHERE u.Role = 'DOCTOR'
    `);

    return res.render('users/adminDoc', {
        user: req.session.user,
        doctorList,
        userList
    });
});

router.get('/admin/pat', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/login');
    }
    const [userList] = await conPool.query('SELECT * FROM user');

    const [patientList] = await conPool.query(`
        SELECT p.*, u.Username
        FROM patient p
        JOIN user u ON p.UserID = u.UserID
        WHERE u.Role = 'PATIENT'
    `);

    return res.render('users/adminPat', {
        user: req.session.user,
        patientList,
        userList
    });
});


router.get('/admin/reviveUser', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/login');
    }

    const [userList] = await conPool.query('SELECT * FROM user where flag=1');
    return res.render('users/reviveUser', {
        user: req.session.user,
        userList
    });
});


// Route to view admin logs
router.get('/admin/logs', async (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'ADMIN') {
        return res.redirect('/login');
    }

    const [logs] = await conPool.query('SELECT * FROM admin_activity ORDER BY ActivityTimestamp DESC');
    return res.render('users/logs', {
        user: req.session.user,
        logs
    });
});

// Admin dashboard
router.delete('/delete-user/:id', deleteUser);
router.delete('/delete-doctor/:id', deleteDoctor);
router.delete('/delete-patient/:id', deletePatient);



router.put('/revive-user/:id', reviveUser);

module.exports = router;
