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

const { 
    generateOTP,
    verifyOTP,
    OTP_CONFIG,
    otpStore,
    sendCustomOTPEmail} = require('../controllers/helperAuth');
    
// --- Doctor/Patient Routes (assuming these are working correctly) ---
router.get('/login/getRelation', getRel);
router.get('/login/getRecord', getRec);
router.get('/login/getPrescription', getPres);
router.get('/login/revivePres', getOldPres);

router.get('/login/addPrescription', addingPres);
router.get('/login/addRelation', addingRel);
router.get('/login/addRecord', addingRec);

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
            
        }

        console.log('Login OTP generated and stored in memory for user:', username);

        // Send OTP email
        await sendCustomOTPEmail(user.Email, otp, 'DoctorSync Login Verification');

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
    const { username, userId, role } = req.body; // 'username' is the doctor/patient's Name, 'userId' is their UserID

    console.log(`[request-otp-for-delete] Request received for userId: ${userId}, username: ${username}, role: ${role}`);

    try {
        if (!req.session.loggedIn || req.session.user.Role !== 'ADMIN') {
            console.warn('[request-otp-for-delete] Unauthorized access attempt: Not logged in or not ADMIN.');
            return res.status(403).json({ error: 'Unauthorized: Only admins can request deactivation OTPs.' });
        }

        const adminUserID = req.session.user.UserID;
        const adminEmail = req.session.user.Email;

        if (!adminEmail) {
            console.error("Logged-in admin's email not found in session.");
            return res.status(500).json({ error: 'Admin email not available in session for OTP.' });
        }

        const [targetUsers] = await conPool.query(
            `SELECT UserID, Username, Email FROM user WHERE UserID = ?`,
            [userId]
        );

        if (!targetUsers.length) {
            console.error(`[request-otp-for-delete] Target user not found for UserID: ${userId}.`);
            return res.status(404).json({ error: 'Target user for deactivation not found.' });
        }

        const targetUser = targetUsers[0]; // targetUser is now guaranteed to be defined here

        const { otp, secret } = generateOTP();

        const otpKey = `admin_delete_otp_${adminUserID}_${userId}`; // Unique key for this admin and target user
        console.log(`[request-otp-for-delete] Storing OTP with key: ${otpKey}`);
        otpStore.set(otpKey, {
            secret,
            targetUserID: userId, // Store the target user ID in memory for verification
            expires: Date.now() + OTP_CONFIG.step * 1000 // In-memory expiration
        });
        // --- FIX HERE: Use 'userId' (from req.body) instead of 'targetUser.UserID' for logging consistency and safety
        console.log(`[request-otp-for-delete] OTP generated and stored in memory for admin ${adminUserID} targeting UserID: ${userId}. OTP expires at: ${new Date(otpStore.get(otpKey).expires)}`);

        try {
            // Delete any existing OTP for this ADMIN from DB (since 'purpose' is not used)
            // Clear from DB for this specific admin, purpose, and target
            await conPool.query(`DELETE FROM otp_table WHERE byUser = ? AND purpose = ? AND target_user_id = ?`, [adminUserID, 'DEACTIVATION', userId]);

            console.log(`[request-otp-for-delete] Cleared old OTPs from DB for AdminUserID: ${adminUserID}.`);

            await conPool.query(
            `INSERT INTO otp_table (otp, email, byUser, secret, expires_at, purpose, target_user_id) VALUES (?, ?, ?, ?, FROM_UNIXTIME(?), ?, ?)`,
            [
                otp,
                adminEmail,
                adminUserID,
                secret,
                (Date.now() + OTP_CONFIG.step * 1000) / 1000,
                'DEACTIVATION', // New: purpose
                userId            // New: target_user_id
            ]
        );
            console.log(`[request-otp-for-delete] OTP successfully inserted into otp_table for AdminUserID: ${adminUserID}`);
        } catch (dbError) {
            console.error('[request-otp-for-delete] DATABASE INSERT ERROR (Deactivation OTP):', dbError);
            throw new Error('Failed to save OTP to database: ' + dbError.message);
        }
        
        await sendCustomOTPEmail(adminEmail, otp, `DoctorSync Deactivation OTP for User ID: ${userId} (${username})`);
        console.log(`[request-otp-for-delete] Deactivation OTP email sent to logged-in admin: ${adminEmail}`);

        res.status(200).json({ success: true, email: adminEmail, message: 'OTP sent to your email for verification.' });

    } catch (error) {
        console.error('[request-otp-for-delete] Deactivation OTP request error (overall):', error);
        res.status(500).json({ error: 'Failed to process deactivation OTP request due to a server error.' });
    }
});

router.post('/verify-otp-for-delete', async (req, res) => {
    const { userId, otp } = req.body; // userId here is the target user's ID
    console.log(`[verify-otp-for-delete] Request received for target userId: ${userId}, OTP: ${otp}`);

    try {
        if (!req.session.loggedIn || req.session.user.Role !== 'ADMIN') {
            console.warn('[verify-otp-for-delete] Unauthorized access attempt: Not logged in or not ADMIN.');
            return res.status(403).json({ error: 'Unauthorized: Only admins can verify deactivation OTPs.' });
        }

        const adminUserID = req.session.user.UserID; // Get the ID of the logged-in admin
        const otpPurpose = 'DEACTIVATION'; // Define the purpose for clarity

        // Construct the unique key used to store the OTP in memory for this admin and target user
        const otpKey = `admin_delete_otp_${adminUserID}_${userId}`;

        let storedData = otpStore.get(otpKey);
        console.log(`[verify-otp-for-delete] Checking in-memory store for key ${otpKey}:`, storedData ? 'Found' : 'Not Found');

        // If not found in memory, try fetching from the database
        if (!storedData) {
            console.warn(`[verify-otp-for-delete] OTP not in memory. Attempting to fetch from DB for admin ${adminUserID} targeting UserID: ${userId}.`);
            const [dbOtp] = await conPool.query(
                `SELECT otp, secret, expires_at FROM otp_table WHERE byUser = ? AND purpose = ? AND target_user_id = ? ORDER BY expires_at DESC LIMIT 1`,
                [adminUserID, otpPurpose, userId]
            );

            if (!dbOtp.length) {
                console.error(`[verify-otp-for-delete] No active OTP found in DB or memory for admin ${adminUserID} targeting UserID: ${userId}.`);
                return res.status(400).json({ error: 'No active OTP found for this deactivation request. Please request a new one.' });
            }

            // Check if the OTP from DB has expired
            const dbExpiresTime = new Date(dbOtp[0].expires_at).getTime();
            if (Date.now() > dbExpiresTime) {
                // Delete from DB if expired
                await conPool.query(`DELETE FROM otp_table WHERE byUser = ? AND purpose = ? AND target_user_id = ?`, [adminUserID, otpPurpose, userId]);
                console.warn(`[verify-otp-for-delete] OTP from DB expired for admin ${adminUserID} targeting UserID: ${userId}. Cleared from DB.`);
                return res.status(401).json({ error: 'Verification code expired. Please request a new one.' });
            }

            // Populate storedData from DB for verification
            storedData = {
                secret: dbOtp[0].secret,
                targetUserID: userId, // Re-confirm targetUserID
                expires: dbExpiresTime
            };
            // Optionally, add to otpStore for subsequent checks within this session
            otpStore.set(otpKey, storedData);
            console.log(`[verify-otp-for-delete] OTP successfully retrieved from DB and added to in-memory store.`);
        }

        // If found in memory, check its expiration (already handled if coming from DB, but good for direct memory hit)
        if (Date.now() > storedData.expires) {
            otpStore.delete(otpKey); // Delete from memory
            // Also delete from DB for this specific admin, purpose, and target, as it's expired
            await conPool.query(`DELETE FROM otp_table WHERE byUser = ? AND purpose = ? AND target_user_id = ?`, [adminUserID, otpPurpose, userId]);
            console.warn(`[verify-otp-for-delete] OTP expired for admin ${adminUserID} targeting UserID: ${userId}. Cleared from memory and DB.`);
            return res.status(401).json({ error: 'Verification code expired. Please request a new one.' });
        }

        // --- DETAILED LOGGING BEFORE VERIFICATION ---
        console.log(`[verify-otp-for-delete] Attempting to verify OTP for admin ${adminUserID} targeting UserID: ${storedData.targetUserID}`);
        console.log(`[verify-otp-for-delete] OTP received: ${otp}`);
        console.log(`[verify-otp-for-delete] Stored Secret: ${storedData.secret}`);
        console.log(`[verify-otp-for-delete] OTP Config: ${JSON.stringify(OTP_CONFIG)}`);
        console.log(`[verify-otp-for-delete] Current time (millis): ${Date.now()}`);
        console.log(`[verify-otp-for-delete] Expiration time (millis): ${storedData.expires}`);

        const isValid = verifyOTP(otp, storedData.secret);

        // --- LOG THE RESULT OF VERIFICATION ---
        console.log(`[verify-otp-for-delete] Speakeasy verification result: ${isValid}`);

        if (!isValid) {
            console.warn(`[verify-otp-for-delete] Invalid OTP provided for admin ${adminUserID} targeting UserID: ${storedData.targetUserID}. OTP: ${otp}`);
            return res.status(401).json({ error: 'Invalid verification code.' });
        }

        // OTP is valid. Proceed to deactivate the user.
        // Ensure the userId in req.body matches the targetUserID stored with the OTP
        if (userId !== storedData.targetUserID) {
            console.error(`[verify-otp-for-delete] Mismatch! OTP was for target user ${storedData.targetUserID}, but request is for ${userId}.`);
            // Clear the OTP if there's a security mismatch
            otpStore.delete(otpKey);
            await conPool.query(`DELETE FROM otp_table WHERE byUser = ? AND purpose = ? AND target_user_id = ?`, [adminUserID, otpPurpose, userId]);
            return res.status(400).json({ error: 'Security mismatch: The OTP provided is not for the specified user.' });
        }

        // --- Perform the deactivation logic here ---
        const [updateResult] = await conPool.query(
            'UPDATE user SET Flag = 1 WHERE UserID = ?', // Set Flag to 1 for deactivation
            [userId]
        );

        if (updateResult.affectedRows === 0) {
            console.warn(`[verify-otp-for-delete] User ${userId} not found or already deactivated.`);
            return res.status(404).json({ success: false, error: 'User not found or already deactivated.' });
        }

        // await conPool.query(
        //     'INSERT INTO admin_activity (AdminUserID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
        //     [adminUserID, 'DEACTIVATE', `Admin deactivated user ID ${userId}`, 'USER', userId]
        // );
        console.log(`[verify-otp-for-delete] User ${userId} deactivated (Flag = 1) successfully by Admin ${adminUserID}.`);
        // --- End deactivation logic ---

        otpStore.delete(otpKey); // Clear from memory
        // Clear from DB using the specific criteria
        await conPool.query(`DELETE FROM otp_table WHERE byUser = ? AND purpose = ? AND target_user_id = ?`, [adminUserID, otpPurpose, userId]);
        console.log(`[verify-otp-for-delete] OTP successfully verified and cleared for admin ${adminUserID} from memory and DB.`);

        res.status(200).json({ success: true, message: `OTP verified successfully. User ${userId} has been deactivated.` });

    } catch (error) {
        console.error('[verify-otp-for-delete] Deactivation OTP verification error (overall):', error);
        return res.status(500).json({ error: 'Deactivation OTP verification failed due to a server error.' });
    }
});

//////////
// --- Request OTP for User activation Endpoint ---
router.post('/request-otp-for-activate', async (req, res) => {
    const { username, userId, role } = req.body;

    console.log(`[request-otp-for-revive] Request received for userId: ${userId}, username: ${username}, role: ${role}`);

    try {
        if (!req.session.loggedIn || req.session.user.Role !== 'ADMIN') {
            console.warn('[request-otp-for-revive] Unauthorized access attempt: Not logged in or not ADMIN.');
            return res.status(403).json({ error: 'Unauthorized: Only admins can request deactivation OTPs.' });
        }

        // MODIFIED: Query only by UserID, as it's the unique identifier in the 'user' table
        const [targetUsers] = await conPool.query(
            `SELECT UserID, Username, Email FROM user WHERE UserID = ?`,
            [userId]
        );

        if (!targetUsers.length) {
            console.error(`[request-otp-for-revive] Target user not found for UserID: ${userId}.`);
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
            // await conPool.query(`DELETE FROM otp_table WHERE byUser = ?`, [targetUser.UserID]);
            // console.log(`[request-otp-for-revice] Cleared old OTPs from DB for UserID: ${targetUser.UserID}`);

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
        
        await sendCustomOTPEmail(targetUser.Email, otp, 'DoctorSync activation Verification');
        console.log(`[request-otp-for-revive] activation OTP email sent to: ${targetUser.Email}`);

        res.status(200).json({ success: true, email: targetUser.Email });

    } catch (error) {
        console.error('[request-otp-for-revive] activation OTP request error (overall):', error);
        res.status(500).json({ error: 'Failed to process activation OTP request due to a server error.' });
    }
});

router.post('/verify-otp-for-activate', async (req, res) => {
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