// auth.js
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
    // Add 'window' parameter to account for time drift
    return speakeasy.totp.verify({
        secret: secret,
        token: token,
        ...OTP_CONFIG,
        window: 2 // Allow for a 2-step window (e.g., current time + 2 steps, or current time - 2 steps)
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
                INSERT INTO otp_table (otp, email, byUser, secret, expires_at)
                VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))
            `, [otp, user.Email, username, secret, (Date.now() + OTP_CONFIG.step * 1000) / 1000]);
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
        let storedData = otpStore.get(username);

        // If not found in in-memory store, try fetching from the database
        if (!storedData) {
            console.log(`[verify-otp] OTP not found in memory, checking database for user: ${username}`);
            const [dbOtps] = await conPool.query(
                `SELECT secret, expires_at FROM otp_table WHERE byUser = ? ORDER BY expires_at DESC LIMIT 1`,
                [username] // Using username for login OTP verification lookup
            );

            if (dbOtps.length > 0) {
                const dbOtp = dbOtps[0];
                const expiresAtMillis = new Date(dbOtp.expires_at).getTime(); 
                storedData = { secret: dbOtp.secret, expires: expiresAtMillis, role: role }; // Reconstruct storedData
                otpStore.set(username, storedData); // Add back to in-memory store
                console.log(`[verify-otp] OTP found in database for user: ${username}. Expires at: ${new Date(storedData.expires)}`);
            } else {
                console.error(`[verify-otp] No OTP found in database for user: ${username}.`);
                return res.status(400).json({ error: 'No OTP found for this verification request or it has expired. Please request a new one.' });
            }
        }

        // Check if OTP exists and is for the correct role
        if (storedData.role !== role) {
            return res.status(400).json({ error: 'Invalid verification request or OTP not found.' });
        }

        // Check OTP expiration
        if (Date.now() > storedData.expires) {
            otpStore.delete(username); // Clear expired OTP from memory
            await conPool.query(`DELETE FROM otp_table WHERE byUser = ?`, [username]); // Clear from DB
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
        await conPool.query(`DELETE FROM otp_table WHERE byUser = ?`, [username]); // Clear from DB

        // JSON response expected by frontend for redirect
        return res.json({ success: true, redirectUrl: '/admin' });

    } catch (error) {
        console.error('Login verification error:', error);
        return res.status(500).json({ error: 'Login verification failed due to a server error.' });
    }
});


// --- Request OTP for User Deactivation Endpoint ---
router.post('/request-otp-for-delete', async (req, res) => {
    const { username, userId, role } = req.body;

    console.log(`[request-otp-for-delete] Request received for userId: ${userId}, username: ${username}, role: ${role}`);

    try {
        if (!req.session.loggedIn || req.session.user.Role !== 'ADMIN') {
            console.warn('[request-otp-for-delete] Unauthorized access attempt: Not logged in or not ADMIN.');
            return res.status(403).json({ error: 'Unauthorized: Only admins can request deactivation OTPs.' });
        }

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

        const { otp, secret } = generateOTP();

        console.log(`[request-otp-for-delete] Storing OTP with key (UserID): ${targetUser.UserID}`);
        otpStore.set(targetUser.UserID, {
            secret,
            expires: Date.now() + OTP_CONFIG.step * 1000 // In-memory expiration
        });
        console.log(`[request-otp-for-delete] OTP generated and stored in memory for target UserID: ${targetUser.UserID}. OTP expires at: ${new Date(otpStore.get(targetUser.UserID).expires)}`);

        try {
            // Delete any existing OTP for this user in the DB to ensure only one is active
            await conPool.query(`DELETE FROM otp_table WHERE byUser = ?`, [targetUser.UserID]);
            console.log(`[request-otp-for-delete] Cleared old OTPs from DB for UserID: ${targetUser.UserID}`);

            // Insert new OTP into database
            await conPool.query(
                `INSERT INTO otp_table (otp, email, byUser, secret, expires_at) VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))`,
                [otp, targetUser.Email, targetUser.UserID, secret, (Date.now() + OTP_CONFIG.step * 1000) / 1000] // Store expiration as Unix timestamp for SQL FROM_UNIXTIME
            );
            console.log(`[request-otp-for-delete] OTP successfully inserted into otp_table for UserID: ${targetUser.UserID}`);
        } catch (dbError) {
            console.error('[request-otp-for-delete] DATABASE INSERT ERROR (Deactivation OTP):', dbError);
            throw new Error('Failed to save OTP to database: ' + dbError.message);
        }
        
        await sendOTPEmail(targetUser.Email, otp, 'DoctorSync Deactivation Verification');
        console.log(`[request-otp-for-delete] Deactivation OTP email sent to: ${targetUser.Email}`);

        res.status(200).json({ success: true, email: targetUser.Email });

    } catch (error) {
        console.error('[request-otp-for-delete] Deactivation OTP request error (overall):', error);
        res.status(500).json({ error: 'Failed to process deactivation OTP request due to a server error.' });
    }
});

router.post('/verify-otp-for-delete', async (req, res) => {
    const { userId, otp } = req.body;
    console.log(`[verify-otp-for-delete] Request received for userId: ${userId}, OTP: ${otp}`);

    try {
        if (!req.session.loggedIn || req.session.user.Role !== 'ADMIN') {
            console.warn('[verify-otp-for-delete] Unauthorized access attempt: Not logged in or not ADMIN.');
            return res.status(403).json({ error: 'Unauthorized: Only admins can verify deactivation OTPs.' });
        }

        let storedData = otpStore.get(userId);
        console.log(`[verify-otp-for-delete] Initial check in in-memory store for key ${userId}:`, storedData ? 'Found' : 'Not Found');

        if (!storedData) {
            console.log(`[verify-otp-for-delete] OTP not found in memory, checking database for UserID: ${userId}`);
            const [dbOtps] = await conPool.query(
                `SELECT secret, expires_at FROM otp_table WHERE byUser = ? ORDER BY expires_at DESC LIMIT 1`,
                [userId]
            );

            if (dbOtps.length > 0) {
                const dbOtp = dbOtps[0];
                const expiresAtMillis = new Date(dbOtp.expires_at).getTime();
                storedData = { secret: dbOtp.secret, expires: expiresAtMillis };
                console.log(`[verify-otp-for-delete] OTP found in database for UserID: ${userId}. Expires at: ${new Date(storedData.expires)}`);
                otpStore.set(userId, storedData);
            } else {
                console.error(`[verify-otp-for-delete] No OTP found in database for UserID: ${userId}.`);
                return res.status(400).json({ error: 'No OTP found for this deactivation request or it has expired. Please request a new one.' });
            }
        }

        if (Date.now() > storedData.expires) {
            otpStore.delete(userId);
            await conPool.query(`DELETE FROM otp_table WHERE byUser = ?`, [userId]);
            console.warn(`[verify-otp-for-delete] OTP expired for UserID: ${userId}. Cleared from memory and DB.`);
            return res.status(401).json({ error: 'Verification code expired. Please request a new one.' });
        }

        // --- DETAILED LOGGING BEFORE VERIFICATION ---
        console.log(`[verify-otp-for-delete] Attempting to verify OTP for UserID: ${userId}`);
        console.log(`[verify-otp-for-delete] OTP received: ${otp}`);
        console.log(`[verify-otp-for-delete] Stored Secret: ${storedData.secret}`);
        console.log(`[verify-otp-for-delete] OTP Config: ${JSON.stringify(OTP_CONFIG)}`);
        console.log(`[verify-otp-for-delete] Current time (millis): ${Date.now()}`);
        console.log(`[verify-otp-for-delete] Expiration time (millis): ${storedData.expires}`);

        const isValid = verifyOTP(otp, storedData.secret);

        // --- LOG THE RESULT OF VERIFICATION ---
        console.log(`[verify-otp-for-delete] Speakeasy verification result: ${isValid}`);

        if (!isValid) {
            console.warn(`[verify-otp-for-delete] Invalid OTP provided for UserID: ${userId}. OTP: ${otp}`);
            return res.status(401).json({ error: 'Invalid verification code.' });
        }

        otpStore.delete(userId);
        await conPool.query(`DELETE FROM otp_table WHERE byUser = ?`, [userId]);
        console.log(`[verify-otp-for-delete] OTP successfully verified and cleared for UserID: ${userId} from memory and DB.`);

        res.status(200).json({ success: true, message: 'OTP verified successfully for deactivation.' });

    } catch (error) {
        console.error('[verify-otp-for-delete] Deactivation OTP verification error (overall):', error);
        return res.status(500).json({ error: 'Deactivation OTP verification failed due to a server error.' });
    }
});

// --- Request OTP for User Deactivation Endpoint ---
router.post('/request-otp-for-revive', async (req, res) => {
    const { username, userId, role } = req.body;

    console.log(`[request-otp-for-revive] Request received for userId: ${userId}, username: ${username}, role: ${role}`);

    try {
        if (!req.session.loggedIn || req.session.user.Role !== 'ADMIN') {
            console.warn('[request-otp-for-revive] Unauthorized access attempt: Not logged in or not ADMIN.');
            return res.status(403).json({ error: 'Unauthorized: Only admins can request deactivation OTPs.' });
        }

        const [targetUsers] = await conPool.query(
            `SELECT UserID, Username, Email FROM user WHERE UserID = ? AND Username = ?`,
            [userId, username]
        );

        if (!targetUsers.length) {
            console.error(`[request-otp-for-revive] Target user not found for UserID: ${userId}, Username: ${username}`);
            return res.status(404).json({ error: 'Target user for activation not found.' });
        }

        const targetUser = targetUsers[0];
        if (!targetUser.Email) {
            console.error(`[request-otp-for-revive] Target user (UserID: ${userId}) has no associated email.`);
            return res.status(400).json({ error: 'Target user has no verified email for OTP.' });
        }

        const { otp, secret } = generateOTP();

        console.log(`[request-otprevice] Storing OTP with key (UserID): ${targetUser.UserID}`);
        otpStore.set(targetUser.UserID, {
            secret,
            expires: Date.now() + OTP_CONFIG.step * 1000 // In-memory expiration
        });
        console.log(`[request-otp-for-revice] OTP generated and stored in memory for target UserID: ${targetUser.UserID}. OTP expires at: ${new Date(otpStore.get(targetUser.UserID).expires)}`);

        try {
            // Revive any existing OTP for this user in the DB to ensure only one is active
            await conPool.query(`DELETE FROM otp_table WHERE byUser = ?`, [targetUser.UserID]);
            console.log(`[request-otp-for-revice] Cleared old OTPs from DB for UserID: ${targetUser.UserID}`);

            // Insert new OTP into database
            await conPool.query(
                `INSERT INTO otp_table (otp, email, byUser, secret, expires_at) VALUES (?, ?, ?, ?, FROM_UNIXTIME(?))`,
                [otp, targetUser.Email, targetUser.UserID, secret, (Date.now() + OTP_CONFIG.step * 1000) / 1000] // Store expiration as Unix timestamp for SQL FROM_UNIXTIME
            );
            console.log(`[request-otp-for-revive] OTP successfully inserted into otp_table for UserID: ${targetUser.UserID}`);
        } catch (dbError) {
            console.error('[request-otp-for-revive] DATABASE INSERT ERROR (activation OTP):', dbError);
            throw new Error('Failed to save OTP to database: ' + dbError.message);
        }
        
        await sendOTPEmail(targetUser.Email, otp, 'DoctorSync activation Verification');
        console.log(`[request-otp-for-revive] activation OTP email sent to: ${targetUser.Email}`);

        res.status(200).json({ success: true, email: targetUser.Email });

    } catch (error) {
        console.error('[request-otp-for-revive] activation OTP request error (overall):', error);
        res.status(500).json({ error: 'Failed to process activation OTP request due to a server error.' });
    }
});

router.post('/verify-otp-for-revive', async (req, res) => {
    const { userId, otp } = req.body;
    console.log(`[verify-otp-for-revive] Request received for userId: ${userId}, OTP: ${otp}`);

    try {
        if (!req.session.loggedIn || req.session.user.Role !== 'ADMIN') {
            console.warn('[verify-otp-for-revive] Unauthorized access attempt: Not logged in or not ADMIN.');
            return res.status(403).json({ error: 'Unauthorized: Only admins can verify activation OTPs.' });
        }

        let storedData = otpStore.get(userId);
        console.log(`[verify-otp-for-revive] Initial check in in-memory store for key ${userId}:`, storedData ? 'Found' : 'Not Found');

        if (!storedData) {
            console.log(`[verify-otp-for-revive] OTP not found in memory, checking database for UserID: ${userId}`);
            const [dbOtps] = await conPool.query(
                `SELECT secret, expires_at FROM otp_table WHERE byUser = ? ORDER BY expires_at DESC LIMIT 1`,
                [userId]
            );

            if (dbOtps.length > 0) {
                const dbOtp = dbOtps[0];
                const expiresAtMillis = new Date(dbOtp.expires_at).getTime();
                storedData = { secret: dbOtp.secret, expires: expiresAtMillis };
                console.log(`[verify-otp-for-revive] OTP found in database for UserID: ${userId}. Expires at: ${new Date(storedData.expires)}`);
                otpStore.set(userId, storedData);
            } else {
                console.error(`[verify-otp-for-revive] No OTP found in database for UserID: ${userId}.`);
                return res.status(400).json({ error: 'No OTP found for this Activation request or it has expired. Please request a new one.' });
            }
        }

        if (Date.now() > storedData.expires) {
            otpStore.delete(userId);
            await conPool.query(`DELETE FROM otp_table WHERE byUser = ?`, [userId]);
            console.warn(`[verify-otp-for-revive] OTP expired for UserID: ${userId}. Cleared from memory and DB.`);
            return res.status(401).json({ error: 'Verification code expired. Please request a new one.' });
        }

        // --- DETAILED LOGGING BEFORE VERIFICATION ---
        console.log(`[verify-otp-for-revive] Attempting to verify OTP for UserID: ${userId}`);
        console.log(`[verify-otp-for-revive] OTP received: ${otp}`);
        console.log(`[verify-otp-revive] Stored Secret: ${storedData.secret}`);
        console.log(`[verify-otp-for-revive] OTP Config: ${JSON.stringify(OTP_CONFIG)}`);
        console.log(`[verify-otp-for-revive] Current time (millis): ${Date.now()}`);
        console.log(`[verify-otp-for-revive] Expiration time (millis): ${storedData.expires}`);

        const isValid = verifyOTP(otp, storedData.secret);

        // --- LOG THE RESULT OF VERIFICATION ---
        console.log(`[verify-otp-for-revive] Speakeasy verification result: ${isValid}`);

        if (!isValid) {
            console.warn(`[verify-otp-for-revive] Invalid OTP provided for UserID: ${userId}. OTP: ${otp}`);
            return res.status(401).json({ error: 'Invalid verification code.' });
        }

        otpStore.delete(userId);
        await conPool.query(`DELETE FROM otp_table WHERE byUser = ?`, [userId]);
        console.log(`[verify-otp-for-delete] OTP successfully verified and cleared for UserID: ${userId} from memory and DB.`);

        res.status(200).json({ success: true, message: 'OTP verified successfully for activation.' });

    } catch (error) {
        console.error('[verify-otp-for-revive] activation OTP verification error (overall):', error);
        return res.status(500).json({ error: 'activation OTP verification failed due to a server error.' });
    }
});

// --- Login/Signup/Logout Routes (assuming these are working correctly) ---
router.get('/logout', logout);
router.post('/login', doLogin);
router.post('/signup', createUser);

module.exports = router;