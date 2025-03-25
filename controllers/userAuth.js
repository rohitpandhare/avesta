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
            return res.status(400).render('dashboard/login', {
                error: 'All fields are required',
                username: Username,
                role: Role,
            });
        }

        // Admin code validation
        if (Role === 'ADMIN') {
            if (!adminCode || adminCode !== '007') {
                return res.status(401).render('dashboard/login', {
                    error: 'Invalid admin code',
                    username: Username,
                    role: Role,
                });
            }
        }

        const hashedPassword = md5(Password);

        // Query to find user
        const [users] = await conPool.query(
            'SELECT * FROM user WHERE Username = ?',
            [Username]
        );

        if (!users || users.length === 0) {
            return res.status(401).render('dashboard/login', {
                error: 'User not found',
                username: Username,
                role: Role
            });
        }

        const user = users[0];
        if (user.Password !== hashedPassword) {
            return res.status(401).render('dashboard/login', {
                error: 'Invalid password',
                username: Username,
                role: Role
            });
        }

        if (user.Role !== Role) {
            return res.status(401).render('dashboard/login', {
                error: 'Invalid role for this user',
                username: Username,
                role: Role
            });
        }

        // Set up session
        req.session.user = {
            UserID: user.UserID,
            Username: user.Username,
            Role: user.Role
        };

        // Role-based rendering
        switch (Role) {
            case 'ADMIN':
                // Fetch all required data for admin dashboard
                try {
                    // Get all users
                    const [userList] = await conPool.query('SELECT * FROM user');
                    
                    // Get all doctors with their details
                    const [doctorList] = await conPool.query(`
                        SELECT d.*, u.Username 
                        FROM doctor d 
                        JOIN user u ON d.UserID = u.UserID 
                        WHERE u.Role = 'DOCTOR'
                    `);
                    
                    // Get all patients with their details
                    const [patientList] = await conPool.query(`
                        SELECT p.*, u.Username 
                        FROM patient p 
                        JOIN user u ON p.UserID = u.UserID 
                        WHERE u.Role = 'PATIENT'
                    `);

                    return res.render('users/admin', {
                        user: req.session.user,
                        userList: userList,
                        doctorList: doctorList,
                        patientList: patientList,
                        error: null
                    });
                } catch (dataErr) {
                    console.error('Error fetching admin dashboard data:', dataErr);
                    return res.status(500).render('dashboard/login', {
                        error: 'Error loading admin dashboard',
                        username: Username,
                        role: Role
                    });
                }
            
            case 'DOCTOR':
                return res.render('users/doctor', {
                    user: req.session.user,
                    error: null
                });
            
            case 'PATIENT':
                return res.render('users/patient', {
                    user: req.session.user,
                    error: null
                });
            
            default:
                return res.render('dashboard/index', {
                    error: 'Invalid role specified'
                });
        }

    } catch (err) {
        console.error('Login error:', err);
        return res.status(500).render('dashboard/login', {
            error: 'Server error during login',
            username: req.body.Username,
            role: req.body.Role
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
