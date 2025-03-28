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
    saveUninitialized: true,
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
        const [doctors] = await conPool.query(`
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

        const [doctors] = await conPool.query(`
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

        const [prescriptions] = await conPool.query(`
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
        if (req.session.user && req.session.user.Role === 'DOCTOR') {
            // Get doctor details
            const [doctorDetails] = await conPool.query(
                'SELECT d.*, u.Name as Username, u.Email FROM doctor d JOIN user u ON d.UserID = u.UserID WHERE d.UserID = ?',
                [req.session.user.UserID]
            );

            if (!doctorDetails.length) {
                throw new Error('Doctor details not found');
            }

            const doctorID = doctorDetails[0].DoctorID;

            // Get prescriptions with patient names
            const [prescriptions] = await conPool.query(
                `SELECT 
                    p.*,
                    pat.Name AS PatientName
                FROM prescription p
                LEFT JOIN patient pat ON p.PatientID = pat.PatientID
                WHERE p.DoctorID = ?
                ORDER BY p.DateIssued DESC`,
                [doctorID]
            );

            // Get medical records with patient names
            const [medicalRecords] = await conPool.query(
                `SELECT 
                    mr.*,
                    pat.Name AS PatientName
                FROM medical_record mr
                LEFT JOIN patient pat ON mr.PatientID = pat.PatientID
                WHERE mr.DoctorID = ?
                ORDER BY mr.RecordDate DESC`,
                [doctorID]
            );

            // Get doctor patients with patient details
            const [doctorPatients] = await conPool.query(
                `SELECT 
                    dp.*,
                    pat.Name AS PatientName,
                    pat.Phone,
                    pat.DOB,
                    pat.BloodGroup
                FROM doctor_patient dp
                LEFT JOIN patient pat ON dp.PatientID = pat.PatientID
                WHERE dp.DoctorID = ?`,
                [doctorID]
            );

            // Merge doctor details with session user
            const userData = {
                ...req.session.user,
                ...doctorDetails[0]
            };

            res.render('users/doctor', {
                user: userData,
                currentDoctorID: doctorID,
                prescriptions: prescriptions,
                medicalRecords: medicalRecords,
                doctorPatients: doctorPatients,
                success: req.session.success,
                error: req.session.error,
                doctorRelationships: []
            });

            // Clear flash messages
            delete req.session.success;
            delete req.session.error;
        }
    } catch (err) {
        console.error('Error loading doctor dashboard:', err);
        res.render('users/doctor', {
            user: {
                ...req.session.user,
                Username: req.session.user.Name || 'Doctor' // Fallback name
            },
            currentDoctorID: null,
            prescriptions: [],
            medicalRecords: [],
            doctorPatients: [],
            error: 'Error loading dashboard: ' + err.message,
            doctorRelationships: []
        });
    }
});

app.post('/doctor/addPatient', async(req, res) => {
    try {
        // Get doctorID first
        const [realDocID] = await conPool.query(
            'SELECT DoctorID FROM doctor WHERE UserID = ?',
            [req.session.user.UserID]
        );

        const { PatientID, FirstConsultation, ConsultationType, TreatmentNotes } = req.body;

        // Insert the relationship
        await conPool.query(
            `INSERT INTO DOCTOR_PATIENT 
            (DoctorID, PatientID, FirstConsultation, ConsultationType, TreatmentNotes) 
            VALUES (?, ?, ?, ?, ?)`,
            [realDocID[0].DoctorID, PatientID, FirstConsultation, ConsultationType, TreatmentNotes]
        );

        // Set success message in session
        req.session.success = 'Patient relationship added successfully!';
        
        // Redirect back to doctor dashboard
        res.redirect('/doctor');

    } catch (err) {
        console.error('Error:', err);
        
        // Set error message in session
        req.session.error = 'Error adding patient relationship: ' + err.message;
        
        // Redirect back to doctor dashboard
        res.redirect('/doctor');
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

// Helper function to generate reference ID
function generateReferenceId() {
    const prefix = 'RX';
    const timestamp = Date.now().toString();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const uniqueId = timestamp.slice(-3) + randomNum;
    return `${prefix}${uniqueId}`;
}

app.post('/doctor/addPres', async (req, res) => {
    try {
        const {
            PatientID,
            DateIssued,
            DiagnosisNotes,
            Medicines,
            Status
        } = req.body;

        // Get DoctorID from session
        const DoctorID = req.session.user.DoctorID;

        // Add validation
        if (!PatientID || !DateIssued || !DiagnosisNotes || !Medicines || !Status) {
            throw new Error('All required fields must be filled');
        }

        if (!DoctorID) {
            throw new Error('Doctor ID not found in session');
        }

        // Generate GlobalReferenceID
        const GlobalReferenceID = generateReferenceId();

        // Set date to today if not provided
        const finalDateIssued = DateIssued || new Date().toISOString().split('T')[0];

        // Insert into database
        await conPool.query(
            `INSERT INTO prescription
            (PatientID, DoctorID, DateIssued, DiagnosisNotes, Medicines, Status, GlobalReferenceID)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [PatientID, DoctorID, finalDateIssued, DiagnosisNotes, Medicines, Status, GlobalReferenceID]
        );

        // Fetch all required data for the dashboard with patient information
        const [prescriptions] = await conPool.query(
            `SELECT 
                p.DateIssued,
                p.DiagnosisNotes,
                p.Medicines,
                p.Status,
                p.GlobalReferenceID,
                pat.Name AS PatientName
            FROM prescription p
            LEFT JOIN patient pat ON p.PatientID = pat.PatientID
            WHERE p.DoctorID = ?
            ORDER BY p.DateIssued DESC`,
            [DoctorID]
        );

        const [doctorPatients] = await conPool.query(
            'SELECT * FROM doctor_patient WHERE DoctorID = ?',
            [DoctorID]
        );

        const [medicalRecords] = await conPool.query(
            'SELECT * FROM medical_record WHERE DoctorID = ?',
            [DoctorID]
        );

        res.render('users/doctor', {
            success: 'Prescription added successfully!',
            prescriptions,
            doctorPatients,
            medicalRecords,
            user: req.session.user,
            doctorID: DoctorID,
            doctorRelationships: []
        });

    } catch (err) {
        console.error('Error:', err);
        
        try {
            const [prescriptions] = await conPool.query(
                `SELECT 
                    p.DateIssued,
                    p.DiagnosisNotes,
                    p.Medicines,
                    p.Status,
                    p.GlobalReferenceID,
                    pat.Name AS PatientName
                FROM prescription p
                LEFT JOIN patient pat ON p.PatientID = pat.PatientID
                WHERE p.DoctorID = ?
                ORDER BY p.DateIssued DESC`,
                [req.session.user.DoctorID]
            );

            const [doctorPatients] = await conPool.query(
                'SELECT * FROM doctor_patient WHERE DoctorID = ?',
                [req.session.user.DoctorID]
            );

            const [medicalRecords] = await conPool.query(
                'SELECT * FROM medical_record WHERE DoctorID = ?',
                [req.session.user.DoctorID]
            );

            res.render('users/doctor', {
                error: 'Error adding prescription: ' + err.message,
                prescriptions,
                doctorPatients,
                medicalRecords,
                user: req.session.user,
                doctorID: req.session.user.DoctorID,
                doctorRelationships: []
            });
        } catch (fetchError) {
            res.render('users/doctor', {
                error: 'Error: ' + err.message,
                prescriptions: [],
                doctorPatients: [],
                medicalRecords: [],
                user: req.session.user,
                doctorID: req.session.user.DoctorID,
                doctorRelationships: []
            });
        }
    }
});


app.post('/doctor/addMedRec', async (req,res) =>{
    try {
        const { PatientID, DoctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy } = req.body;

        await conPool.query(
            `INSERT INTO MEDICAL_RECORD 
            (PatientID, DoctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [PatientID, DoctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy]
        );

        res.render('users/doctor', { success: 'Medical record added successfully!' });
    } catch (err) {
        console.error('Error:', err);
        res.render('users/doctor', { 
            error: 'Error adding medical record: ' + err.message,
            user: req.session.user });
    }
})

app.get('/patient', checkRole(['patient']), async (req, res) => {
    try {
        if (req.session.user && req.session.user.Role === 'PATIENT') {
            // Get patientID
            const [patientData] = await conPool.query(
                'SELECT PatientID FROM patient WHERE UserID = ?',
                [req.session.user.UserID]
            );

            if (!patientData.length) {
                throw new Error('Patient ID not found');
            }

            // Get all data in parallel
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

            res.render('users/patient', {
                user: req.session.user,
                currentPatientID: patientData[0].PatientID,
                doctorRelationships: doctorRelationships[0],
                medicalRecords: medicalRecords[0],
                prescriptions: prescriptions[0],
                success: req.session.success,
                error: req.session.error
            });

            // Clear flash messages
            delete req.session.success;
            delete req.session.error;
        } else {
            res.redirect('/login');
        }
    } catch (err) {
        console.error('Error loading patient dashboard:', err);
        res.render('users/patient', {
            user: req.session.user,
            currentPatientID: null,
            doctorRelationships: [],
            medicalRecords: [],
            prescriptions: [],
            error: 'Error loading dashboard: ' + err.message
        });
    }
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

// GET route to display the form
app.get('/test-doctor-patient', (req, res) => {
    res.render('testDoctorPatient');
});

// POST route to handle form submission
app.post('/test-doctor-patient', async (req, res) => {
    try {
        const { DoctorID, PatientID, FirstConsultation, ConsultationType, TreatmentNotes } = req.body;

        await conPool.query(
            `INSERT INTO DOCTOR_PATIENT 
            (DoctorID, PatientID, FirstConsultation, ConsultationType, TreatmentNotes) 
            VALUES (?, ?, ?, ?, ?)`,
            [DoctorID, PatientID, FirstConsultation, ConsultationType, TreatmentNotes]
        );

        res.render('testDoctorPatient', { success: 'Data inserted successfully!' });
    } catch (err) {
        console.error('Error:', err);
        res.render('testDoctorPatient', { 
            error: 'Error inserting data: ' + err.message,
            ...req.body  // Sends back the form data in case of error
        });
    }
});


// Prescription Routes
app.get('/test-prescription', (req, res) => {
    res.render('testPrescription');
});

app.post('/test-prescription', async (req, res) => {
    try {
        const { PatientID, DoctorID, DateIssued, DiagnosisNotes, Medicines, Status, GlobalReferenceID } = req.body;

        await conPool.query(
            `INSERT INTO PRESCRIPTION 
            (PatientID, DoctorID, DateIssued, DiagnosisNotes, Medicines, Status, GlobalReferenceID) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [PatientID, DoctorID, DateIssued, DiagnosisNotes, Medicines, Status, GlobalReferenceID]
        );

        res.render('testPrescription', { success: 'Prescription added successfully!' });
    } catch (err) {
        console.error('Error:', err);
        res.render('testPrescription', { error: 'Error adding prescription: ' + err.message });
    }
});

// Medical Record Routes
app.get('/test-medical-record', (req, res) => {
    res.render('testMedicalRecord');
});

app.post('/test-medical-record', async (req, res) => {
    try {
        const { PatientID, DoctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy } = req.body;

        await conPool.query(
            `INSERT INTO MEDICAL_RECORD 
            (PatientID, DoctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [PatientID, DoctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy]
        );

        res.render('testMedicalRecord', { success: 'Medical record added successfully!' });
    } catch (err) {
        console.error('Error:', err);
        res.render('testMedicalRecord', { error: 'Error adding medical record: ' + err.message });
    }
});

app.get('/test-view-all', async (req, res) => {
    try {
        // Fetch all records from all three tables
        const [prescriptions] = await conPool.query('SELECT * FROM PRESCRIPTION ORDER BY DateIssued DESC');
        const [medicalRecords] = await conPool.query('SELECT * FROM MEDICAL_RECORD ORDER BY RecordDate DESC');
        const [doctorPatients] = await conPool.query('SELECT * FROM DOCTOR_PATIENT ORDER BY FirstConsultation DESC');

        res.render('testViewAllRecords', {
            prescriptions,
            medicalRecords,
            doctorPatients
        });
    } catch (err) {
        console.error('Error fetching records:', err);
        res.status(500).send('Error fetching records: ' + err.message);
    }
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
