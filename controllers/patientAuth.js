const { conPool } = require('../config/dbHandler');

// Helper function to fetch complete patient details by UserID
// This avoids duplicating the "SELECT PatientID, Name, Address, Phone, DOB, etc." query
async function getFullPatientProfileByUserID(userID) {
    const [patientInfo] = await conPool.query(
        `SELECT PatientID, UserID, Name, Address, Phone, DOB, BloodGroup, MedicalHistory,
                EmergencyContact, EmergencyPhone, Flag, AadharID
         FROM patient
         WHERE UserID = ? AND Flag = 0`,
        [userID]
    );
    return patientInfo.length > 0 ? patientInfo[0] : null;
}

// Existing functions (getPatients, viewPatients, viewPrescriptions)
// These are generally fine as they only need Name and PatientID for the sidebar/header.
// However, for consistency and to ensure the userForTemplate always has the correct Name,
// we'll update them to use the new helper function too.

async function getPatients(req, res) {
    try {
        if (req.session.user && req.session.user.Role === 'PATIENT') {
            const userId = req.session.user.UserID;

            // Use the helper function to get full patient data
            const patientProfile = await getFullPatientProfileByUserID(userId);

            if (!patientProfile) {
                throw new Error('Patient profile not found for the logged-in user.');
            }

            const patientID = patientProfile.PatientID;
            const patientName = patientProfile.Name;

            const userForTemplate = {
                ...req.session.user,
                Name: patientName,
                PatientID: patientID
            };

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
                userX: userForTemplate,
                currentPatientID: patientID,
                doctorRelationships: doctorRelationships[0],
                medicalRecords: medicalRecords[0],
                prescriptions: prescriptions[0],
                success: req.session.success,
                error: req.session.error
            });

            delete req.session.success;
            delete req.session.error;
        } else {
            res.redirect('/login');
        }
    } catch (err) {
        console.error('Error loading patient dashboard:', err);
        res.render('users/patient', {
            user: req.session.user || { Name: 'Guest', PatientID: 'PATIENT' },
            userX: req.session.user ? { ...req.session.user, Name: 'Unknown', PatientID: 'N/A' } : { Name: 'Guest', PatientID: 'N/A' },
            currentPatientID: null,
            doctorRelationships: [],
            medicalRecords: [],
            prescriptions: [],
            error: 'Error loading dashboard: ' + err.message
        });
    }
}

async function viewPatients(req, res) {
    try {
        if (req.session.user && req.session.user.Role === 'PATIENT') {
            const userId = req.session.user.UserID;
            const patientProfile = await getFullPatientProfileByUserID(userId);

            if (!patientProfile) {
                throw new Error('Patient profile not found');
            }

            const patientID = patientProfile.PatientID;
            const patientName = patientProfile.Name;

            const userForTemplate = {
                ...req.session.user,
                Name: patientName,
                PatientID: patientID
            };

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
                userX: userForTemplate,
                currentPatientID: patientID,
                doctorRelationships: doctorRelationships[0],
                medicalRecords: medicalRecords[0],
                prescriptions: prescriptions[0],
                success: req.session.success,
                error: req.session.error
            });

            delete req.session.success;
            delete req.session.error;
        } else {
            res.redirect('/login');
        }
    } catch (err) {
        console.error('Error loading doctors view for patient:', err);
        res.render('users/patient', { // Fallback to general patient dashboard on error
            user: req.session.user,
            userX: req.session.user ? { ...req.session.user, Name: 'Unknown', PatientID: 'N/A' } : { Name: 'Guest', PatientID: 'N/A' },
            currentPatientID: null,
            doctorRelationships: [],
            medicalRecords: [],
            prescriptions: [],
            error: 'Error loading doctors: ' + err.message
        });
    }
}

// *** MODIFIED FUNCTION ***
async function viewRecords(req, res) {
    try {
        if (req.session.user && req.session.user.Role === 'PATIENT') {
            const userId = req.session.user.UserID;

            // Fetch the full patient profile here
            const patientProfile = await getFullPatientProfileByUserID(userId);

            if (!patientProfile) {
                // If patient profile is not found, render with an error and no patient data
                return res.render('users/pat/viewRec', {
                    user: req.session.user,
                    userX: { ...req.session.user, Name: 'Unknown', PatientID: 'N/A' }, // Fallback for userX
                    patient: null, // Explicitly pass null for patient if not found
                    doctorRelationships: [],
                    medicalRecords: [],
                    prescriptions: [],
                    error: 'Patient profile not found. Please ensure your profile is complete.',
                    success: null
                });
            }

            const patientID = patientProfile.PatientID;
            const patientName = patientProfile.Name;

            const userForTemplate = {
                ...req.session.user,
                Name: patientName,
                PatientID: patientID
            };

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

            // Format DOB for HTML date input if it exists
            if (patientProfile.DOB) {
                patientProfile.DOB = new Date(patientProfile.DOB).toISOString().split('T')[0];
            }


            res.render('users/pat/viewRec', {
                user: req.session.user,
                userX: userForTemplate,
                currentPatientID: patientID,
                patient: patientProfile, // *** THIS IS THE KEY CHANGE: Pass the full patientProfile ***
                doctorRelationships: doctorRelationships[0],
                medicalRecords: medicalRecords[0],
                prescriptions: prescriptions[0],
                success: req.session.success,
                error: req.session.error
            });

            delete req.session.success;
            delete req.session.error;
        } else {
            res.redirect('/login');
        }
    } catch (err) {
        console.error('Error loading patient records:', err);
        res.render('users/pat/viewRec', {
            user: req.session.user,
            userX: req.session.user ? { ...req.session.user, Name: 'Unknown', PatientID: 'N/A' } : { Name: 'Guest', PatientID: 'N/A' },
            patient: null, // Pass null patient on error to prevent template crash
            currentPatientID: null,
            doctorRelationships: [],
            medicalRecords: [],
            prescriptions: [],
            error: 'Error loading records: ' + err.message
        });
    }
}

async function viewPrescriptions(req, res) {
    try {
        if (req.session.user && req.session.user.Role === 'PATIENT') {
            const userId = req.session.user.UserID;
            const patientProfile = await getFullPatientProfileByUserID(userId);

            if (!patientProfile) {
                throw new Error('Patient profile not found');
            }

            const patientID = patientProfile.PatientID;
            const patientName = patientProfile.Name;

            const userForTemplate = {
                ...req.session.user,
                Name: patientName,
                PatientID: patientID
            };

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
                userX: userForTemplate,
                currentPatientID: patientID,
                doctorRelationships: doctorRelationships[0],
                medicalRecords: medicalRecords[0],
                prescriptions: prescriptions[0],
                success: req.session.success,
                error: req.session.error
            });

            delete req.session.success;
            delete req.session.error;
        } else {
            res.redirect('/login');
        }
    } catch (err) {
        console.error('Error loading patient prescriptions:', err);
        res.render('users/patient', { // Fallback to general patient dashboard on error
            user: req.session.user,
            userX: req.session.user ? { ...req.session.user, Name: 'Unknown', PatientID: 'N/A' } : { Name: 'Guest', PatientID: 'N/A' },
            currentPatientID: null,
            doctorRelationships: [],
            medicalRecords: [],
            prescriptions: [],
            error: 'Error loading prescriptions: ' + err.message
        });
    }
}

// Function to get patient details for display/edit
async function getPatientDetails(req, res) {
    let patientIdToFetch;

    // Determine how to get the PatientID:
    // 1. If patient is logged in, use their UserID to find PatientID
    if (req.session.user && req.session.user.UserID) {
        try {
            const patientUserLink = await getFullPatientProfileByUserID(req.session.user.UserID); // Use helper
            if (patientUserLink) {
                patientIdToFetch = patientUserLink.PatientID;
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
        // Fetch the patient details directly using the helper to get the full profile
        const patientData = await getFullPatientProfileByUserID(req.session.user.UserID); // This line needs to be adjusted based on the above logic for patientIdToFetch

        // Re-fetch using patientIdToFetch if it's coming from req.params.patientId, otherwise patientData from getFullPatientProfileByUserID will be correct
        let finalPatientData;
        if (patientIdToFetch) {
            const [patients] = await conPool.query(
                `SELECT
                    PatientID, UserID, Name, Address, Phone, DOB, BloodGroup, MedicalHistory,
                    EmergencyContact, EmergencyPhone, Flag, AadharID
                 FROM patient
                 WHERE PatientID = ? AND Flag = 0`,
                [patientIdToFetch]
            );
            finalPatientData = patients.length > 0 ? patients[0] : null;
        } else {
            finalPatientData = null; // Should not happen with the checks above, but as a fallback
        }


        if (finalPatientData) {
            // Format DOB for HTML date input
            if (finalPatientData.DOB) {
                finalPatientData.DOB = new Date(finalPatientData.DOB).toISOString().split('T')[0];
            }
            res.render('dashboard/patient', { patient: finalPatientData, error: null, user: req.session.user });
        } else {
            res.render('dashboard/patient', { patient: null, error: 'Patient not found.', user: req.session.user });
        }
    } catch (err) {
        console.error('Error fetching patient details:', err);
        res.render('dashboard/patient', { patient: null, error: 'Database error, please try again later.', user: req.session.user });
    }
}


// *** MODIFIED FUNCTION ***
async function getPatientDashboardData(req, res) {
    try {
        if (req.session.user && req.session.user.Role === 'PATIENT') {
            const userID = req.session.user.UserID;

            // Fetch the full patient profile here
            const patientProfile = await getFullPatientProfileByUserID(userID);

            if (!patientProfile) {
                return res.render('users/pat/viewRec', { // Corrected EJS path
                    user: req.session.user,
                    userX: { ...req.session.user, Name: 'Unknown', PatientID: 'N/A' }, // Fallback for userX
                    patient: null, // Pass null patient to avoid "patient is not defined"
                    doctorRelationships: [],
                    medicalRecords: [],
                    prescriptions: [],
                    error: 'Patient profile not found. Please ensure your profile is complete.',
                    success: null
                });
            }

            const patientID = patientProfile.PatientID;
            const patientName = patientProfile.Name;

            const userForTemplate = {
                ...req.session.user,
                Name: patientName,
                PatientID: patientID
            };

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

            // Format DOB for HTML date input if it exists in the fetched profile
            if (patientProfile.DOB) {
                patientProfile.DOB = new Date(patientProfile.DOB).toISOString().split('T')[0];
            }

            return res.render('users/pat/viewRec', { // Corrected EJS path
                user: req.session.user,
                userX: userForTemplate,
                patient: patientProfile, // *** THIS IS THE KEY CHANGE: Pass the full patientProfile ***
                doctorRelationships: doctorRelationships[0],
                medicalRecords: medicalRecords[0],
                prescriptions: prescriptions[0],
                success: req.session.success,
                error: req.session.error
            });

        } else {
            res.redirect('/auth/login');
        }
    } catch (err) {
        console.error('Error in getPatientDashboardData:', err);
        res.render('users/pat/viewRec', { // Corrected EJS path
            user: req.session.user,
            userX: req.session.user ? { ...req.session.user, Name: 'Unknown', PatientID: 'N/A' } : { Name: 'Guest', PatientID: 'N/A' },
            patient: null, // Pass null patient on error to prevent template crash
            doctorRelationships: [],
            medicalRecords: [],
            prescriptions: [],
            error: 'Error loading dashboard data: ' + err.message
        });
    }
}

// Function to update patient details 
async function updatePatientDetails(req, res) {
    let patientIdToUpdate;
    let userId = req.session.user?.UserID;

    if (!userId) {
        return res.status(401).json({ success: false, message: 'User not logged in. Please log in again.' });
    }

    try {
        const patientUserLink = await getFullPatientProfileByUserID(userId);
        if (patientUserLink) {
            patientIdToUpdate = patientUserLink.PatientID;
        } else {
            return res.status(404).json({ success: false, message: 'Patient profile not found for this user.' });
        }
    } catch (error) {
        console.error("Error linking UserID to PatientID for update:", error);
        return res.status(500).json({ success: false, message: 'Database error finding patient profile. Please try again.' });
    }

    let { Name, Address, Phone, DOB, BloodGroup, MedicalHistory, EmergencyContact, EmergencyPhone, AadharID } = req.body;

    if (!Name || Name.trim() === '') {
        return res.status(400).json({ success: false, message: 'Name is a required field and cannot be empty.' });
    }
    if (!Address || Address.trim() === '') {
        return res.status(400).json({ success: false, message: 'Address is a required field and cannot be empty.' });
    }
    if (!Phone || Phone.trim() === '') {
        return res.status(400).json({ success: false, message: 'Phone is a required field and cannot be empty.' });
    }
    if (!DOB || DOB.trim() === '') {
        return res.status(400).json({ success: false, message: 'Date of Birth is a required field and cannot be empty.' });
    }
    if (!BloodGroup || BloodGroup.trim() === '') {
        return res.status(400).json({ success: false, message: 'Blood Group is a required field and cannot be empty.' });
    }
    if (!EmergencyContact || EmergencyContact.trim() === '') {
        return res.status(400).json({ success: false, message: 'Emergency Contact Name is a required field and cannot be empty.' });
    }
    if (!EmergencyPhone || EmergencyPhone.trim() === '') {
        return res.status(400).json({ success: false, message: 'Emergency Phone is a required field and cannot be empty.' });
    }

    Name = Name.trim();
    Address = Address.trim();
    Phone = Phone.trim();
    BloodGroup = BloodGroup.trim();
    EmergencyContact = EmergencyContact.trim();
    EmergencyPhone = EmergencyPhone.trim();

    MedicalHistory = (MedicalHistory && MedicalHistory.trim() !== '') ? MedicalHistory.trim() : null;
    AadharID = (AadharID && AadharID.trim() !== '') ? AadharID.trim() : null;
    DOB = (DOB && DOB.trim() !== '') ? DOB.trim() : null;

    try {
        // Fetch the *current* patient data before the update to compare for logging
        const [currentPatientDataRows] = await conPool.query(
            `SELECT Name, Address, Phone, DOB, BloodGroup, MedicalHistory, EmergencyContact, EmergencyPhone, AadharID
             FROM patient WHERE PatientID = ? AND Flag = 0`,
            [patientIdToUpdate]
        );

        const currentPatientData = currentPatientDataRows.length > 0 ? currentPatientDataRows[0] : {};

        const [result] = await conPool.query(
            `UPDATE patient SET
                Name = ?, Address = ?, Phone = ?, DOB = ?, BloodGroup = ?, MedicalHistory = ?,
                EmergencyContact = ?, EmergencyPhone = ?, AadharID = ?
             WHERE PatientID = ? AND Flag = 0`,
            [
                Name, Address, Phone, DOB, BloodGroup, MedicalHistory,
                EmergencyContact, EmergencyPhone, AadharID, patientIdToUpdate
            ]
        );

        if (result.affectedRows > 0) {
            // After successful update, fetch the latest patient data from the DB
            const [updatedPatientRows] = await conPool.query(
                `SELECT PatientID, UserID, Name, Address, Phone, DOB, BloodGroup, MedicalHistory, EmergencyContact, EmergencyPhone, AadharID
                 FROM patient WHERE PatientID = ? AND Flag = 0`,
                [patientIdToUpdate]
            );

            if (updatedPatientRows.length > 0) {
                req.session.patient = updatedPatientRows[0];
            }

            // --- NEW PART: Log activity to patient_activity table, adjusted for your schema ---
            const actionPerformed = 'Profile Update'; // Matches your 'ActionPerformed' column
            let description = `Patient details updated for PatientID: ${patientIdToUpdate}. `;
            let changedFields = [];

            // Compare original vs. new values to build a more specific description
            if (currentPatientData.Name !== Name) changedFields.push(`Name changed from '${currentPatientData.Name}' to '${Name}'`);
            if (currentPatientData.Address !== Address) changedFields.push(`Address changed`);
            if (currentPatientData.Phone !== Phone) changedFields.push(`Phone changed`);
            // Note: DOB comparison might need careful handling if current DOB is a Date object and new DOB is a string
            if (currentPatientData.DOB && new Date(currentPatientData.DOB).toISOString().split('T')[0] !== DOB) changedFields.push(`DOB changed`);
            else if (!currentPatientData.DOB && DOB) changedFields.push(`DOB added`);
            if (currentPatientData.BloodGroup !== BloodGroup) changedFields.push(`Blood Group changed from '${currentPatientData.BloodGroup}' to '${BloodGroup}'`);
            if (currentPatientData.MedicalHistory !== MedicalHistory) changedFields.push(`Medical History changed`);
            if (currentPatientData.EmergencyContact !== EmergencyContact) changedFields.push(`Emergency Contact changed`);
            if (currentPatientData.EmergencyPhone !== EmergencyPhone) changedFields.push(`Emergency Phone changed`);
            if (currentPatientData.AadharID !== AadharID) changedFields.push(`Aadhar ID changed`);


            if (changedFields.length > 0) {
                description += `Changes: ${changedFields.join('; ')}.`;
            } else {
                description += `No specific field changes detected (data might be identical or only non-tracked fields changed).`;
            }

            const logActivityQuery = `
                INSERT INTO patient_activity (PatientID, ActionPerformed, Description, ActivityTimestamp)
                VALUES (?, ?, ?, NOW())
            `;
            // Use 'actionPerformed' and 'description' variables for the query
            await conPool.query(logActivityQuery, [patientIdToUpdate, actionPerformed, description]);
            // --- END NEW PART ---

            return res.status(200).json({ success: true, message: 'Patient details updated successfully!' });
        } else {
            return res.status(200).json({ success: false, message: 'No changes detected or patient not found.' });
        }
    } catch (err) {
        console.error('Error updating patient details or logging activity:', err);
        return res.status(500).json({ success: false, message: 'An internal server error occurred while updating patient details. Please try again later.' });
    }
}

module.exports = {
    getPatients,
    viewPatients,
    viewRecords,
    viewPrescriptions,
    getPatientDetails,
    updatePatientDetails,
    getPatientDashboardData
};