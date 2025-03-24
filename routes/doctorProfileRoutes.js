const express = require('express');
const router = express.Router();
const { conPool } = require('../config/dbHandler');

router.get('/doctor/profile', verifyDoctor, (req, res) => {
    res.render('dashboard/doctorProfile');
});

router.post('/doctor/profile', async (req, res) => {
    const userId = req.session.user.UserID;
    const { Name, Specialty, LicenseNumber, Qualifications, Phone } = req.body;

    try {
        const [result] = await conPool.query(
            `UPDATE DOCTOR SET 
                Name = ?, 
                Specialty = ?, 
                LicenseNumber = ?, 
                Qualifications = ?, 
                Phone = ?
             WHERE UserID = ?`,
            [Name, Specialty, LicenseNumber, Qualifications, Phone, userId]
        );

        // Update session
        req.session.user.profileComplete = true;
        res.redirect('/doctor');
    } catch (err) {
        console.error(err);
        res.render('dashboard/doctorProfile', { 
            error: 'Failed to update profile',
            formData: req.body
        });
    }
});

module.exports = router;