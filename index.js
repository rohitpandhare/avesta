const express = require('express');
const session = require('express-session');
const mysql = require('mysql2/promise');
const path = require('path');
const cors = require('cors');

const app = express();
const port = 3000;
const md5 = require('md5'); // for hashing passwords

// Database connection pool
const conPool = mysql.createPool({
    connectionLimit: 100,
    host: "localhost",
    user: 'root',
    password: 'root',
    database: "doctorsync_db",
    debug: false
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// CORS configuration
const corsOptions = {
    credentials: true,
    origin: ['http://localhost:3001', 'http://localhost:3005'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Session middleware
app.use(session({
    secret: 'rohitiscool',
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));

// Role check middleware
const checkRole = (roles = []) => {
    return (req, res, next) => {
        if (!req.session.loggedIn) {
            return res.redirect('/login');
        }
        if (!roles.includes(req.session.user.Role.toLowerCase())) {
            return res.status(403).render('error', {
                message: 'Access Denied'
            });
        }
        next();
    };
};

// Import auth controllers
const {
    doLogin,
    createUser,
    logout,
    resetPass
} = require('./controllers/userAuth');

// Auth Routes
app.post('/auth/login', doLogin);
app.post('/auth/signup', createUser);
app.get('/auth/logout', logout);
app.post('/reset', resetPass);

// Find All Doctors
app.get('/findDr', async (req, res) => {
    try {
        const [doctors] = await conPool.promise().query(`
            SELECT 
                DoctorID,
                Name,
                Specialty,
                Phone,
                LicenseNumber,
                Qualifications
            FROM DOCTOR
            ORDER BY Name
        `);

        res.render('dashboard/findDr', { doctors });
    } catch (err) {
        console.error('Error fetching doctors:', err);
        res.render('dashboard/findDr', { 
            doctors: [],
            error: 'Error retrieving doctor list'
        });
    }
});

// Search for Doctors
app.get('/findDr/search', async (req, res) => {
    try {
        const searchTerm = req.query.search || '';

        const [doctors] = await conPool.promise().query(`
            SELECT 
                DoctorID,
                Name,
                Specialty,
                Phone,
                LicenseNumber,
                Qualifications
            FROM DOCTOR 
            WHERE 
                Name LIKE ? 
                OR Specialty LIKE ?
        `, [`%${searchTerm}%`, `%${searchTerm}%`]);

        res.render('dashboard/findDr', { doctors });
    } catch (err) {
        console.error('Error searching doctors:', err);
        res.render('dashboard/findDr', { 
            doctors: [],
            error: 'Error searching doctors'
        });
    }
});

// View Prescription Form
app.get('/viewPres', (req, res) => {
    res.render('dashboard/viewPres');
});

// Handle Prescription Lookup
app.post('/viewPres', async (req, res) => {
    try {
        const refId = req.body.refId;

        const [prescriptions] = await conPool.promise().query(`
            SELECT 
                p.PrescriptionID, 
                p.DateIssued, 
                p.DiagnosisNotes, 
                p.Medicines, 
                p.Status, 
                p.GlobalReferenceID, 
                d.Name as DoctorName
            FROM PRESCRIPTION p
            JOIN DOCTOR d ON p.DoctorID = d.DoctorID
            WHERE p.GlobalReferenceID = ?
        `, [refId]);

        if (prescriptions.length === 0) {
            return res.render('dashboard/viewPres', { 
                error: 'No prescription found with this reference ID' 
            });
        }

        res.render('dashboard/viewPres', { prescription: prescriptions[0] });
    } catch (err) {
        console.error('Error fetching prescription:', err);
        res.render('dashboard/viewPres', { 
            error: 'Database error, please try again later' 
        });
    }
});

// Update basic routes to match dashboard paths
app.get('/', (req, res) => {
    res.render('dashboard/index');
});

app.get('/login', (req, res) => {
    res.render('dashboard/login');
});

app.get('/signup', (req, res) => {
    res.render('dashboard/signup');
});

app.get('/reset', (req, res) => {
    res.render('dashboard/resetPass');
});

// In publicRoutes.js or appropriate route file

// POST route for password reset
app.post('/reset', async (req, res) => {
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
});


// // Helper function to safely execute SQL with logging
// async function executeSqlWithLogging(connection, sql, params) {
//     try {
//         console.log('Executing SQL:', sql, 'with params:', params);
//         const [result] = await connection.query(sql, params);
//         console.log('SQL Result:', result);
//         return result;
//     } catch (err) {
//         console.error('SQL Error:', err);
//         throw err;
//     }
// }


// Admin routes


app.get('/admin', checkRole(['admin']), async (req, res) => {
    try {
        // Fetch all required data in parallel
        const [userList, doctorList, patientList] = await Promise.all([
            conPool.promise().query('SELECT UserID, Username, Email, Role, CreatedAt FROM user'),
            conPool.promise().query('SELECT DoctorID, Name, Specialty, Phone, LicenseNumber, Qualifications FROM doctor'),
            conPool.promise().query('SELECT PatientID, Name, Address, Phone, DOB, BloodGroup FROM patient')
        ]);

        res.render('users/admin', {
            user: req.session.user,
            userList: userList[0],
            doctorList: doctorList[0],
            patientList: patientList[0]
        });
    } catch (err) {
        console.error('Error fetching admin data:', err);
        res.status(500).render('users/admin', {
            user: req.session.user,
            userList: [],
            doctorList: [],
            patientList: [],
            error: 'Error loading data'
        });
    }
});

// DELETE user
app.delete('/admin/delete-user/:id', async (req, res) => {
    const userId = req.params.id;

    try {
        const [result] = await conPool.promise().query('DELETE FROM USER WHERE UserID = ?', [userId]);

        if (result.affectedRows > 0) {
            res.status(200).json({ success: true, message: 'User deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error deleting user' });
    }
});

// DELETE doctor
app.delete('/admin/delete-doctor/:id', async (req, res) => {
    const doctorId = req.params.id;
    
    try {
        const connection = await conPool.promise().getConnection();
        await connection.beginTransaction();

        const [doctorData] = await connection.query(
            'SELECT UserID FROM DOCTOR WHERE DoctorID = ?',
            [doctorId]
        );

        if (!doctorData.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        const userId = doctorData[0].UserID;

        await connection.query('DELETE FROM DOCTOR WHERE DoctorID = ?', [doctorId]);
        await connection.query('DELETE FROM USER WHERE UserID = ?', [userId]);

        await connection.commit();
        res.json({ success: true, message: 'Doctor deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error deleting doctor' });
    }
});

// DELETE patient
app.delete('/admin/delete-patient/:id', async (req, res) => {
    const patientId = req.params.id;
    
    try {
        const connection = await conPool.promise().getConnection();
        await connection.beginTransaction();

        const [patientData] = await connection.query(
            'SELECT UserID FROM PATIENT WHERE PatientID = ?',
            [patientId]
        );

        if (!patientData.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        const userId = patientData[0].UserID;

        await connection.query('DELETE FROM PATIENT WHERE PatientID = ?', [patientId]);
        await connection.query('DELETE FROM USER WHERE UserID = ?', [userId]);

        await connection.commit();
        res.json({ success: true, message: 'Patient deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error deleting patient' });
    }
});



// User routes
app.get('/doctor', checkRole(['doctor']), async (req, res) => {
    try {
        const stats = {
            totalPatients: 0,
            upcomingAppointments: 0,
            recentAppointments: []
        };

        if (req.session.user && req.session.user.Role === 'doctor') {
            const [patientCount] = await conPool.promise().query(
                'SELECT COUNT(*) as count FROM user WHERE Role = "patient"'
            );
            const [appointmentCount] = await conPool.promise().query(
                'SELECT COUNT(*) as count FROM appointments WHERE doctor_id = ? AND appointment_date > NOW()',
                [req.session.user.UserID]
            );

            stats.totalPatients = patientCount[0].count;
            stats.upcomingAppointments = appointmentCount[0].count;
        }

        res.render('users/doctor', {
            user: req.session.user,
            stats: stats
        });
    } catch (err) {
        console.error('Error loading doctor dashboard:', err);
        res.render('users/doctor', {
            user: req.session.user,
            stats: {
                totalPatients: 0,
                upcomingAppointments: 0,
                recentAppointments: []
            }
        });
    }
});



app.post('/doctor/profile', checkRole(['doctor']),async (req, res) => {
    const userId = req.session.user.UserID;
    const { Name, Specialty, LicenseNumber, Qualifications, Phone } = req.body;

    try {
        const [result] = await conPool.query(
            `UPDATE DOCTOR SET 
                Name = ?, 
                Specialty = ?, 
                LicenseNumber = ?, 
                Qualifications = ?, 
                Phone = ?
             WHERE UserID = ?`,
            [Name, Specialty, LicenseNumber, Qualifications, Phone, userId]
        );

        // Update session
        req.session.user.profileComplete = true;
        res.redirect('/login');
    } catch (err) {
        console.error(err);
        res.render('dashboard/index', { 
            error: 'Failed to update profile',
            formData: req.body
        });
    }
});


app.get('/patient', checkRole(['patient']), (req, res) => {
    res.render('users/patient', { user: req.session.user });
});

app.post('/patient/profile', async (req, res) => {
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
        res.render('dashboard/singup', { 
            error: 'Failed to update profile',
            formData: req.body
        });
    }
});

// Logout route
app.get('/auth/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Failed to log out' });
        }
        res.redirect('/login');
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).render('error', {
        message: 'Internal Server Error'
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
