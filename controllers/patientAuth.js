const {conPool } = require('../config/dbHandler')

async function getPatients (req, res) {
    try {
        if (req.session.user && req.session.user.Role === 'PATIENT') {
            // Get patientID
            const [patientData] = await conPool.query(
                'SELECT PatientID FROM patient WHERE UserID = ?',
                [req.session.user.UserID]
            );

            if (!patientData || patientData.length === 0) {
                throw new Error('Patient ID not found');
            }

            const patientID = patientData[0].PatientID;

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
                    [patientID]
                ),
                conPool.query(`
                    SELECT 
                        mr.*,
                        d.Name as DoctorName
                    FROM medical_record mr
                    LEFT JOIN doctor d ON mr.DoctorID = d.DoctorID
                    WHERE mr.PatientID = ?`,
                    [patientID]
                ),
                conPool.query(`
                    SELECT 
                        p.*,
                        d.Name as DoctorName
                    FROM prescription p
                    LEFT JOIN doctor d ON p.DoctorID = d.DoctorID
                    WHERE p.PatientID = ?`,
                    [patientID]
                )
            ]);

            res.render('users/patient', {
                user: req.session.user,
                currentPatientID: patientID,
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
};

async function viewPatients (req, res) {
    try {
        if (req.session.user && req.session.user.Role === 'PATIENT') {
            // Get patientID
            const [patientData] = await conPool.query(
                'SELECT PatientID FROM patient WHERE UserID = ?',
                [req.session.user.UserID]
            );

            if (!patientData || patientData.length === 0) {
                throw new Error('Patient ID not found');
            }

            const patientID = patientData[0].PatientID;

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
                    [patientID]
                ),
                conPool.query(`
                    SELECT 
                        mr.*,
                        d.Name as DoctorName
                    FROM medical_record mr
                    LEFT JOIN doctor d ON mr.DoctorID = d.DoctorID
                    WHERE mr.PatientID = ?`,
                    [patientID]
                ),
                conPool.query(`
                    SELECT 
                        p.*,
                        d.Name as DoctorName
                    FROM prescription p
                    LEFT JOIN doctor d ON p.DoctorID = d.DoctorID
                    WHERE p.PatientID = ?`,
                    [patientID]
                )
            ]);

            res.render('users/pat/viewDoc', {
                user: req.session.user,
                currentPatientID: patientID,
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
};

async function viewRecords (req, res) {
    try {
        if (req.session.user && req.session.user.Role === 'PATIENT') {
            // Get patientID
            const [patientData] = await conPool.query(
                'SELECT PatientID FROM patient WHERE UserID = ?',
                [req.session.user.UserID]
            );

            if (!patientData || patientData.length === 0) {
                throw new Error('Patient ID not found');
            }

            const patientID = patientData[0].PatientID;

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
                    [patientID]
                ),
                conPool.query(`
                    SELECT 
                        mr.*,
                        d.Name as DoctorName
                    FROM medical_record mr
                    LEFT JOIN doctor d ON mr.DoctorID = d.DoctorID
                    WHERE mr.PatientID = ?`,
                    [patientID]
                ),
                conPool.query(`
                    SELECT 
                        p.*,
                        d.Name as DoctorName
                    FROM prescription p
                    LEFT JOIN doctor d ON p.DoctorID = d.DoctorID
                    WHERE p.PatientID = ?`,
                    [patientID]
                )
            ]);

            res.render('users/pat/viewRec', {
                user: req.session.user,
                currentPatientID: patientID,
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
};

async function viewPrescriptions (req, res) {
    try {
        if (req.session.user && req.session.user.Role === 'PATIENT') {
            // Get patientID
            const [patientData] = await conPool.query(
                'SELECT PatientID FROM patient WHERE UserID = ?',
                [req.session.user.UserID]
            );

            if (!patientData || patientData.length === 0) {
                throw new Error('Patient ID not found');
            }

            const patientID = patientData[0].PatientID;

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
                    [patientID]
                ),
                conPool.query(`
                    SELECT 
                        mr.*,
                        d.Name as DoctorName
                    FROM medical_record mr
                    LEFT JOIN doctor d ON mr.DoctorID = d.DoctorID
                    WHERE mr.PatientID = ?`,
                    [patientID]
                ),
                conPool.query(`
                    SELECT 
                        p.*,
                        d.Name as DoctorName
                    FROM prescription p
                    LEFT JOIN doctor d ON p.DoctorID = d.DoctorID
                    WHERE p.PatientID = ?`,
                    [patientID]
                )
            ]);

            res.render('users/pat/viewPres', {
                user: req.session.user,
                currentPatientID: patientID,
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
};

// Function to get patient details for display/edit
async function getPatientDetails(req, res) {
    let patientIdToFetch;

    // Determine how to get the PatientID:
    // 1. If patient is logged in, use their UserID to find PatientID
    if (req.session.user && req.session.user.UserID) {
        // Assuming there's a PatientID linked to UserID in the 'patient' table
        try {
            const [patientUserLink] = await conPool.query(
                `SELECT PatientID FROM patient WHERE UserID = ? AND Flag = 0`,
                [req.session.user.UserID]
            );
            if (patientUserLink.length > 0) {
                patientIdToFetch = patientUserLink[0].PatientID;
            } else {
                return res.render('dashboard/patient', {
                    patient: null,
                    error: 'Patient profile not found for this user.',
                    user: req.session.user
                });
            }
        } catch (error) {
            console.error("Error linking UserID to PatientID:", error);
            return res.render('dashboard/patient', {
                patient: null,
                error: 'Database error finding patient profile.',
                user: req.session.user
            });
        }
    } else if (req.params.patientId) { // 2. If PatientID is passed as a route parameter (e.g., for admin)
        patientIdToFetch = req.params.patientId;
    } else {
        return res.render('dashboard/patient', {
            patient: null,
            error: 'No patient ID provided or user not logged in.',
            user: req.session.user
        });
    }

    try {
        const [patients] = await conPool.query(
            `SELECT 
                PatientID, UserID, Name, Address, Phone, DOB, BloodGroup, MedicalHistory, 
                EmergencyContact, EmergencyPhone, Flag, AadharID
             FROM patient 
             WHERE PatientID = ? AND Flag = 0`, // Ensure only active patients are fetched
            [patientIdToFetch]
        );

        if (patients.length > 0) {
            // Format DOB for HTML date input
            const patientData = patients[0];
            if (patientData.DOB) {
                patientData.DOB = new Date(patientData.DOB).toISOString().split('T')[0];
            }
            res.render('dashboard/patient', { patient: patientData, error: null, user: req.session.user });
        } else {
            res.render('dashboard/patient', { patient: null, error: 'Patient not found.', user: req.session.user });
        }
    } catch (err) {
        console.error('Error fetching patient details:', err);
        res.render('dashboard/patient', { patient: null, error: 'Database error, please try again later.', user: req.session.user });
    }
}

// Function to get all patient dashboard data (details, prescriptions, medical records, appointments)
async function getPatientDashboardData(req, res) {
    try {
        if (req.session.user && req.session.user.Role === 'PATIENT') {
            const userID = req.session.user.UserID;

            // Get patient data
            const [patientData] = await conPool.query(
                'SELECT * FROM patient WHERE UserID = ?',
                [userID]
            );

            // If patient profile not found, handle gracefully
            if (!patientData || patientData.length === 0) {
                return res.render('users/pat/viewRec', { // Corrected EJS path
                    user: req.session.user,
                    patient: null, // Pass null patient to avoid "patient is not defined"
                    doctorRelationships: [],
                    medicalRecords: [],
                    prescriptions: [],
                    error: 'Patient profile not found. Please ensure your profile is complete.'
                });
            }

            const patient = patientData[0]; // Assign to 'patient' variable as EJS expects

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
                    [patient.PatientID]
                ),
                conPool.query(`
                    SELECT
                        mr.*,
                        d.Name as DoctorName
                    FROM medical_record mr
                    LEFT JOIN doctor d ON mr.DoctorID = d.DoctorID
                    WHERE mr.PatientID = ?`,
                    [patient.PatientID]
                ),
                conPool.query(`
                    SELECT
                        p.*,
                        d.Name as DoctorName
                    FROM prescription p
                    LEFT JOIN doctor d ON p.DoctorID = d.DoctorID
                    WHERE p.PatientID = ?`,
                    [patient.PatientID]
                )
            ]);

            return res.render('users/pat/viewRec', { // Corrected EJS path
                user: req.session.user,
                patient: patient, // Ensure 'patient' variable is passed correctly
                doctorRelationships: doctorRelationships[0],
                medicalRecords: medicalRecords[0],
                prescriptions: prescriptions[0],
                success: req.session.success, // Pass any session success/error messages
                error: req.session.error
            });

        } else {
            // Not logged in or not a patient, redirect to login page
            res.redirect('/auth/login'); // Assuming this is your login route
        }
    } catch (err) {
        console.error('Error in getPatientDashboardData:', err);
        // Render with error information if something goes wrong during data fetching
        res.render('users/pat/viewRec', { // Corrected EJS path
            user: req.session.user,
            patient: null, // Pass null patient on error to prevent template crash
            doctorRelationships: [],
            medicalRecords: [],
            prescriptions: [],
            error: 'Error loading dashboard data: ' + err.message
        });
    }
}

// Function to update patient details (remains largely the same)
async function updatePatientDetails(req, res) {
    let patientIdToUpdate;
    let userId = req.session.user?.UserID; // Get UserID from session

    if (!userId) {
        return res.json({ success: false, message: 'User not logged in.' });
    }

    try {
        const [patientUserLink] = await conPool.query(
            `SELECT PatientID FROM patient WHERE UserID = ? AND Flag = 0`,
            [userId]
        );
        if (patientUserLink.length > 0) {
            patientIdToUpdate = patientUserLink[0].PatientID;
        } else {
            return res.json({ success: false, message: 'Patient profile not found for this user.' });
        }
    } catch (error) {
        console.error("Error linking UserID to PatientID for update:", error);
        return res.json({ success: false, message: 'Database error finding patient profile.' });
    }

    const {
        Name, Address, Phone, DOB, BloodGroup, MedicalHistory,
        EmergencyContact, EmergencyPhone
    } = req.body;

    // Basic validation
    if (!Name || !Address || !Phone || !DOB || !BloodGroup || !EmergencyContact || !EmergencyPhone) {
        return res.json({ success: false, message: 'All required fields must be filled.' });
    }

    try {
        const [result] = await conPool.query(
            `UPDATE patient SET
                Name = ?, Address = ?, Phone = ?, DOB = ?, BloodGroup = ?, MedicalHistory = ?,
                EmergencyContact = ?, EmergencyPhone = ?
             WHERE PatientID = ? AND Flag = 0`,
            [
                Name, Address, Phone, DOB, BloodGroup, MedicalHistory,
                EmergencyContact, EmergencyPhone, patientIdToUpdate
            ]
        );

        if (result.affectedRows > 0) {
            res.json({ success: true, message: 'Patient details updated successfully!' });
        } else {
            res.json({ success: false, message: 'Patient not found or no changes made.' });
        }
    } catch (err) {
        console.error('Error updating patient details:', err);
        res.json({ success: false, message: 'Database error, please try again later.' });
    }
}

module.exports ={
    getPatients,
    viewPatients,
    viewRecords,
    viewPrescriptions,
    getPatientDetails,
    updatePatientDetails,
     getPatientDashboardData
}
