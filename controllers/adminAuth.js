const { conPool } = require('../config/dbHandler')
const md5 = require('md5'); // for hashing passwords
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');

async function getAdmin(req, res) {
    try {
        const { Username, Password } = req.body;

        // Basic validation
        if (!Username || !Password) {
            return res.render('secret/adminLogin', {
                error: 'All fields are required'
            });
        }

        const hashedPassword = md5(Password);

        // Query to find user
        const [users] = await conPool.query(
            'SELECT * FROM user WHERE Username = ?',
            [Username]
        );
        Role = 'admin';

        if (!users.length || users[0].Password !== hashedPassword){
            return res.render('secret/adminLogin', {
                error: 'Invalid credentials'
            });
        }

        // Set up base session
        req.session.user = {
            UserID: users[0].UserID,
            Username: users[0].Username,
            Role: Role
        };

        const [userList, doctorList, patientList, prescriptionStats] = await Promise.all([
            conPool.query('SELECT * FROM user'),
            conPool.query(`
                SELECT d.*, u.Username
                FROM doctor d
                JOIN user u ON d.UserID = u.UserID
                WHERE u.Role = 'DOCTOR'
            `),
            conPool.query(`
                SELECT p.*, u.Username
                FROM patient p
                JOIN user u ON p.UserID = u.UserID
                WHERE u.Role = 'PATIENT'
            `),
            conPool.query(`
                SELECT 
                    d.Specialty, 
                    SUM(CASE WHEN p.Status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN p.Status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
                FROM 
                    prescription p
                JOIN 
                    doctor d ON p.DoctorID = d.DoctorID
                GROUP BY 
                    d.Specialty
            `)
        ]);
    
        // Process specialties data (same as in getAdmin)
        const specialtyStats = {};
        doctorList[0].forEach(doctor => {
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
    
        prescriptionStats[0].forEach(row => {
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
            userList: userList[0],
            doctorList: doctorList[0],
            patientList: patientList[0],
            specialties: specialties 
        });
        
    } catch (err) {
        console.error('Login error:', err);
        return res.render('secret/adminLogin', {
            error: 'Server error during login: ' + err.message
        });
    }
}

const MASTER_EMAIL = 'wroheet06@gmail.com';
const otpStore = new Map(); // Temporary in-memory

const OTP_CONFIG = {
    step: 300,
    digits: 6,
    encoding: 'base32'
};

const emailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'connect.doctorsync@gmail.com',
        pass: 'dklp rsru tpys agki'
    }
});

function generateOTP() {
    const secret = speakeasy.generateSecret({ length: 20 });
    const token = speakeasy.totp({
        secret: secret.base32,
        ...OTP_CONFIG
    });
    return { otp: token, secret: secret.base32 };
}

function verifyOTP(token, secret) {
    return speakeasy.totp.verify({
        secret: secret,
        token: token,
        ...OTP_CONFIG
    });
}

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
            `INSERT INTO user (Username, Email, Password, Role, CreatedAt)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [Username, Email, md5('NA'), 'ADMIN']
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

// DELETE user
async function deleteUser(req, res) {
    const userId = req.params.id;

    try {
        const [result] = await conPool.query(
            'UPDATE user SET Flag = 1 WHERE UserID = ?',
            [userId]
        );

        if (result.affectedRows > 0) {
             // Insert log into admin_activity table
             await conPool.query(
                'INSERT INTO admin_activity (AdminUserID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
                [req.session.user.UserID, 'DEACTIVATE', 'Admin deactivated user', 'USER', userId]
            );
            return res.status(200).json({ success: true, message: 'User soft deleted' });
        } else {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        console.error('DB delete error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

// DELETE doctor
async function deleteDoctor (req, res) {
    const doctorId = req.params.id;
    
    try {
        const [result] = await conPool.query(
            'UPDATE doctor SET Flag = 1 WHERE DoctorID = ?',
            [doctorId]
        );

        if (result.affectedRows > 0) {
            await conPool.query(
                'INSERT INTO admin_activity (AdminUserID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
                [req.session.user.UserID, 'DEACTIVATE', 'Admin deactivated doctor', 'DOCTOR', doctorId]
            );
            return res.status(200).json({ success: true, message: 'User soft deleted' });
        } else {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

    } catch (err) {
        console.error('DB delete error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

// DELETE patient
async function deletePatient (req, res) {
    const patientId = req.params.id;
    
    try {
        const [result] = await conPool.query(
            'UPDATE patient SET Flag = 1 WHERE PatientID = ?',
            [patientId]
        );

        if (result.affectedRows > 0) {
            // Insert log into admin_activity table
            await conPool.query(
                'INSERT INTO admin_activity (AdminUserID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
                [req.session.user.UserID, 'DEACTIVATE', 'Admin deactivated patient', 'PATIENT', patientId]
            );
            return res.status(200).json({ success: true, message: 'User soft deleted' });
        } else {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

    } catch (err) {
        console.error('DB delete error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


async function reviveUser(req, res) {
    const userId = req.params.id;

    try {
        const [result] = await conPool.query(
            'UPDATE user SET Flag = 0 WHERE UserID = ?',
            [userId]
        );

        if (result.affectedRows > 0) {
             // Insert log into admin_activity table
             await conPool.query(
                'INSERT INTO admin_activity (AdminUserID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
                [req.session.user.UserID, 'ACTIVATE', 'Admin Activated user', 'USER', userId]
            );
            return res.status(200).json({ success: true, message: 'User soft deleted' });
        } else {
            return res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        console.error('DB delete error:', err);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
}

module.exports = {
    requestAdminOTP,
    verifyAdminOTP,
    getAdmin,
    deleteUser,
    deleteDoctor,
    deletePatient,
    reviveUser
};


