// Importing required modules
const { conPool } = require('../config/dbHandler'); // importing conpool for DB operations
const md5 = require('md5'); // for hashing passwords
const { sendResponse } = require('./helperAuth'); // helper func

// Update the createUser function to include Qualifications
const createUser = async (req, res) => {
    const { 
        Username, Email, Password, Role, AdminCode,
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

        // Insert into USER table
        const [userResult] = await connection.query(
            `INSERT INTO user (Username, Email, Password, Role, AdminCode, CreatedAt)
             VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`,
            [Username, Email, md5(Password), Role, Role === 'ADMIN' ? AdminCode : null]
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
        const { Username, Password, Role, adminCode } = req.body;

        // Basic validation
        if (!Username || !Password || !Role) {
            return res.render('dashboard/login', {
                error: 'All fields are required'
            });
        }

        // Admin code validation
        if (Role === 'ADMIN' && adminCode !== '007') {
            return res.render('dashboard/login', {
                error: 'Invalid admin code'
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

        // Set up session
        req.session.user = {
            UserID: users[0].UserID,
            Username: users[0].Username,
            Role: users[0].Role
        };

        // Role-based redirection
        switch (Role) {
            case 'ADMIN':
                const [userList] = await conPool.query('SELECT * FROM user');
                const [doctorList] = await conPool.query(`
                    SELECT d.*, u.Username 
                    FROM doctor d 
                    JOIN user u ON d.UserID = u.UserID 
                    WHERE u.Role = 'DOCTOR'
                `);
                const [patientList] = await conPool.query(`
                    SELECT p.*, u.Username 
                    FROM patient p 
                    JOIN user u ON p.UserID = u.UserID 
                    WHERE u.Role = 'PATIENT'
                `);

                return res.render('users/admin', {
                    user: req.session.user,
                    userList,
                    doctorList,
                    patientList
                });

            case 'DOCTOR':
                const [doctorData] = await conPool.query(
                    'SELECT * FROM doctor WHERE UserID = ?',
                    [req.session.user.UserID]
                );
                const [prescriptions] = await conPool.query(
                    'SELECT * FROM prescription WHERE DoctorID = ?',
                    [doctorData[0].DoctorID]
                );
                const [medicalRecords] = await conPool.query(
                    'SELECT * FROM MEDICAL_RECORD WHERE DoctorID = ?',
                    [doctorData[0].DoctorID]
                );
                const [doctorPatients] = await conPool.query(
                    'SELECT * FROM DOCTOR_PATIENT WHERE DoctorID = ?',
                    [doctorData[0].DoctorID]
                );

                return res.render('users/doctor', {
                    user: req.session.user,
                    currentDoctorID: doctorData[0].DoctorID,
                    prescriptions,
                    medicalRecords,
                    doctorPatients
                });

            case 'PATIENT':
                return res.render('users/patient', {
                    user: req.session.user
                });

            default:
                return res.render('dashboard/login', {
                    error: 'Invalid role'
                });
        }
    } catch (err) {
        console.error('Login error:', err);
        return res.render('dashboard/login', {
            error: 'Server error during login'
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
            res.redirect('/login');
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

module.exports = {
    createUser,
    doLogin,
    resetPass,
    logout
};
