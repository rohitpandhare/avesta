// Importing required modules
const { conPool } = require('../config/dbHandler'); // importing conpool for DB operations

// for signup
// userAuth.js
// for signup
const createUser = async (req, res) => {
    // Only destructure common fields initially
    const { Username, Email, Role } = req.body;

    // Base validation for common fields
    if (!Username || !Email || !Role) {
        return res.status(400).render('dashboard/signup', {
            error: "Username, Email, and Account Type are required.",
            role: Role || 'PATIENT', // Default to patient if role is missing for error re-render
            formData: req.body // Pass back submitted data to pre-fill form
        });
    }

    let queryColumns;
    let queryValues;

    // Role-specific validation and data collection
    if (Role === 'DOCTOR') {
        const { Name, Phone, LicenseNumber, Specialty, other_specialty, Qualifications } = req.body;

        // Server-side validation for required doctor fields
        if (!Name || !Phone || !LicenseNumber || !Qualifications || !Specialty) {
            return res.status(400).render('dashboard/signup', {
                error: "All doctor fields are required.",
                role: Role,
                formData: req.body
            });
        }
        
        // Handle 'Other' specialty logic for database insertion
        const actualSpecialty = (Specialty === 'Other') ? null : Specialty; // DB 'Specialty' column
        const actualOtherSpecialty = (Specialty === 'Other') ? other_specialty : null; // DB 'other_specialty' column
        
        // Additional validation if 'Other' specialty is selected but not specified
        if (Specialty === 'Other' && !other_specialty) {
            return res.status(400).render('dashboard/signup', {
                error: "Please specify the 'Other' specialty for doctors.",
                role: Role,
                formData: req.body
            });
        }

        queryColumns = ['UserID', 'Name', 'Phone', 'LicenseNumber', 'Specialty', 'other_specialty', 'Qualifications'];
        queryValues = [
            null, // Placeholder for UserID, which will be added after user insertion
            Name,
            Phone,
            LicenseNumber,
            actualSpecialty,
            actualOtherSpecialty,
            Qualifications
        ];

    } else if (Role === 'PATIENT') {
        const { Name, Phone, DOB, BloodGroup, Address, MedicalHistory, EmergencyContact, EmergencyPhone, AadharID } = req.body;

        // Server-side validation for required patient fields
        if (!Name || !Phone || !DOB || !BloodGroup || !Address || !MedicalHistory || !EmergencyContact || !EmergencyPhone || !AadharID) {
            return res.status(400).render('dashboard/signup', {
                error: "All patient fields are required.",
                role: Role,
                formData: req.body
            });
        }

        queryColumns = ['UserID', 'Name', 'Phone', 'DOB', 'BloodGroup', 'Address', 'MedicalHistory', 'EmergencyContact', 'EmergencyPhone', 'AadharID'];
        queryValues = [
            null, // Placeholder for UserID
            Name,
            Phone,
            DOB,
            BloodGroup,
            Address,
            MedicalHistory,
            EmergencyContact,
            EmergencyPhone,
            AadharID
        ];

    } else {
        // Handle case where an invalid role is somehow sent
        return res.status(400).render('dashboard/signup', {
            error: "Invalid account role specified.",
            role: Role || 'PATIENT',
            formData: req.body
        });
    }

    const connection = await conPool.getConnection();
    try {
        await connection.beginTransaction();

        // 1. Insert into USER table (common for both roles)
        const [userResult] = await connection.query(
            `INSERT INTO user (Username, Email, Role, CreatedAt)
             VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
            [Username, Email, Role]
        );
        const userId = userResult.insertId; // Get the auto-generated UserID

        // Update the UserID placeholder in the role-specific queryValues array
        queryValues[0] = userId;

        // 2. Insert role-specific data using dynamically built query
        await connection.query(
            `INSERT INTO ${Role.toLowerCase()} (${queryColumns.join(', ')}) VALUES (${queryColumns.map(() => '?').join(', ')})`,
            queryValues
        );

        await connection.commit(); // Commit the transaction if all inserts are successful

        // Set session data for the newly registered user
        req.session.user = {
            UserID: userId,
            Username,
            Role,
            profileComplete: true // Assuming profile is complete after signup
        };

        res.redirect(`/login`); // Redirect to login page after successful registration

    } catch (err) {
        await connection.rollback(); // Rollback transaction on error
        console.error("Signup error:", err); // Log the detailed error

        let errorMessage = "Registration failed. Please try again.";
        if (err.code === 'ER_DUP_ENTRY') {
            errorMessage = "Username or email already exists. Please choose a different one.";
        } else if (err.code === 'ER_DATA_TOO_LONG' || err.sqlState === '22001') {
            errorMessage = "One or more fields contain too much data. Please check your input length.";
        } else if (err.code === 'ER_TRUNCATED_WRONG_VALUE' || err.sqlState === '22007') {
            errorMessage = "Invalid data format for one or more fields (e.g., date, number). Please check your input.";
        }
        
        // Re-render the signup page with an error message and original form data
        res.status(400).render('dashboard/signup', { 
            error: errorMessage,
            role: Role, // Keep the selected role active
            formData: req.body // Pass back the submitted data to re-populate fields
        });
    } finally {
        connection.release(); // Always release the connection back to the pool
    }
};

// User login 
async function doLogin(req, res) {
    try {
        const { Username, Role } = req.body;

        // Basic validation
        if (!Username || !Role) {
            return res.render('dashboard/login', {
                error: 'All fields are required'
            });
        }

        // Query to find user
        const [users] = await conPool.query(
            'SELECT * FROM user WHERE Username = ?',
            [Username]
        );

        if (!users.length || users[0].Role !== Role) {
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
                        specialtyStats[spec].activePrescriptions = row.actibve;
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
                await new Promise((resolve, reject) => {
                    req.session.save((err) => {
                        if (err) reject(err);
                        resolve();
                    });
                });
                return res.redirect('/patient');
                
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
    logout
};
