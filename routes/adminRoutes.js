const express = require('express');
const router = express.Router();
// const { checkRole } = require('../middlware/dc_middleware')

// User CRUD func import
const {
    getAdmin,
    createAdmin
} = require('../controllers/adminAuth');


router.get('/golden', (req, res) => {
    res.render('secret/adminCreate');
});

router.post('/golden', createAdmin);

router.get('/silver', (req, res) => {
    res.render('secret/adminLogin');
});

router.post('/silver', getAdmin);

const { conPool } = require('../config/dbHandler');

const { generateOTP, sendOTPEmail, verifyOTP } = require('../controllers/userAuth');

const otpStore = new Map();

router.post('/verify-otp', async (req, res) => {
    const { username, role, otp } = req.body;
    
    try {
        const storedData = otpStore.get(username);
        if (!storedData || storedData.role !== role) {
            return res.status(400).json({ error: 'Invalid verification request' });
        }

        if (Date.now() > storedData.expires) {
            otpStore.delete(username);
            return res.status(401).json({ error: 'Verification code expired' });
        }

        const isValid = verifyOTP(otp, storedData.secret);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid verification code' });
        }

        const [users] = await conPool.query(
            'SELECT * FROM user WHERE Username = ? AND Role = ?', 
            [username, role]
        );

        if (!users.length) {
            return res.status(404).json({ error: 'User profile not found' });
        }

        const user = users[0];
        let profileData = {};

        // Fetch role-specific profile data
        if (role === 'PATIENT') {
            const [patientData] = await conPool.query(
                'SELECT * FROM patient WHERE UserID = ?',
                [user.UserID]
            );
            
            if (patientData.length) {
                profileData = patientData[0];
            }
        } 
        else if (role === 'DOCTOR') {
            const [doctorData] = await conPool.query(
                'SELECT * FROM doctor WHERE UserID = ?',
                [user.UserID]
            );
            
            if (doctorData.length) {
                profileData = doctorData[0];
            }
        }
        else if (role === 'ADMIN') {
            // Fetch admin-specific data if needed
            profileData = { AdminID: user.UserID };
        }

        // Consolidate session management
        req.session.user = {
            UserID: user.UserID,
            Username: user.Username,
            Email: user.Email,
            Role: role,
            ...profileData  // Spread profile data
        };

        // Clean up OTP store
        otpStore.delete(username);

        // Unified redirect handling
        switch(role.toLowerCase()) {
            case 'admin':
                return res.render('users/admin', { 
                    user: req.session.user,
                    userList: [],  // Provide empty lists initially
                    doctorList: [],
                    patientList: [],
                    specialties: []
                });
            case 'doctor':
                return res.redirect('/doctor/dashboard');
            case 'patient':
                return res.redirect('/patient/dashboard');
            default:
                return res.redirect('/');
        }

    } catch (error) {
        console.error('Verification error:', error);
        return res.status(500).json({ error: 'Verification failed' });
    }
});

module.exports = router;
