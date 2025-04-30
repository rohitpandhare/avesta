// Importing required modules
const { conPool } = require('../config/dbHandler'); // importing conpool for DB operations
const md5 = require('md5'); // for hashing passwords
// authController.js
const speakeasy = require('speakeasy');
const nodemailer = require('nodemailer');


// for signup
const createUser = async (req, res) => {
    const { 
        Username, Email, Password, Role,
        Name, Phone, DOB, BloodGroup,
        LicenseNumber, Specialty, other_specialty, Qualifications
    } = req.body;

    // Base validation
    if (!Username || !Email || !Password || !Role) {
        return res.status(400).render('dashboard/signup', {
            error: "All fields are required"
        });
    }

    const connection = await conPool.getConnection();
    try {
        await connection.beginTransaction();
        // const createdAt = new Date().toISOString().split('T')[0];

        // Insert into USER table
        const [userResult] = await connection.query(
            `INSERT INTO user (Username, Email, Password, Role, CreatedAt)
             VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [Username, Email, md5(Password), Role]
        );
        const userId = userResult.insertId;

        // Insert role-specific data
        if (Role === 'DOCTOR') {
            await connection.query(
                `INSERT INTO doctor (UserID, Name, Phone, LicenseNumber, Specialty, other_specialty, Qualifications)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [userId, Name, Phone, LicenseNumber, 
                 Specialty === 'Other' ? null : Specialty,
                 Specialty === 'Other' ? other_specialty : null,
                 Qualifications]
            );
        } else if (Role === 'PATIENT') {
            await connection.query(
                `INSERT INTO patient (UserID, Name, Phone, DOB, BloodGroup)
                 VALUES (?, ?, ?, ?, ?)`,
                [userId, Name, Phone, DOB, BloodGroup]
            );
        }

        await connection.commit();

        req.session.user = {
            UserID: userId,
            Username,
            Role,
            profileComplete: true
        };

        res.redirect(`/login`);

    } catch (err) {
        await connection.rollback();
        console.error("Signup error:", err);
        
        const errorMessage = err.code === 'ER_DUP_ENTRY' 
            ? "Username or email already exists" 
            : "Registration failed";
        
        res.status(400).render('dashboard/signup', { 
            error: errorMessage,
            role: Role 
        });
    } finally {
        connection.release();
    }
};

// User login 
async function doLogin(req, res) {
    try {
        const { Username, Password, Role } = req.body;

        // Basic validation
        if (!Username || !Password || !Role) {
            return res.render('dashboard/login', {
                error: 'All fields are required'
            });
        }

        const hashedPassword = md5(Password);

        // Query to find user
        const [users] = await conPool.query(
            'SELECT * FROM user WHERE Username = ?',
            [Username]
        );

        if (!users.length || users[0].Password !== hashedPassword || users[0].Role !== Role) {
            return res.render('dashboard/login', {
                error: 'Invalid credentials'
            });
        }

        // Set up base session
        req.session.user = {
            UserID: users[0].UserID,
            Username: users[0].Username,
            Role: users[0].Role
        };

        // Role-based redirection
        switch (Role) {
            case 'ADMIN':
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
                    specialties: specialties // MUST include this
                });

            case 'DOCTOR':
                try {
                    // Get doctor data
                    const [doctorData] = await conPool.query(
                        'SELECT * FROM doctor WHERE UserID = ?',
                        [req.session.user.UserID]
                    );

                    if (!doctorData.length) {
                        return res.render('dashboard/login', {
                            error: 'Doctor profile not found'
                        });
                    }

                    // Add DoctorID to session
                    req.session.user.DoctorID = doctorData[0].DoctorID;
                    req.session.user.Name = doctorData[0].Name;
                    // Get all required data in parallel with patient information
                    const [prescriptions, doctorPatients, medicalRecords] = await Promise.all([
                        conPool.query(
                            `SELECT 
                                p.*,
                                pat.Name AS PatientName
                            FROM prescription p
                            LEFT JOIN patient pat ON p.PatientID = pat.PatientID
                            WHERE p.DoctorID = ? 
                            ORDER BY p.DateIssued DESC`,
                            [doctorData[0].DoctorID]
                        ),
                        conPool.query(
                            `SELECT 
                                dp.*,
                                pat.Name AS PatientName,
                                pat.Phone,
                                pat.DOB,
                                pat.BloodGroup
                            FROM doctor_patient dp
                            LEFT JOIN patient pat ON dp.PatientID = pat.PatientID
                            WHERE dp.DoctorID = ?`,
                            [doctorData[0].DoctorID]
                        ),
                        conPool.query(
                            `SELECT 
                                mr.*,
                                pat.Name AS PatientName
                            FROM medical_record mr
                            LEFT JOIN patient pat ON mr.PatientID = pat.PatientID
                            WHERE mr.DoctorID = ?
                            ORDER BY mr.RecordDate DESC`,
                            [doctorData[0].DoctorID]
                        )
                    ]);

                    // Save session
                    await new Promise((resolve, reject) => {
                        req.session.save((err) => {
                            if (err) reject(err);
                            resolve();
                        });
                    });

                    // // Debug log
                    // console.log('Loaded prescriptions:', prescriptions[0]);
                    // console.log('Loaded patients:', doctorPatients[0]);
                    // console.log('Loaded records:', medicalRecords[0]);

                    return res.render('users/doctor', {
                        user: req.session.user,
                        prescriptions: prescriptions[0],
                        doctorPatients: doctorPatients[0],
                        medicalRecords: medicalRecords[0],
                        doctorRelationships: [],
                        success: req.session.success,
                        error: req.session.error,
                        Name: req.session.user.Name
                    });

                } catch (err) {
                    console.error('Error in doctor login:', err);
                    return res.render('users/doctor', {
                        user: req.session.user,
                        prescriptions: [],
                        doctorPatients: [],
                        medicalRecords: [],
                        doctorRelationships: [],
                        error: 'Error loading dashboard: ' + err.message
                    });
                }

            case 'PATIENT':
                try {
                    // Get patient data
                    const [patientData] = await conPool.query(
                        'SELECT * FROM patient WHERE UserID = ?',
                        [req.session.user.UserID]
                    );
            
                    if (!patientData.length) {
                        return res.render('dashboard/login', {
                            error: 'Patient profile not found'
                        });
                    }
            
                    // Add PatientID to session
                    req.session.user.PatientID = patientData[0].PatientID;
                    req.session.user.Name = patientData[0].Name;
            
                    // Get all required data in parallel
                    const [doctorRelationships, medicalRecords, prescriptions] = await Promise.all([
                        conPool.query(`
                            SELECT 
                                dp.*,
                                d.Name as DoctorName,
                                d.Specialty,
                                d.Phone as DoctorPhone
                            FROM doctor_patient dp
                            LEFT JOIN doctor d ON dp.DoctorID = d.DoctorID
                            WHERE dp.PatientID = ?`,
                            [patientData[0].PatientID]
                        ),
                        conPool.query(`
                            SELECT 
                                mr.*,
                                d.Name as DoctorName
                            FROM medical_record mr
                            LEFT JOIN doctor d ON mr.DoctorID = d.DoctorID
                            WHERE mr.PatientID = ?`,
                            [patientData[0].PatientID]
                        ),
                        conPool.query(`
                            SELECT 
                                p.*,
                                d.Name as DoctorName
                            FROM prescription p
                            LEFT JOIN doctor d ON p.DoctorID = d.DoctorID
                            WHERE p.PatientID = ?`,
                            [patientData[0].PatientID]
                        )
                    ]);
            
                    // Save session
                    await new Promise((resolve, reject) => {
                        req.session.save((err) => {
                            if (err) reject(err);
                            resolve();
                        });
                    });
            
                    return res.render('users/patient', {
                        user: req.session.user,
                        currentPatientID: patientData[0].PatientID,
                        patientData: patientData[0],
                        doctorRelationships: doctorRelationships[0],
                        medicalRecords: medicalRecords[0],
                        prescriptions: prescriptions[0],
                        success: req.session.success,
                        error: req.session.error,
                        Name: req.session.user.Name
                    });
            
                } catch (err) {
                    console.error('Error in patient login:', err);
                    return res.render('users/patient', {
                        user: req.session.user,
                        currentPatientID: null,
                        patientData: null,
                        doctorRelationships: [],
                        medicalRecords: [],
                        prescriptions: [],
                        error: 'Error loading dashboard: ' + err.message
                    });
                }
                
            default:
                return res.render('dashboard/login', {
                    error: 'Invalid role'
                });
        }
    } catch (err) {
        console.error('Login error:', err);
        return res.render('dashboard/login', {
            error: 'Server error during login: ' + err.message
        });
    }
}

// Reset Password Route
async function resetPass (req, res) {
      try {
            const { Username, newPassword, confirmPassword } = req.body;
    
            // Check if passwords match
            if (newPassword !== confirmPassword) {
                return res.status(400).render('dashboard/resetPass', {
                    error: 'Passwords do not match'
                });
            }
    
            // Hash the password using md5
            const hashedPassword = md5(newPassword);
    
            // Update password in database
            const [result] = await conPool.query(
                'UPDATE user SET Password = ? WHERE Username = ?',
                [hashedPassword, Username]
            );
    
            // Check if user was found and updated
            if (result.affectedRows > 0) {
                // res.redirect('/login');
                // res.render('dashboard/login', {
                //     success: 'Password Changed!'
                // });
                res.redirect('/login?success=Password Changed!');
    
            } else { 
                res.status(404).render('dashboard/resetPass', {
                    error: 'User not found'
                });
            }
    
        } catch (err) {
            console.error('Password reset error:', err);
            res.status(500).render('dashboard/resetPass', {
                error: 'Error in resetting password'
            });
        }
};

function logout(req, res){
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to log out' });
        }
        res.redirect('/'); // to index page
    });
};

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
        ...OTP_CONFIG
    });
}

// Email Transport
const emailTransport = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: 'connect.doctorsync@gmail.com',
        pass: 'dklp rsru tpys agki'
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

module.exports = {
    createUser,
    doLogin,
    resetPass,
    logout,
    generateOTP,
    verifyOTP,
    sendOTPEmail
};
