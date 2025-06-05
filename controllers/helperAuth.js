const speakeasy = require('speakeasy');
const nodemailer = require('nodemailer');
const { conPool } = require('../config/dbHandler')
require('dotenv').config();

//Helper func 1
function grabHeaders(headerdata) { //grabbing parameter from header
    return headerdata.map(h => h.name); // Headerdata is array , where we use map  ( h) with h.name - return all names  in headerdata
}

//Helper func 2
function sendResponse(res, message = "Good-Going", data = {}, error = false, status = 200) {  //200 - http status code
    res.set('Access-Control-Allow-Credentials', true); // for coRs - allow credentials to include in cors req
    try {
        res.status(status); 
        res.json({
            message: message,
            data: data
        });
    } catch (error) {
        res.json({
            message: error.message,
            data: data
        });
    }
}

// OTP Configuration
const OTP_CONFIG = {
    step: 300, // 5-minute validity
    digits: 6,
    encoding: 'base32'
};

// Generate OTP
function generateOTP() {
    const secret = speakeasy.generateSecret({ length: 20 });
    const token = speakeasy.totp({
        secret: secret.base32,
        ...OTP_CONFIG
    });
    return { otp: token, secret: secret.base32 };
}

// Verify OTP
function verifyOTP(token, secret) {
    return speakeasy.totp.verify({
        secret: secret,
        token: token,
        ...OTP_CONFIG,
        window: 2 // Allow for a 2-step window (e.g., current time + 2 steps, or current time - 2 steps)
    });
}

// Email Transport
const emailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.userpro, // Use environment variable for email
        pass: process.env.pass
    }
});

// Send OTP Email
async function sendOTPEmail(email, otp) {
    try {
        await emailTransport.sendMail({
            from: '"OTP Service" <connect.doctorsync@gmail.com>',
            to: email,
            subject: 'Your Verification Code',
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
    } catch (error) {
        console.error('Email send error:', error);
        throw new Error('Failed to send verification email');
    }
}

// --- Send OTP Email ---
async function sendCustomOTPEmail(email, otp, subjectPrefix = 'Your Verification Code') {
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

const MASTER_EMAIL = process.env.MASTER_EMAIL;
const otpStore = new Map(); // Temporary in-memory

async function requestAdminOTP(req, res) {
    const { Username, Email } = req.body;

    if (!Username || !Email) {
        return res.status(400).render('secret/adminCreate', {
            error: 'Username and Email are required'
        });
    }

    try {
        const [existingUsers] = await conPool.query(
            'SELECT * FROM user WHERE Username = ? OR Email = ?',
            [Username, Email]
        );

        if (existingUsers.length > 0) {
            return res.status(400).render('secret/adminCreate', {
                error: 'An admin with this username or email already exists.'
            });
        }
    } catch (err) {
        console.error("DB check error:", err);
        return res.status(500).render('secret/adminCreate', {
            error: 'Server error during validation.'
        });
    }
    
    const { otp, secret } = generateOTP();
    otpStore.set(Username, { Username, Email, otp, secret, expires: Date.now() + 300000 });

    try {
        await emailTransport.sendMail({
            from: '"DoctorSync Master OTP" <connect.doctorsync@gmail.com>',
            to: MASTER_EMAIL,
            subject: 'Admin Creation Master OTP',
            html: `<p>Requested admin: <strong>${Username}</strong><br/>OTP: <strong>${otp}</strong> (expires in 5 min)</p>`
        });

        return res.render('secret/adminCreateVerify', { Username, Email });
    } catch (err) {
        console.error("OTP email error:", err);
        return res.status(500).render('secret/adminCreate', {
            error: 'Failed to send OTP'
        });
    }
}

async function verifyAdminOTP(req, res) {
    const { Username, Email, otp } = req.body;
    const stored = otpStore.get(Username);

    if (!stored || stored.Email !== Email || Date.now() > stored.expires) {
        return res.status(400).render('secret/adminCreateVerify', {
            error: 'OTP expired or invalid',
            Username,
            Email
        });
    }

    const isValid = verifyOTP(otp, stored.secret);
    if (!isValid) {
        return res.status(401).render('secret/adminCreateVerify', {
            error: 'Incorrect OTP',
            Username,
            Email
        });
    }

    const connection = await conPool.getConnection();
    try {
        await connection.beginTransaction();
        const [userResult] = await connection.query(
            `INSERT INTO user (Username, Email, Role, CreatedAt)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
            [Username, Email, 'ADMIN']
        );
        await connection.commit();
        otpStore.delete(Username);
        res.redirect('/adminLogin');
    } catch (err) {
        await connection.rollback();
        console.error("Admin create error:", err);
        res.status(400).render('secret/adminCreateVerify', {
            error: 'Could not create admin',
            Username,
            Email
        });
    } finally {
        connection.release();
    }
}

async function updateData(DoctorID) {
    // Fetch prescriptions
    const [prescriptions] = await conPool.query(
      `SELECT
          p.*,
          pat.Name AS PatientName
      FROM prescription p
      LEFT JOIN patient pat ON p.PatientID = pat.PatientID
      WHERE p.flag = 0 AND p.DoctorID = ?
      ORDER BY p.DateIssued DESC`,
      [DoctorID]
    );

    // Fetch doctor-patient relationships
    const [doctorPatients] = await conPool.query(
        `SELECT 
            dp.*,
            pat.Name AS PatientName,
            pat.DOB,
            pat.Phone,
            pat.BloodGroup
        FROM doctor_patient dp
        LEFT JOIN patient pat ON dp.PatientID = pat.PatientID
        WHERE dp.flag = 0 AND dp.DoctorID = ?`,
        [DoctorID]
    );

    // Fetch medical records
    const [medicalRecords] = await conPool.query(
        `SELECT 
            mr.*,
            pat.Name AS PatientName
        FROM medical_record mr
        LEFT JOIN patient pat ON mr.PatientID = pat.PatientID
        WHERE mr.flag = 0 AND mr.DoctorID = ?`,
        [DoctorID]
    );

    return { prescriptions, doctorPatients, medicalRecords };
}

// Helper function to get DoctorID, Email, and Username from UserID
async function getDocID(UserID) {
    try {
        const [doctorDetails] = await conPool.query(
            'SELECT d.DoctorID, u.Email, u.Username FROM doctor d JOIN user u ON d.UserID = u.UserID WHERE d.UserID = ?',
            [UserID]
        );

        if (!doctorDetails.length) {
            throw new Error('Doctor details not found for the provided UserID.');
        }

        const doctorID = doctorDetails[0].DoctorID;
        const doctorEmail = doctorDetails[0].Email;
        const username = doctorDetails[0].Username;

        return {
            doctorID,
            doctorEmail,
            username,
            fullDetails: doctorDetails[0],
        };
    } catch (error) {
        console.error('Error fetching doctor details in getDocID:', error);
        throw error;
    }
}

// Helper function to generate reference ID
function generateReferenceId() {
    const prefix = 'RX';
    const timestamp = Date.now().toString();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const uniqueId = timestamp.slice(-3) + randomNum;
    return `${prefix}${uniqueId}`;
}

module.exports = {
    grabHeaders,
    sendResponse,
    generateOTP,
    verifyOTP,
    sendOTPEmail,
    requestAdminOTP,
    verifyAdminOTP,
    emailTransport,
    updateData,
    getDocID,
    generateReferenceId,
    OTP_CONFIG,
    otpStore,
    sendCustomOTPEmail
};
