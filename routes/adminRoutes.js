const express = require('express');
const router = express.Router();

const { conPool } = require('../config/dbHandler');
// const { verifyOTP } = require('../controllers/userAuth');

// Admin controller functions
const {
    getAdmin,
    createAdmin,
    // getAdminDashboard
} = require('../controllers/adminAuth');

// OTP store (in-memory for dev)
const otpStore = new Map();

// Admin creation & login views
router.get('/golden', (req, res) => res.render('secret/adminCreate'));
router.post('/golden', createAdmin);

router.get('/silver', (req, res) => res.render('secret/adminLogin'));
router.post('/silver', getAdmin);

// NEW: Admin dashboard route (used after OTP redirect)
// router.get('/users/admin', getAdminDashboard);

// OTP verification (expects JSON response)
// router.post('/verify-otp', async (req, res) => {
//     const { username, role, otp } = req.body;

//     try {
//         const storedData = otpStore.get(username);
//         if (!storedData || storedData.role !== role) {
//             return res.status(400).json({ error: 'Invalid verification request' });
//         }

//         if (Date.now() > storedData.expires) {
//             otpStore.delete(username);
//             return res.status(401).json({ error: 'Verification code expired' });
//         }

//         const isValid = verifyOTP(otp, storedData.secret);
//         if (!isValid) {
//             return res.status(401).json({ error: 'Invalid verification code' });
//         }

//         const [users] = await conPool.query(
//             'SELECT * FROM user WHERE Username = ? AND Role = ?', 
//             [username, role]
//         );

//         if (!users.length) {
//             return res.status(404).json({ error: 'User profile not found' });
//         }

//         const user = users[0];
//         let profileData = {};

//         // Fetch role-specific profile data
//         if (role === 'PATIENT') {
//             const [patientData] = await conPool.query(
//                 'SELECT * FROM patient WHERE UserID = ?',
//                 [user.UserID]
//             );
//             if (patientData.length) profileData = patientData[0];
//         } else if (role === 'DOCTOR') {
//             const [doctorData] = await conPool.query(
//                 'SELECT * FROM doctor WHERE UserID = ?',
//                 [user.UserID]
//             );
//             if (doctorData.length) profileData = doctorData[0];
//         } else if (role === 'ADMIN') {
//             profileData = { AdminID: user.UserID }; // placeholder if needed
//         }

//         // Store session
//         req.session.user = {
//             UserID: user.UserID,
//             Username: user.Username,
//             Email: user.Email,
//             Role: role,
//             ...profileData
//         };

//         // Clean up OTP store
//         otpStore.delete(username);

//         // Respond with JSON (frontend expects JSON, not HTML)
//         let redirectUrl = '/';
//         switch (role.toLowerCase()) {
//             case 'admin':
//                 redirectUrl = '/users/admin';
//                 break;
//             case 'doctor':
//                 redirectUrl = '/doctor/dashboard';
//                 break;
//             case 'patient':
//                 redirectUrl = '/patient/dashboard';
//                 break;
//         }

//         return res.json({ success: true, redirectUrl });

//     } catch (error) {
//         console.error('Verification error:', error);
//         return res.status(500).json({ error: 'Verification failed' });
//     }
// });
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
    const [patientList] = await conPool.query(`
        SELECT p.*, u.Username
        FROM patient p
        JOIN user u ON p.UserID = u.UserID
        WHERE u.Role = 'PATIENT'
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
        userList,
        doctorList,
        patientList,
        specialties
    });
});


module.exports = router;
