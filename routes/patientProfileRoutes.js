const express = require('express');
const router = express.Router();
const { conPool } = require('../config/dbHandler');

router.get('/patient/profile', (req, res) => {
    if (!req.session.user || req.session.user.Role !== 'PATIENT') {
        return res.redirect('/login');
    }
    res.render('dashboard/patientProfile');
});

router.post('/patient/profile', async (req, res) => {
    const userId = req.session.user.UserID;
    const { Name, Address, Phone, DOB, BloodGroup } = req.body;

    try {
        await conPool.query(
            `UPDATE PATIENT SET 
                Name = ?, 
                Address = ?, 
                Phone = ?, 
                DOB = ?, 
                BloodGroup = ?
             WHERE UserID = ?`,
            [Name, Address, Phone, DOB, BloodGroup, userId]
        );

        // Update session
        req.session.user.profileComplete = true;
        res.redirect('/patient');
    } catch (err) {
        console.error(err);
        res.render('dashboard/patientProfile', { 
            error: 'Failed to update profile',
            formData: req.body
        });
    }
});

module.exports = router;