const express = require('express');
const router = express.Router();
const speakeasy = require('speakeasy');

// User CRUD func import
const {
    generateOTP,
    sendOTPEmail,
    verifyOTP,
    generateSecret
} = require('../controllers/accessAuth');

const otpSecrets = {};

// Route to generate and send OTP
router.post('/generate-otp', async (req, res) => {
    const { email } = req.body;
    if (!email) {
        return res.status(400).json({ error: 'Email is required' });
    }

    try {
        const secret = generateSecret();
        const otp = generateOTP(secret);

        otpSecrets[email] = secret; // Store the secret for the user

        await sendOTPEmail(email, otp);
        res.json({
            message: 'OTP sent successfully',
            otp: otp,
            email: email
        })
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Failed to send OTP email' });
    }
});


// Route to verify OTP
router.post('/verify-otp', (req, res) => {
   const { email, otp } = req.body;

   if (!email || !otp) {
       return res.status(400).json({ error: 'Email and OTP are required' });
   }
   const secret = otpSecrets[email];
    if (!secret) {
         return res.status(400).json({ error: 'No OTP generated for this email' });
    }

    const isVerified = verifyOTP(otp, secret);  

    if (isVerified) {
        delete otpSecrets[email]; // Remove the secret after successful verification
        res.json({ message: 'OTP verified successfully' });
    } else {
        res.status(400).json({ error: 'Invalid OTP' });
    }
});


// At the end of each route file
module.exports = router;