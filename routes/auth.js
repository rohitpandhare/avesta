const express = require('express');
const router = express.Router();
const { conPool } = require('../config/dbHandler'); // importing conpool for DB operations
const speakeasy = require('speakeasy'); // Import speakeasy
const nodemailer = require('nodemailer'); // Import nodemailer

// User CRUD func import (assuming these are correctly implemented elsewhere)
const {
    doLogin,
    createUser,
    logout,
} = require('../controllers/userAuth');

// Doctor/Patient related CRUD func import (assuming these are correctly implemented elsewhere)
const {
    getRel,
    getRec,
    getPres,
    addingPres,
    addingRel,
    addingRec,
    getOldPres
} = require('../controllers/doctorAuth');

// --- Doctor/Patient Routes (assuming these are working correctly) ---
router.get('/login/getRelation', getRel);
router.get('/login/getRecord', getRec);
router.get('/login/getPrescription', getPres);
router.get('/login/revivePres', getOldPres);

router.get('/login/addPrescription', addingPres);
router.get('/login/addRelation', addingRel);
router.get('/login/addRecord', addingRec);

// --- OTP Configuration ---
const OTP_CONFIG = {
    step: 300, // 5-minute validity (300 seconds)
    digits: 6,
    encoding: 'base32'
};

// --- Generate OTP ---
function generateOTP() {
    const secret = speakeasy.generateSecret({ length: 20 });
    const token = speakeasy.totp({
        secret: secret.base32,
        ...OTP_CONFIG
    });
    return { otp: token, secret: secret.base32 };
}

// --- Verify OTP ---
function verifyOTP(token, secret) {
    return speakeasy.totp.verify({
        secret: secret,
        token: token,
        ...OTP_CONFIG
    });
}

// --- Email Transport ---
const emailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'connect.doctorsync@gmail.com',
        pass: 'dklp rsru tpys agki' // IMPORTANT: Use environment variables for passwords in production!
    }
});

// --- Send OTP Email ---
async function sendOTPEmail(email, otp, subjectPrefix = 'Your Verification Code') {
    try {
        await emailTransport.sendMail({
            from: '"OTP Service" <connect.doctorsync@gmail.com>',
            to: email,
            subject: `${subjectPrefix}`,
            text: `Your verification code is: ${otp}\nThis code expires in 5 minutes.`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                    <h2 style="color: #1a365d;">DoctorSync Verification</h2>
                    <p style="font-size: 16px;">
                        Your secure verification code is:
                        <strong style="font-size: 24px; letter-spacing: 2px;">${otp}</strong>
                    </p>
                    <p style="color: #718096; font-size: 14px;">
                        This code will expire in 5 minutes. If you didn't request this,
                        please contact support immediately.
                    </p>
                </div>
            `
        });
        console.log(`OTP email sent to ${email}`);
    } catch (error) {
        console.error('Email send error:', error);
        throw new Error('Failed to send verification email');
    }
}

const otpStore = new Map(); // Map: key -> { secret: '...', expires: Date }

// --- Existing Login OTP Request Endpoint (for ADMIN login) ---
router.post('/request-otp', async (req, res) => {
    const { username, role } = req.body;

    try {
        // Validate user exists for login
        const [users] = await conPool.query(
            `SELECT * FROM user WHERE Username = ? AND Role = ?`,
            [username, role]
        );

        if (!users.length) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = users[0];
        if (!user.Email) {
            return res.status(400).json({ error: 'No verified email found for this user.' });
        }

        // Generate and store OTP for login (using username as key for login OTP)
        const { otp, secret } = generateOTP();

        otpStore.set(username, {
            secret,
            role,
            expires: Date.now() + OTP_CONFIG.step * 1000 // Use OTP_CONFIG.step for expiration
        });

        // --- ENHANCED LOGGING FOR DB INSERT ---
        try {
            // Store OTP in database (if you have an otp_table)
            // Ensure your otp_table has columns for otp (VARCHAR), email (VARCHAR), and byUser (VARCHAR)
            await conPool.query(`
                INSERT INTO otp_table (otp, email, byUser)
                VALUES (?, ?, ?)
            `, [otp, user.Email, username]);
            console.log('Login OTP successfully inserted into otp_table for user:', username);
        } catch (dbError) {
            console.error('DATABASE INSERT ERROR (Login OTP):', dbError);
            // Decide how to handle this:
            // 1. Return 500 error to client (if DB persistence is critical)
            // 2. Log and continue (if in-memory store is primary, DB is secondary)
            // For now, we'll log and let the email send proceed if DB fails.
            // If DB failure means OTP is not truly stored, you might want to return an error here.
        }

        console.log('Login OTP generated and stored in memory for user:', username);

        // Send OTP email
        await sendOTPEmail(user.Email, otp, 'DoctorSync Login Verification');

        res.json({ success: true, email: user.Email });
    } catch (error) {
        console.error('Login OTP request error (overall):', error);
        res.status(500).json({ error: 'Failed to process login OTP request.' });
    }
});

// --- Existing Login OTP Verification Endpoint (now ONLY for ADMIN login) ---
router.post('/verify-otp', async (req, res) => {
    const { username, role, otp } = req.body;

    try {
        const storedData = otpStore.get(username);

        // Check if OTP exists and is for the correct role
        if (!storedData || storedData.role !== role) {
            return res.status(400).json({ error: 'Invalid verification request or OTP not found.' });
        }

        // Check OTP expiration
        if (Date.now() > storedData.expires) {
            otpStore.delete(username); // Clear expired OTP
            return res.status(401).json({ error: 'Verification code expired. Please request a new one.' });
        }

        // Verify OTP code using the stored secret
        const isValid = verifyOTP(otp, storedData.secret);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid verification code.' });
        }

        // Fetch user details for session (ensure it's an ADMIN)
        const [users] = await conPool.query(
            'SELECT * FROM user WHERE Username = ? AND Role = ?',
            [username, 'ADMIN'] // Explicitly check for ADMIN role for this login path
        );

        if (!users.length) {
            return res.status(404).json({ error: 'Admin user profile not found.' });
        }

        const user = users[0];
        let profileData = { AdminID: user.UserID }; // For ADMIN, just set profileData

        // Consolidate session management for ADMIN
        req.session.user = {
            UserID: user.UserID,
            Username: user.Username,
            Email: user.Email,
            Role: role,
            ...profileData
        };
        req.session.loggedIn = true;

        // Clean up OTP store after successful login
        otpStore.delete(username);

        // JSON response expected by frontend for redirect
        return res.json({ success: true, redirectUrl: '/admin' });

    } catch (error) {
        console.error('Login verification error:', error);
        return res.status(500).json({ error: 'Login verification failed due to a server error.' });
    }
});


// --- NEW: Request OTP for User Deactivation Endpoint ---
router.post('/auth/request-otp-for-delete', async (req, res) => {
    // `username` here is the target user's username (email), `userId` is the target user's UserID.
    const { username, userId, role } = req.body; // `role` here would be the role of the user being deactivated.

    console.log(`[request-otp-for-delete] Request received for userId: ${userId}, username: ${username}, role: ${role}`);

    try {
        // 1. Authenticate and Authorize the **Admin** making the request (Crucial for security)
        if (!req.session.loggedIn || req.session.user.Role !== 'ADMIN') {
            console.warn('[request-otp-for-delete] Unauthorized access attempt: Not logged in or not ADMIN.');
            return res.status(403).json({ error: 'Unauthorized: Only admins can request deactivation OTPs.' });
        }

        // 2. Validate the **target user** (the one to be deactivated) exists
        const [targetUsers] = await conPool.query(
            `SELECT UserID, Username, Email FROM user WHERE UserID = ? AND Username = ?`,
            [userId, username]
        );

        if (!targetUsers.length) {
            console.error(`[request-otp-for-delete] Target user not found for UserID: ${userId}, Username: ${username}`);
            return res.status(404).json({ error: 'Target user for deactivation not found.' });
        }

        const targetUser = targetUsers[0];
        if (!targetUser.Email) {
            console.error(`[request-otp-for-delete] Target user (UserID: ${userId}) has no associated email.`);
            return res.status(400).json({ error: 'Target user has no verified email for OTP.' });
        }

        // 3. Generate and store OTP for deactivation (using `targetUser.UserID` as key)
        const { otp, secret } = generateOTP(); // Ensure generateOTP returns both otp and secret

        // Store OTP keyed by the **TARGET USER'S** UserID
        // Using a Map for in-memory storage, for production consider Redis or similar.
        otpStore.set(targetUser.UserID, {
            secret,
            expires: Date.now() + OTP_CONFIG.step * 1000 // OTP_CONFIG.step is typically the OTP validity duration in seconds
        });
        console.log(`[request-otp-for-delete] OTP generated and stored in memory for target UserID: ${targetUser.UserID}. OTP expires at: ${new Date(otpStore.get(targetUser.UserID).expires)}`);

        // --- Optional: Store OTP in database (if you have an `otp_table`) ---
        // Ensure your `otp_table` has columns like `otp_code` (VARCHAR), `user_id` (INT), `created_at` (DATETIME)
        // Adjust column names as per your schema.
        try {
            await conPool.query(
                `INSERT INTO otp_table (otp_code, user_id, email, created_at) VALUES (?, ?, ?, NOW())`,
                [otp, targetUser.UserID, targetUser.Email]
            );
            console.log(`[request-otp-for-delete] OTP successfully inserted into otp_table for UserID: ${targetUser.UserID}`);
        } catch (dbError) {
            console.error('[request-otp-for-delete] DATABASE INSERT ERROR (Deactivation OTP):', dbError);
            // Decide how to handle this: If DB persistence is critical, you might want to `throw dbError`
            // and return an error response to the client. For now, it's logged but doesn't stop the flow.
        }

        // 4. Send OTP email to the **TARGET USER'S** email
        await sendOTPEmail(targetUser.Email, otp, 'DoctorSync Deactivation Verification');
        console.log(`[request-otp-for-delete] Deactivation OTP email sent to: ${targetUser.Email}`);

        res.status(200).json({ success: true, email: targetUser.Email });

    } catch (error) {
        console.error('[request-otp-for-delete] Deactivation OTP request error (overall):', error);
        res.status(500).json({ error: 'Failed to process deactivation OTP request due to a server error.' });
    }
});

// --- NEW: Verify OTP for User Deactivation Endpoint ---
router.post('/auth/verify-otp-for-delete', async (req, res) => {
    const { userId, otp } = req.body; // `userId` here is the target user's ID
    console.log(`[verify-otp-for-delete] Request received for userId: ${userId}, OTP: ${otp}`);

    try {
        // 1. Authenticate and Authorize the **Admin** making the request (Crucial for security)
        if (!req.session.loggedIn || req.session.user.Role !== 'ADMIN') {
            console.warn('[verify-otp-for-delete] Unauthorized access attempt: Not logged in or not ADMIN.');
            return res.status(403).json({ error: 'Unauthorized: Only admins can verify deactivation OTPs.' });
        }

        // 2. Retrieve stored OTP using the **TARGET USER'S** UserID
        const storedData = otpStore.get(userId);

        if (!storedData) {
            console.error(`[verify-otp-for-delete] No OTP found in store for UserID: ${userId}.`);
            return res.status(400).json({ error: 'No OTP found for this deactivation request or it has expired. Please request a new one.' });
        }

        // 3. Check OTP expiration
        if (Date.now() > storedData.expires) {
            otpStore.delete(userId); // Clear expired OTP
            console.warn(`[verify-otp-for-delete] OTP expired for UserID: ${userId}.`);
            return res.status(401).json({ error: 'Verification code expired. Please request a new one.' });
        }

        // 4. Verify the OTP code using the stored secret
        const isValid = verifyOTP(otp, storedData.secret); // Ensure verifyOTP function is correct
        if (!isValid) {
            console.warn(`[verify-otp-for-delete] Invalid OTP provided for UserID: ${userId}. OTP: ${otp}`);
            return res.status(401).json({ error: 'Invalid verification code.' });
        }

        // 5. If OTP is valid, clear it to prevent reuse and for security
        otpStore.delete(userId);
        console.log(`[verify-otp-for-delete] OTP successfully verified and cleared for UserID: ${userId}.`);

        // 6. Return success. The frontend will then proceed with the actual DELETE request.
        res.status(200).json({ success: true, message: 'OTP verified successfully for deactivation.' });

    } catch (error) {
        console.error('[verify-otp-for-delete] Deactivation OTP verification error (overall):', error);
        return res.status(500).json({ error: 'Deactivation OTP verification failed due to a server error.' });
    }
});

// --- Login/Signup/Logout Routes (assuming these are working correctly) ---
router.get('/logout', logout);
router.post('/login', doLogin);
router.post('/signup', createUser);

module.exports = router;