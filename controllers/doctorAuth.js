const { conPool } = require("../config/dbHandler");

async function updateData(DoctorID){
    // Fetch updated data
    const [prescriptions] = await conPool.query(
        `SELECT
            p.*,
            pat.Name AS PatientName
        FROM prescription p
        LEFT JOIN patient pat ON p.PatientID = pat.PatientID
        WHERE p.DoctorID = ?
        ORDER BY p.DateIssued DESC`,
        [DoctorID]
    );

    const [doctorPatients] = await conPool.query(
        `SELECT 
            dp.*,
            pat.Name AS PatientName
        FROM doctor_patient dp
        LEFT JOIN patient pat ON dp.PatientID = pat.PatientID
        WHERE dp.DoctorID = ?`,
        [DoctorID]
    );

    const [medicalRecords] = await conPool.query(
        `SELECT 
            mr.*,
            pat.Name AS PatientName
        FROM medical_record mr
        LEFT JOIN patient pat ON mr.PatientID = pat.PatientID
        WHERE mr.DoctorID = ?`,
        [DoctorID]
    );
    return { prescriptions,doctorPatients,medicalRecords };

}

async function getDocID(UserID) {
    // Get doctor details
    const [doctorDetails] = await conPool.query(
        'SELECT d.*, u.Username as Username, u.Email FROM doctor d JOIN user u ON d.UserID = u.UserID WHERE d.UserID = ?',
        [UserID]
``    );

    if (!doctorDetails.length) {
        throw new Error('Doctor details not found');
    }

    const doctorID = doctorDetails[0].DoctorID; 
    
    return {
        doctorID,
        doctorDetails: doctorDetails[0],
    };
}

// User routes
async function getDoctor (req, res){
    try {
        if (req.session.user && req.session.user.Role === 'DOCTOR') {
            // Get doctor details
           const {doctorID, doctorDetails} = await getDocID(req.session.user.UserID);

            //get updated data
            const {prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);

            const userData = {
                ...req.session.user,
                ...doctorDetails
            };

            res.render('users/doctor', {
                user: userData,
                DoctorID: doctorID,
                prescriptions: prescriptions,
                medicalRecords: medicalRecords,
                doctorPatients: doctorPatients,
                success: req.session.success,
                error: req.session.error,
                doctorRelationships: [],
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
        // Clear flash messages
        delete req.session.success;
        delete req.session.error;
    }
};

async function addPatient (req, res) {
    // doctorData = null
    try {
         // Get doctor details
        const {doctorID, doctorDetails} = await getDocID(req.session.user.UserID);
           
        let { PatientID,FirstConsultation, ConsultationType, TreatmentNotes } = req.body;
        
        // Set default date if not provided
        if (!FirstConsultation) {
            FirstConsultation = new Date().toISOString().split('T')[0];
        }
        
        // Validate patient exists
        const [patientExists] = await conPool.query(
            'SELECT PatientID FROM patient WHERE PatientID = ?',
            [PatientID]
        );
        
        if (!patientExists.length) {
            throw new Error('Patient not found');
        }
        
        // Check if relationship already exists
        const [existingRelation] = await conPool.query(
            'SELECT * FROM doctor_patient WHERE DoctorID = ? AND PatientID = ?',
            [doctorID, PatientID]
        );
        
        if (existingRelation.length > 0) {
            throw new Error('Relationship already exists');
        }
        
        // Insert the relationship
        await conPool.query(
            `INSERT INTO DOCTOR_PATIENT 
            (DoctorID, PatientID, FirstConsultation, ConsultationType, TreatmentNotes) 
            VALUES (?, ?, ?, ?, ?)`,
            [doctorID, PatientID, FirstConsultation, ConsultationType, TreatmentNotes]
        );
        
        //get updated data
        const {prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);
        
        res.render('users/doctor', {
            success: 'Patient relationship added successfully!',
            prescriptions,
            doctorPatients,
            medicalRecords,
            user: req.session.user,
            DoctorID: doctorID,  // Pass DoctorID directly
            doctorRelationships: []
        });

        // Clear flash messages
        delete req.session.success;
        delete req.session.error;

    } catch (err) {
        try {
             // Get doctor details
           const {doctorID, doctorDetails} = await getDocID(req.session.user.UserID);
           
           //get updated data
           const {prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);

            res.render('users/doctor', {
                error: 'Error adding patinet : ' + err.message,
                prescriptions,
                doctorPatients,
                medicalRecords,
                user: req.session.user,
                DoctorID: doctorID,  // Pass DoctorID directly
                doctorRelationships: []
            });
            // Clear flash messages
            delete req.session.success;
            delete req.session.error;

        } catch (fetchError) {
            res.render('users/doctor', {
                error: 'Error: ' + err.message,
                prescriptions: [],
                doctorPatients: [],
                medicalRecords: [],
                user: req.session.user,
                doctorID: null,
                doctorRelationships: []
            });
            // Clear flash messages
            delete req.session.success;
            delete req.session.error;
        }

    }
};

async function getDocProfile (req, res){
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
};

// Helper function to generate reference ID
function generateReferenceId() {
    const prefix = 'RX';
    const timestamp = Date.now().toString();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const uniqueId = timestamp.slice(-3) + randomNum;
    return `${prefix}${uniqueId}`;
}

async function addPrescription(req, res) {
    // let doctorData;
    try {
        // Get doctor details
        const {doctorID, doctorDetails} = await getDocID(req.session.user.UserID);

        const {
            PatientID,
            DateIssued,
            DiagnosisNotes,
            Medicines,
            Status
        } = req.body;

        // Add validation
        if (!PatientID || !DateIssued || !DiagnosisNotes || !Medicines || !Status) {
            throw new Error('All required fields must be filled');
        }

        // Generate GlobalReferenceID
        const GlobalReferenceID = generateReferenceId();

        // Set default date if not provided
        if (!DateIssued) {
            DateIssued = new Date().toISOString().split('T')[0];
        }

        // Insert into database
        await conPool.query(
            `INSERT INTO prescription
            (PatientID, DoctorID, DateIssued, DiagnosisNotes, Medicines, Status, GlobalReferenceID)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [PatientID, doctorID, DateIssued, DiagnosisNotes, Medicines, Status, GlobalReferenceID]
        );

       //get updated data
       const {prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);

        console.log("Received data:", req.body);

        res.render('users/doctor', {
            success: 'Prescription added successfully!',
            prescriptions,
            doctorPatients,
            medicalRecords,
            user: req.session.user,
            DoctorID: doctorID,  // Pass DoctorID directly
            doctorRelationships: []
        });
        // Clear flash messages
        delete req.session.success;
        delete req.session.error;

    } catch (err) {
        console.error('Error:', err);
        
        try {
                        
            // Get doctor details
            const {doctorID, doctorDetails} = await getDocID(req.session.user.UserID);
                    
            //get updated data
            const {prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);

            console.log("Received data:", req.body);

            res.render('users/doctor', {
                error: 'Error adding prescription: ' + err.message,
                prescriptions,
                doctorPatients,
                medicalRecords,
                user: req.session.user,
                DoctorID: doctorID,  // Pass DoctorID directly
                doctorRelationships: []
            });
            // Clear flash messages
            delete req.session.success;
            delete req.session.error;

        } catch (fetchError) {
            res.render('users/doctor', {
                error: 'Error: ' + err.message,
                prescriptions: [],
                doctorPatients: [],
                medicalRecords: [],
                user: req.session.user,
                doctorID: null,
                doctorRelationships: []
            });
            // Clear flash messages
            delete req.session.success;
            delete req.session.error;
        }
    }
}

async function addMedRecords (req,res) {
    // let doctorData; 
    try {
         // Get doctor details
        const {doctorID, doctorDetails} = await getDocID(req.session.user.UserID);
           
        
        const { PatientID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy } = req.body;

        // Add validation
        if (!PatientID || !Diagnosis || !Symptoms || !Treatments || !RecordDate || !Notes || !UpdatedBy) {
            throw new Error('All required fields must be filled');
        }

        // // Set default date if not provided
        if (!RecordDate) {
            RecordDate = new Date().toISOString().split('T')[0];
        }
         
         await conPool.query(
            `INSERT INTO medical_record 
            (PatientID, DoctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [PatientID, doctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy]
        );

        //get updated data
        const {prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);

        res.render('users/doctor', { 
            success: 'Medical record added successfully!',
            prescriptions,
            doctorPatients,
            medicalRecords,
            user: req.session.user,
            DoctorID: doctorID,
            doctorRelationships: []
        });
        // Clear flash messages
        delete req.session.success;
        delete req.session.error;

    } catch (err) {
        console.error('Error:', err);
        try{
             // Get doctor details
           const {doctorID, doctorDetails} = await getDocID(req.session.user.UserID);
           
           //get updated data
           const {prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);

        res.render('users/doctor', { 
                error:  'Error adding medical record: ' + err.message,
                prescriptions,
                doctorPatients,
                medicalRecords,
                user: req.session.user,
                DoctorID: doctorID,
                doctorRelationships: []
            });
            // Clear flash messages
            delete req.session.success;
            delete req.session.error;

        } catch (fetchError) {
            res.render('users/doctor', {
                error: 'Error: ' + err.message,
                prescriptions: [],
                doctorPatients: [],
                medicalRecords: [],
                user: req.session.user,
                doctorID: null,
                doctorRelationships: []
            });
            // Clear flash messages
            delete req.session.success;
            delete req.session.error;
        }
    }
};

module.exports ={
    getDoctor,
    getDocProfile,
    addPatient,
    addPrescription,
    addMedRecords
}

// const conPool = require('../config/dbHandler');
// const { sendResponse } = require('./helperAuth');


// /**
//  All task - 
//     updateProfile
	
// 	addPatient,

// 	getPatients,

// 	removePatient,
	
//     createPrescription,

//     updatePrescription,

//     deletePrescription,

//     getPrescriptionHistory,

//     createMedicalRecord,

//     getPatientMedicalHistory,
//  */

// //main task 
// function generateReferenceId() {
//     // Generate a prescription reference ID in format RX + 6 digits
//     const prefix = 'RX';
//     const timestamp = Date.now().toString();
//     const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
//     const uniqueId = timestamp.slice(-3) + randomNum;
//     return `${prefix}${uniqueId}`;
// }

// // Task 1 - view patients under doc
// async function getPatients(req, res) {
//     try {
//         const UserID = req.session.user.UserID; // Get the UserID from the session

//         // Fetch DoctorID using UserID
//         const [doctorResult] = await conPool.query('SELECT DoctorID FROM doctor WHERE UserID = ?', [UserID]);

//         if (!doctorResult || doctorResult.length === 0) {
//             return sendResponse(res, "Doctor not found", {}, true, 404);
//         }

//         const DoctorID = doctorResult[0].DoctorID;

//         // Fetch patients based on DoctorID
//         const [patients] = await conPool.query(
//             `SELECT 
//                 p.PatientID,
//                 p.Name, 
//                 p.Address, 
//                 p.Phone,
//                 p.DOB, 
//                 p.BloodGroup,
//                 p.MedicalHistory,
//                 dp.ConsultationType,
//                 dp.FirstConsultation,
//                 dp.TreatmentNotes
//             FROM patient p 
//             INNER JOIN doctor_patient dp ON p.PatientID = dp.PatientID 
//             WHERE dp.DoctorID = ?`,
//             [DoctorID]
//         );

//         sendResponse(res, "Patients fetched successfully", patients);
//     } catch (error) {
//         console.error(error);
//         sendResponse(res, "Error fetching patients", {}, true, 500);
//     }
// }

// // Task 2 - create prescription
// async function createPrescription(req, res) {
    
//     const { 
//         PatientID, 
//         DiagnosisNotes, 
//         Medicines
//     } = req.body;

//     // Get DoctorID from user session based on your auth approach
//     const user = req.session.user;

//     // First get the DoctorID from doctor table using UserID from session
//     const getDoctorIDQuery = 'SELECT DoctorID FROM doctor WHERE UserID = ?';
    

//     // Set current date for DateIssued
//     const DateIssued = new Date().toISOString().split('T')[0];
    
//     // Set initial status as 'ACTIVE'
//     const Status = 'ACTIVE';

//     // Generate a unique prescription reference ID
//     const GlobalReferenceID = generateReferenceId();

//     conPool.getConnection((err, connection) => {
//         if (err) {
//             return sendResponse(res, "Database connection error", { message: err.message }, true, 500);
//         }

//         connection.beginTransaction(err => {
//             if (err) {
//                 connection.release();
//                 return sendResponse(res, "Transaction error", { message: err.message }, true, 500);
//             }

//             // First get DoctorID
//             connection.query(getDoctorIDQuery, [user.UserID], (err, doctorResult) => {
//                 if (err) {
//                     connection.rollback(() => {
//                         connection.release();
//                         return sendResponse(res, "Error getting DoctorID", { message: err.message }, true, 500);
//                     });
//                     return;
//                 }

//                 if (!doctorResult || doctorResult.length === 0) {
//                     connection.rollback(() => {
//                         connection.release();
//                         return sendResponse(res, "Doctor not found", { message: "Invalid doctor account" }, true, 404);
//                     });
//                     return;
//                 }

//                 const DoctorID = doctorResult[0].DoctorID;

//                 // Now create the prescription
//                 const prescriptionQuery = `
//                     INSERT INTO PRESCRIPTION 
//                     (PatientID, DoctorID, DateIssued, DiagnosisNotes, Medicines, Status, GlobalReferenceID) 
//                     VALUES (?, ?, ?, ?, ?, ?, ?)
//                 `;

//                 connection.query(
//                     prescriptionQuery, 
//                     [PatientID, DoctorID,DateIssued, DiagnosisNotes, Medicines, Status, GlobalReferenceID],
//                     (err, result) => {
//                         if (err) {
//                             connection.rollback(() => {
//                                 connection.release();
//                                 return sendResponse(res, "Error creating prescription", { message: err.message }, true, 500);
//                             });
//                             return;
//                         }

//                         connection.commit(err => {
//                             if (err) {
//                                 connection.rollback(() => {
//                                     connection.release();
//                                     return sendResponse(res, "Error committing transaction", { message: err.message }, true, 500);
//                                 });
//                                 return;
//                             }

//                             connection.release();
//                             sendResponse(res, "Prescription created successfully", {
//                                 PrescriptionID: result.insertId,
//                                 GlobalReferenceID: GlobalReferenceID
//                             });
//                         });
//                     }
//                 );
//             });
//         });
//     });
        
// }

// // 3. Alter Prescription
// async function updatePrescription(req, res) {
//         try {
//             const { prescription_id, medicines, instructions, diagnosis } = req.body;
//             const doctorId = req.user.UserID;

//             const [result] = await pool.query(`
//                 UPDATE PRESCRIPTION 
//                 SET Medicines = ?, Instructions = ?, Diagnosis = ?
//                 WHERE PrescriptionID = ? AND DoctorID = ?
//             `, [JSON.stringify(medicines), instructions, diagnosis, prescription_id, doctorId]);

//             res.json({
//                 success: true,
//                 message: 'Prescription updated successfully'
//             });
//         } catch (error) {
//             console.error('Error updating prescription:', error);
//             res.status(500).json({
//                 success: false,
//                 message: 'Error updating prescription'
//             });
//         }
// }

// // 4. Delete Prescription
// async function deletePrescription(req, res) {
//     try {
//         const { prescription_id } = req.params;
//         const doctorId = req.user.UserID;

//         await pool.query(`
//             DELETE FROM PRESCRIPTION 
//             WHERE PrescriptionID = ? AND DoctorID = ?
//         `, [prescription_id, doctorId]);

//         res.json({
//             success: true,
//             message: 'Prescription deleted successfully'
//         });
//     } catch (error) {
//         console.error('Error deleting prescription:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error deleting prescription'
//         });
//     }
// }

// // 5. Delete Doctor-Patient Link
// async function removePatient(req, res) {
//     try {
//         const { patient_id } = req.params;
//         const doctorId = req.user.UserID;

//         await pool.query(`
//             DELETE FROM DOCTOR_PATIENT 
//             WHERE DoctorID = ? AND PatientID = ?
//         `, [doctorId, patient_id]);

//         res.json({
//             success: true,
//             message: 'Patient unlinked successfully'
//         });
//     } catch (error) {
//         console.error('Error unlinking patient:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error unlinking patient'
//         });
//     }
// }

// // 6. View Prescription History
// async function getPrescriptionHistory(req, res) {
//     try {
//         const doctorId = req.user.UserID;
//         const { patient_id, start_date, end_date } = req.query;

//         let query = `
//             SELECT p.*, pat.Name as PatientName 
//             FROM PRESCRIPTION p
//             INNER JOIN PATIENT pat ON p.PatientID = pat.PatientID
//             WHERE p.DoctorID = ?
//         `;
//         const params = [doctorId];

//         if (patient_id) {
//             query += ' AND p.PatientID = ?';
//             params.push(patient_id);
//         }
//         if (start_date && end_date) {
//             query += ' AND p.CreatedAt BETWEEN ? AND ?';
//             params.push(start_date, end_date);
//         }

//         const [prescriptions] = await pool.query(query, params);
//         res.json({
//             success: true,
//             data: prescriptions
//         });
//     } catch (error) {
//         console.error('Error fetching prescription history:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error fetching prescription history'
//         });
//     }
// }

// // 7. Create Medical Record
// async function createMedicalRecord(req, res) {
//     try {
//         const doctorId = req.user.UserID;
//         const { patient_id, diagnosis, treatment_plan, follow_up_date, notes } = req.body;

//         const [result] = await pool.query(`
//             INSERT INTO MEDICAL_RECORDS 
//             (DoctorID, PatientID, Diagnosis, TreatmentPlan, FollowUpDate, Notes)
//             VALUES (?, ?, ?, ?, ?, ?)
//         `, [doctorId, patient_id, diagnosis, treatment_plan, follow_up_date, notes]);

//         res.json({
//             success: true,
//             data: {
//                 record_id: result.insertId
//             }
//         });
//     } catch (error) {
//         console.error('Error creating medical record:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error creating medical record'
//         });
//     }
// }

// // 8. View Patient Medical History
// async function getPatientMedicalHistory(req, res) {
//     try {
//         const doctorId = req.user.UserID;
//         const { patient_id } = req.params;

//         // Get medical records
//         const [records] = await pool.query(`
//             SELECT * FROM MEDICAL_RECORDS 
//             WHERE DoctorID = ? AND PatientID = ?
//             ORDER BY CreatedAt DESC
//         `, [doctorId, patient_id]);

//         // Get prescriptions
//         const [prescriptions] = await pool.query(`
//             SELECT * FROM PRESCRIPTION 
//             WHERE DoctorID = ? AND PatientID = ?
//             ORDER BY CreatedAt DESC
//         `, [doctorId, patient_id]);

//         res.json({
//             success: true,
//             data: {
//                 medical_records: records,
//                 prescriptions: prescriptions
//             }
//         });
//     } catch (error) {
//         console.error('Error fetching patient medical history:', error);
//         res.status(500).json({
//             success: false,
//             message: 'Error fetching patient medical history'
//         });
//     }
// }

// // 9. Add Patient to Doctor
// async function addPatient(req, res) {
//     let connection;
//     try {
//         const { patient_id } = req.body;
//         const UserID = req.session.user.UserID;

//         // Validate input
//         if (!Number.isInteger(Number(patient_id))) {
//             return sendResponse(res, "Invalid patient ID format", {}, true, 400);
//         }

//         connection = await conPool.getConnection();

//         // 1. Get DoctorID with connection release safeguard
//         const [doctorResult] = await connection.query(
//             'SELECT DoctorID FROM doctor WHERE UserID = ?', 
//             [UserID]
//         );

//         if (!doctorResult.length) {
//             return sendResponse(res, "Doctor profile not found", {}, true, 404);
//         }
//         const DoctorID = doctorResult[0].DoctorID;

//         // 2. Verify Patient exists with name
//         const [patient] = await connection.query(
//             'SELECT PatientID, Name FROM patient WHERE PatientID = ?',
//             [patient_id]
//         );

//         if (!patient.length) {
//             return sendResponse(res, "Patient not found", {}, true, 404);
//         }

//         // 3. Check existing relationship
//         const [existing] = await connection.query(
//             `SELECT * FROM doctor_patient 
//              WHERE DoctorID = ? AND PatientID = ?`,
//             [DoctorID, patient_id]
//         );

//         if (existing.length > 0) {
//             return sendResponse(res, 
//                 `Patient ${patient[0].Name} already linked to your account`,
//                 {patientName: patient[0].Name}, 
//                 true, 
//                 400
//             );
//         }

//         // 4. Create relationship
//         await connection.query(
//             `INSERT INTO doctor_patient 
//              (DoctorID, PatientID, FirstConsultation, ConsultationType) 
//              VALUES (?, ?, CURDATE(), 'REGULAR')`,
//             [DoctorID, patient_id]
//         );

//         return sendResponse(res, "Patient added successfully", { 
//             doctorId: DoctorID,
//             patientId: patient_id,
//             patientName: patient[0].Name  // Include patient name in response
//         });

//     } catch (error) {
//         console.error('Add patient error:', error);
//         return sendResponse(res, "Database operation failed", {}, true, 500);
//     } finally {
//         if (connection) connection.release();
//     }
// }

// const verifyDoctor = async (req, res, next) => {
//     if (!req.session.user || req.session.user.Role !== 'DOCTOR') {
//         console.log('Blocked access for non-doctor:', req.session.user);
//         return res.status(403).redirect('/login');
//     }
//     next();
// };

// module.exports = {
//     getPatients,
//     createPrescription,
//     updatePrescription,
//     deletePrescription,
//     removePatient,
//     getPrescriptionHistory,
//     createMedicalRecord,
//     getPatientMedicalHistory,
//     addPatient,
//     generateReferenceId,
//     verifyDoctor
// };