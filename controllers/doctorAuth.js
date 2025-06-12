// Add these imports at the top of your file
const nodemailer = require('nodemailer');
const speakeasy = require('speakeasy');
const { conPool } = require("../config/dbHandler");

const{ checkRequiredFields } = require('../middlware/dc_middleware');
const{updateData,getDocID, emailTransport, generateReferenceId,OTP_CONFIG} = require('../controllers/helperAuth');

// DELETE patient reln
async function deleteRelation(req, res) {
    try {
        const { doctorID } = await getDocID(req.session.user.UserID);
        const PatientID = req.params.id;

        if (!PatientID) {
            throw new Error('No patient found to delete.');
        }

        //trying to make the flag as 1 - inactive 
        const [result] = await conPool.query('UPDATE doctor_patient SET flag = 1 WHERE PatientID = ? AND DoctorID = ?', [PatientID, doctorID]);

        if (result.affectedRows > 0) {
            // Insert log into admin_activity table
            await conPool.query(
               'INSERT INTO doctor_activity (DoctorID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
               [doctorID, 'DEACTIVATE', 'Patient deactivated', 'PATIENT RELATION', PatientID]
           );
           return res.status(200).json({ success: true, message: 'Patient Deleted successfully!' });
       } else {
           return res.status(404).json({ success: false, message: 'Patient not found!' });
       }

    } catch (err) {
        console.error(err);
        // Send error response
        res.status(500).json({ success: false, message: 'Error deleting user' });
    } finally {
        // Clear flash messages
        delete req.session.success;
        delete req.session.error;
    }
}

// DELETE medicalRecords (soft delete) (CORRECTED)
async function deleteRecord(req, res) {
    try {
        const { doctorID } = await getDocID(req.session.user.UserID);
        const RecordID = req.params.id; // get id from URL parameter

        if (!doctorID) {
            return res.status(401).json({ success: false, message: 'Doctor ID not found in session.' });
        }

        // Attempt to soft delete the medical record
        const [result] = await conPool.query(
            `UPDATE medical_record SET flag = 1 WHERE RecordID = ? AND flag = 0`,
            [RecordID]
        );

        if (result.affectedRows > 0) {
            // Insert log into doctor_activity table
            // Corrected the parameters for the INSERT query
            await conPool.query(
                `INSERT INTO doctor_activity (DoctorID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)`,
                [doctorID, 'DEACTIVATE', `Medical Record ${RecordID} deactivated`, 'MEDICAL_RECORD', RecordID]
            );
            return res.status(200).json({ success: true, message: 'Medical Record Deactivated successfully!' });
        } else {
            return res.status(404).json({ success: false, message: 'Medical record not found or already deactivated.' });
        }

    } catch (err) {
        console.error('Error deactivating medical record:', err);
        res.status(500).json({ success: false, message: 'Error deactivating medical record' });
    }
}

// DELETE prescriptions (soft delete)
async function deletePres(req, res) {
    try {
        const { doctorID } = await getDocID(req.session.user.UserID);
        const PrescriptionID = req.params.id;

        if (!doctorID) {
            return res.status(401).json({ success: false, message: 'Doctor ID not found in session.' });
        }

        // Optional: First verify the prescription exists
        const [prescriptionExists] = await conPool.query(
            'SELECT PrescriptionID FROM prescription WHERE PrescriptionID = ?',
            [PrescriptionID]
        );

        if (!prescriptionExists.length) {
            return res.status(404).json({ success: false, message: 'Prescription not found.' });
        }

        // Attempt to soft delete the prescription
        // IMPORTANT: If your 'prescription' table DOES NOT HAVE a 'Status' column,
        // REMOVE 'Status = \'COMPLETED\'' from the line below.
        const [result] = await conPool.query(
            `UPDATE prescription SET flag = 1, Status = 'COMPLETED' WHERE PrescriptionID = ? AND flag = 0`,
            [PrescriptionID]
        );
        // Alternative if 'Status' column doesn't exist:
        // const [result] = await conPool.query(`UPDATE prescription SET flag = 1 WHERE PrescriptionID = ? AND flag = 0`, [PrescriptionID]);


        if (result.affectedRows > 0) {
            // Insert log into doctor_activity table
            await conPool.query(
                `INSERT INTO doctor_activity (DoctorID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)`,
                [doctorID, 'DEACTIVATE', `Prescription ${PrescriptionID} deactivated`, 'PRESCRIPTION', PrescriptionID]
            );
            return res.status(200).json({ success: true, message: 'Prescription Deactivated successfully!' });
        } else {
            return res.status(404).json({ success: false, message: 'Prescription not found or already deactivated.' });
        }

    } catch (err) {
        console.error('Error deactivating Prescription:', err);
        res.status(500).json({ success: false, message: 'Error deactivating Prescription' });
    }
}

// User routes
async function getDoctor(req, res) {
    try {
      if (req.session.user && req.session.user.Role === 'DOCTOR') {
        const { doctorID, doctorDetails } = await getDocID(req.session.user.UserID);
  
        // Get updated data
        const { prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);
  
        const userData = {
          ...req.session.user,
          doctorDetails
        };
  
        res.render('users/doctor', {
          user: userData,
          DoctorID: doctorID,
          prescriptions,
          medicalRecords,
          doctorPatients,
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
      // Clear flash messages
      delete req.session.success;
      delete req.session.error;
    }
  }

async function addPatient(req, res) {
    try {
        // Get doctor details
        const { doctorID } = await getDocID(req.session.user.UserID);
        let { PatientID, patientName, FirstConsultation, ConsultationType, TreatmentNotes } = req.body;

        // Set default date if not provided
        if (!FirstConsultation) {
            FirstConsultation = new Date().toISOString().split('T')[0];
        }

        // If PatientID is missing, fetch from database using patient name
        if (!PatientID || PatientID.trim() === "") {
            const [patient] = await conPool.query(
                `SELECT PatientID FROM patient WHERE flag = 0 AND name = ? LIMIT 1`,
                [patientName.trim()]
            );

            if (patient.length === 0) {
                throw new Error("Patient not found");
            }
            PatientID = patient[0].PatientID;
        }

        // Validate patient exists
        const [patientExists] = await conPool.query(
            'SELECT PatientID FROM patient WHERE flag = 0 AND PatientID = ?',
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
        // Check if the existing relationship is soft-deleted (flag = 1)
        const [existingRelationFlag] = await conPool.query(
            'SELECT flag FROM doctor_patient WHERE DoctorID = ? AND PatientID = ?',
            [doctorID, PatientID]
        );

        if (existingRelationFlag[0].flag === 1) {
            // Update the existing relationship
            await conPool.query(
                'UPDATE doctor_patient SET flag = 0, FirstConsultation = ?, ConsultationType = ?, TreatmentNotes = ? WHERE DoctorID = ? AND PatientID = ?',
                [FirstConsultation, ConsultationType, TreatmentNotes, doctorID, PatientID]
            );
            await conPool.query(
                'INSERT INTO doctor_activity (DoctorID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
                [doctorID, 'ADD PATIENT', 'Existing Patient Activated', 'PATIENT RELATION', PatientID]
            );
            console.log('Updated existing relationship');
        } else {
            throw new Error('Relationship already exists and is active');
        }
} else {
    // Insert the new relationship
    await conPool.query(
        `INSERT INTO doctor_patient
        (DoctorID, PatientID, FirstConsultation, ConsultationType, TreatmentNotes)
        VALUES (?, ?, ?, ?, ?)`,
        [doctorID, PatientID, FirstConsultation, ConsultationType, TreatmentNotes]
    );

    await conPool.query(
        'INSERT INTO doctor_activity (DoctorID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
        [doctorID, 'ADD PATIENT', 'NEW Patient Activated', 'PATIENT RELATION', PatientID]
    );
    console.log('Inserted new relationship');
}
        // Get updated data
        const { prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);

        res.render('users/doctor', {
            success: 'Patient relationship added successfully!',
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
        try {
            // Get doctor details
            const { doctorID } = await getDocID(req.session.user.UserID);

            // Get updated data
            const { prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);

            res.render('users/doctor', {
                error: 'Error adding patient: ' + err.message,
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
}

async function addPrescription(req, res) {
    let connection;
    try {
        // Get doctor details
        const { doctorID } = await getDocID(req.session.user.UserID);

        // Set default date if not provided
        if (!req.body.DateIssued) {
            req.body.DateIssued = new Date().toISOString().split('T')[0];
        }

        const {
            PatientID,
            patientName,
            DateIssued,
            DiagnosisNotes,
            medicines,
            Status
        } = req.body;

        // Validate PatientID
        if (!PatientID || typeof PatientID !== 'string' || PatientID.trim() === "") {
            if (!patientName || typeof patientName !== 'string' || patientName.trim() === "") {
                throw new Error("Patient name is required if PatientID is not provided");
            }
            const [patient] = await conPool.query(
                "SELECT PatientID FROM patient WHERE flag = 0 AND name = ? LIMIT 1",
                [patientName.trim()]
            );
            if (patient.length === 0) {
                throw new Error("Patient not found");
            }
            req.body.PatientID = patient[0].PatientID;
        } else {
            req.body.PatientID = PatientID.trim();
        }

        // Validate patient exists
        const [patientExists] = await conPool.query(
            'SELECT PatientID FROM patient WHERE flag = 0 AND PatientID = ?',
            [req.body.PatientID]
        );
        if (!patientExists.length) {
            throw new Error('Patient not found');
        }

        // Validate required fields
        checkRequiredFields(['DiagnosisNotes', 'Status'], req.body);

        // Validate Status
        const allowedStatuses = ['ACTIVE', 'COMPLETED', 'CANCELED', 'EXPIRED'];
        if (!allowedStatuses.includes(Status)) {
            throw new Error(`Status must be one of: ${allowedStatuses.join(', ')}`);
        }

        // Additional validation
        if (!req.body.PatientID || !DateIssued || !DiagnosisNotes || !Status) {
            throw new Error('All required fields must be filled');
        }

        // Validate medicines
        if (!medicines || !Array.isArray(medicines) || medicines.length === 0) {
            throw new Error('At least one medicine is required');
        }

        for (const med of medicines) {
            if (!med.MedicineName || !med.Dosage) {
                throw new Error("MedicineName and Dosage are required for each medicine");
            }
            // Ensure at least one timing is selected
            const timings = ['Morning', 'Afternoon', 'Evening', 'Night'];
            const hasTiming = timings.some(timing => med[timing] === 'true');
            if (!hasTiming) {
                throw new Error(`At least one timing must be selected for medicine: ${med.MedicineName}`);
            }
        }

        // Generate GlobalReferenceID
        const GlobalReferenceID = generateReferenceId();

        // Start transaction
        connection = await conPool.getConnection();
        await connection.beginTransaction();

        // Insert into PRESCRIPTION table
        const [prescriptionResult] = await connection.query(
            `INSERT INTO PRESCRIPTION
            (PatientID, DoctorID, DateIssued, DiagnosisNotes, Status, GlobalReferenceID,Flag)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.body.PatientID, doctorID, DateIssued, DiagnosisNotes, Status, GlobalReferenceID,0]
        );

        const prescriptionId = prescriptionResult.insertId;

        // Insert medicines into prescription_medicines
        for (const med of medicines) {
            const beforeFood = med.BeforeFood === 'true' ? 1 : 0;
            const afterFood = med.AfterFood === 'true' ? 1 : 0;
            const morning = med.Morning === 'true' ? 1 : 0;
            const afternoon = med.Afternoon === 'true' ? 1 : 0;
            const evening = med.Evening === 'true' ? 1 : 0;
            const night = med.Night === 'true' ? 1 : 0;

            await connection.query(
                `INSERT INTO prescription_medicine
                (PrescriptionID, MedicineName, Dosage, Instructions, BeforeFood, AfterFood, Morning, Afternoon, Evening, Night) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    prescriptionId,
                    med.MedicineName,
                    med.Dosage,
                    med.Instructions || null,
                    beforeFood,
                    afterFood,
                    morning,
                    afternoon,
                    evening,
                    night
                ]
            );
        }

        await connection.commit();

        // Fetch updated data
        const { prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);
        const [medData] = await conPool.query('SELECT * FROM medicines_data');

        // Fetch medicines for the newly created prescription
        const [prescriptionMedicines] = await conPool.query(
            `SELECT * FROM prescription_medicine WHERE PrescriptionID = ?`,
            [prescriptionId]
        );

        console.log("Prescription added:", { prescriptionId, GlobalReferenceID, medicines: prescriptionMedicines });
        await conPool.query(
            'INSERT INTO doctor_activity (DoctorID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
            [doctorID, 'ADD PRESCRIPTON', 'NEW Prescription Activated', 'PRESCRIPTION', prescriptionId]
        );

        res.render('users/doctor', {
            success: 'Prescription added successfully!',
            prescriptions,
            doctorPatients,
            medicalRecords,
            user: req.session.user,
            DoctorID: doctorID,
            doctorRelationships: [],
            PatientID: req.body.PatientID,
            DiagnosisNotes,
            Status, // Fixed: Replaced finalStatus with Status
            GlobalReferenceID,
            medData,
            newPrescriptionMedicines: prescriptionMedicines // Pass medicines for display
        });

    } catch (err) {
        if (connection) {
            await connection.rollback();
        }
        console.error('Error adding prescription:', err);

        try {
            const { doctorID } = await getDocID(req.session.user.UserID);
            const { prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);

            res.render('users/doctor', {
                error: 'Error adding prescription: ' + err.message,
                prescriptions,
                doctorPatients,
                medicalRecords,
                user: req.session.user,
                DoctorID: doctorID,
                doctorRelationships: []
            });

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
        }
    } finally {
        if (connection) {
            connection.release();
        }
        delete req.session.success;
        delete req.session.error;
    }
}

async function addMedRecords (req,res) {
    // let doctorData; 
    try {
         // Get doctor details
        const {doctorID} = await getDocID(req.session.user.UserID);
           
        let { PatientID, patientName, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy } = req.body;

         // Set default date if not provided
         if (!req.body.RecordDate) {
            req.body.RecordDate = new Date().toISOString().split('T')[0];
        }

        // If PatientID is missing, fetch from database using patient name
        if (!PatientID || PatientID.trim() === "") {
            const [patient] = await conPool.query(
                "SELECT PatientID FROM patient WHERE flag = 0 AND name = ? LIMIT 1",
                [patientName.trim()]
            );

            if (patient.length === 0) {
                throw new Error("Patient not found");
            }
            PatientID = patient[0].PatientID;
        }

        // Validate patient exists
        const [patientExists] = await conPool.query(
            'SELECT PatientID FROM patient WHERE flag = 0 AND PatientID = ?',
            [PatientID]
        );
        
        if (!patientExists.length) {
            throw new Error('Patient not found');
        }

        // Check if relationship already exists
        const [existingRelation] = await conPool.query(
            'SELECT * FROM medical_record WHERE DoctorID = ? AND PatientID = ?',
            [doctorID, PatientID]
        );

        // recordID = existingRelation.insertId

        if (existingRelation.length > 0) {
            // Check if the existing relationship is soft-deleted (flag = 1)
            const [existingRelationFlag] = await conPool.query(
                'SELECT flag FROM medical_record WHERE DoctorID = ? AND PatientID = ?',
                [doctorID, PatientID]
            );

            if (existingRelationFlag[0].flag === 1) {
                // Update the existing relationship
                await conPool.query(
                'UPDATE medical_record SET flag = 0, Diagnosis = ?, Symptoms = ?, Treatments = ?, RecordDate = ?, Notes = ?, UpdatedBy = ? WHERE DoctorID = ? AND PatientID = ?',
                    [Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy, doctorID, PatientID]
                );

                await conPool.query(
                    'INSERT INTO doctor_activity (DoctorID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
                    [doctorID, 'ADD Medical Record', 'Existing Record Activated', 'RECORD', PatientID]
                );

                console.log('Updated existing relationship');
            } else {
                throw new Error('Records already exists and is active');
            }
        } else {
            // Insert the new relationship
            await conPool.query(
            `INSERT INTO medical_record 
            (PatientID, DoctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [PatientID, doctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy],

            await conPool.query(
                'INSERT INTO doctor_activity (DoctorID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
                [doctorID, 'ADD Medical Record', 'NEW Record Activated', 'RECORD', PatientID]
            )
            
        );
            console.log('Inserted new relationship');
        }
     
        //get updated data
        const {prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);
        console.log("Received data:", req.body);

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
           const {doctorID} = await getDocID(req.session.user.UserID);

           //get updated data
           const {prescriptions, medicalRecords, doctorPatients } = await updateData(doctorID);

           console.log("Received data:", req.body);

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

            console.log("Received data:", req.body);
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

// User routes
async function getRel(req, res) {
    try {
      if (req.session.user && req.session.user.Role === 'DOCTOR') {
        const { doctorID, doctorDetails } = await getDocID(req.session.user.UserID);
  
        // Get updated data
        const { doctorPatients } = await updateData(doctorID);
  
        const userData = {
          ...req.session.user,
          doctorDetails
        };
  
        res.render('users/doc/viewRel', {
          user: userData,
          DoctorID: doctorID,
          doctorPatients,
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
        doctorPatients: [],
        error: 'Error loading dashboard: ' + err.message,
        doctorRelationships: []
      });
      // Clear flash messages
      delete req.session.success;
      delete req.session.error;
    }
  }

async function getRec(req, res) {
    try {
      if (req.session.user && req.session.user.Role === 'DOCTOR') {
        const { doctorID, doctorDetails } = await getDocID(req.session.user.UserID);
  
        // Get updated data
        const { medicalRecords } = await updateData(doctorID);
  
        const userData = {
          ...req.session.user,
          doctorDetails
        };
  
        res.render('users/doc/viewRec', {
          user: userData,
          DoctorID: doctorID,
          medicalRecords,
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
        medicalRecords: [],
        error: 'Error loading dashboard: ' + err.message,
        doctorRelationships: []
      });
      // Clear flash messages
      delete req.session.success;
      delete req.session.error;
    }
  }

async function getPres(req, res) {
    try {
      if (req.session.user && req.session.user.Role === 'DOCTOR') {
        const { doctorID, doctorDetails } = await getDocID(req.session.user.UserID);
  
        // Get updated data
        const { prescriptions } = await updateData(doctorID);
  
        const userData = {
          ...req.session.user,
          doctorDetails
        };
  
        res.render('users/doc/viewPres', {
          user: userData,
          DoctorID: doctorID,
          prescriptions,
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
        error: 'Error loading dashboard: ' + err.message,
        doctorRelationships: []
      });
      // Clear flash messages
      delete req.session.success;
      delete req.session.error;
    }
  }

async function addingPres(req,res) {
      try {
            if (req.session.user && req.session.user.Role === 'DOCTOR') {
            const { doctorID, doctorDetails } =  getDocID(req.session.user.UserID);
        
            // Get updated data
            const { prescriptions, medicalRecords, doctorPatients } = updateData(doctorID);
        
            const userData = {
                ...req.session.user,
                doctorDetails
            };
    
            res.render('users/doc/addPres', {
                user: userData,
                DoctorID: doctorID,
                prescriptions,
                medicalRecords,
                doctorPatients,
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
            // Clear flash messages
            delete req.session.success;
            delete req.session.error;
        }
}

async function addingRel(req,res) {
    try {
          if (req.session.user && req.session.user.Role === 'DOCTOR') {
          const { doctorID, doctorDetails } =  getDocID(req.session.user.UserID);
      
          // Get updated data
          const { prescriptions, medicalRecords, doctorPatients } = updateData(doctorID);
      
          const userData = {
              ...req.session.user,
              doctorDetails
          };
  
          res.render('users/doc/addPat', {
              user: userData,
              DoctorID: doctorID,
              prescriptions,
              medicalRecords,
              doctorPatients,
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
          // Clear flash messages
          delete req.session.success;
          delete req.session.error;
      }
}

async function addingRec(req,res) {
    try {
          if (req.session.user && req.session.user.Role === 'DOCTOR') {
          const { doctorID, doctorDetails } =  getDocID(req.session.user.UserID);
      
          // Get updated data
          const { prescriptions, medicalRecords, doctorPatients } = updateData(doctorID);
      
          const userData = {
              ...req.session.user,
              doctorDetails
          };
  
          res.render('users/doc/addRec', {
              user: userData,
              DoctorID: doctorID,
              prescriptions,
              medicalRecords,
              doctorPatients,
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
          // Clear flash messages
          delete req.session.success;
          delete req.session.error;
      }
}

async function getOldPres(req, res) {
    try {
      if (req.session.user && req.session.user.Role === 'DOCTOR') {
        const { doctorID, doctorDetails } = await getDocID(req.session.user.UserID);
  
        // Get updated data
        const [prescriptions] = await conPool.query(
            `SELECT
                p.*,
                pat.Name AS PatientName
            FROM prescription p
            LEFT JOIN patient pat ON p.PatientID = pat.PatientID
            WHERE p.flag = 1 AND p.DoctorID = ?
            ORDER BY p.DateIssued DESC`,
            [doctorID]
          );
  
        const userData = {
          ...req.session.user,
          doctorDetails
        };
  
        res.render('users/doc/viewPres', {
          user: userData,
          DoctorID: doctorID,
          prescriptions,
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
        error: 'Error loading dashboard: ' + err.message,
        doctorRelationships: []
      });
      // Clear flash messages
      delete req.session.success;
      delete req.session.error;
    }
  }

async function revivePrescription(req, res) {
    try {
        const { doctorID } = await getDocID(req.session.user.UserID);
        const PrescriptionID = req.params.id;
        
        // First verify the prescription exists and belongs to this doctor
        const [prescription] = await conPool.query(
            'SELECT * FROM prescription WHERE Flag = 1 AND PrescriptionID = ?',
            [PrescriptionID]
        );

        if (!prescription.length) {
            return res.status(404).json({ error: 'Prescription not found' });
        }

      // Attempt to delete the relationship
      const [result] = await conPool.query(`UPDATE prescription SET flag = 0, Status = 'ACTIVE' WHERE PrescriptionID = ?`, [PrescriptionID]);

      if (result.affectedRows > 0) {
        // Insert log into admin_activity table
        await conPool.query(
           'INSERT INTO doctor_activity (DoctorID, ActionPerformed, Description, TargetType, TargetID) VALUES (?, ?, ?, ?, ?)',
           [doctorID, 'ACTIVATE', 'Prescription Reactivated', 'PRESCRIPTION', PrescriptionID]
       );
       return res.status(200).json({ success: true, message: 'Patient Deleted successfully!' });
   } else {
       return res.status(404).json({ success: false, message: 'Patient not found!' });
   }

    } catch (err) {
        console.error(err);
        // Send error response
        res.status(500).json({ success: false, message: 'Error deleting Prescription' });
    } finally {
        // Clear flash messages
        delete req.session.success;
        delete req.session.error;
    }
}

async function viewPatient(req, res) {
    try {
        if (!req.session.user || req.session.user.Role !== 'DOCTOR') {
            return res.redirect('/login');
        }

        const { doctorID } = await getDocID(req.session.user.UserID); 
        const { doctorPatients } = await updateData(doctorID); 

        const patientId = req.params.id;

        // 1. Fetch Patient Details
        const [patientRows] = await conPool.query('SELECT * FROM patient WHERE flag = 0 AND PatientID = ?', [patientId]);
        const patient = patientRows.length > 0 ? patientRows[0] : null;

        if (!patient) {
            return res.status(404).render('error', { message: 'Patient not found.' }); // Render an error page
        }

        // 2. Fetch Medical Records for this Patient
        const [medicalRecords] = await conPool.query(
            `SELECT
                mr.*,
                d.Name AS DoctorName -- Join with doctor table to get doctor's name
            FROM medical_record mr
            LEFT JOIN doctor d ON mr.DoctorID = d.DoctorID
            WHERE mr.PatientID = ? AND mr.Flag = 0
            ORDER BY mr.RecordDate DESC`,
            [patientId]
        );

        // 3. Fetch Prescriptions for this Patient
        const [prescriptions] = await conPool.query(
            `SELECT
                p.*,
                d.Name AS DoctorName -- Join with doctor table to get doctor's name
            FROM prescription p
            LEFT JOIN doctor d ON p.DoctorID = d.DoctorID
            WHERE p.PatientID = ? AND p.Flag = 0
            ORDER BY p.DateIssued DESC`,
            [patientId]
        );
        
        res.render('users/doc/patientDashboard', {
              user: req.session.user,
              patient: patient, // Single patient object
              doctorPatients, // Still passing this, though its direct use on this page might be limited
              medicalRecords, // New data
              prescriptions,  // New data
              success: req.session.success,
              error: req.session.error
         });
      
        // Clear flash messages
        delete req.session.success;
        delete req.session.error;
    } catch (err) {
        console.error('Error loading patient dashboard:', err);
        res.status(500).render('error', { // Render a generic error page
            message: 'Error loading patient dashboard: ' + err.message,
            user: req.session.user // Pass user for nav bar if error page uses it
        });
        // Clear flash messages
        delete req.session.success;
        delete req.session.error;
    }
}

// In-memory store for OTPs (for verification purposes)
const doctorOtpStore = new Map();

// Placeholder for your OTP-based doctor login function
async function doctorLogin(req, res) {
    console.log("doctorLogin function called. Assuming OTP login logic is handled elsewhere or is complete.");
    return res.status(200).json({ success: true, message: 'OTP-based login assumed to be handled.' });
}

// Request OTP for Doctor Action 
async function requestOtpForDoctorAction(req, res) {
    try {
        const userID = req.session.user.UserID;

        if (!userID) {
            return res.status(401).json({ success: false, message: 'Unauthorized: User not logged in.' });
        }

        const { doctorID, doctorEmail } = await getDocID(userID);

        if (!doctorID || !doctorEmail) {
            return res.status(400).json({ success: false, message: 'Doctor details not found for OTP generation.' });
        }

        // Generate OTP
        const secret = speakeasy.generateSecret({ length: 20 }).base32;
        const otp = speakeasy.totp({
            secret: secret,
            ...OTP_CONFIG // Use the global config for step, digits, encoding
        });

        const expiresAt = new Date(Date.now() + (OTP_CONFIG.step * 1000)); // Expiry Date object

        // Store OTP in in-memory map for verification (primary method)
        doctorOtpStore.set(userID, {
            userID: userID,
            email: doctorEmail,
            otp: otp,
            secret: secret,
            expires: expiresAt.getTime() // Store as timestamp for easy comparison
        });
        console.log(`OTP generated and stored in memory for UserID ${userID}. OTP: ${otp}, Secret: ${secret.substring(0, 5)}..., Expires: ${expiresAt.toISOString()}`);

        await conPool.query(
            'INSERT INTO otp_table (otp, email, byUser, secret, expires_at) VALUES (?, ?, ?, ?, ?)',
            [otp, doctorEmail, userID, secret, expiresAt]
        );
        console.log('OTP details also inserted into otp_table in DB for reference.');


        // Send OTP via email
        await emailTransport.sendMail({
            from: process.env.EMAIL_USER,
            to: doctorEmail,
            subject: 'OTP for Doctor Action Confirmation',
            text: `Your One-Time Password (OTP) for confirming an action is: ${otp}. This OTP is valid for 5 minutes. Do not share this with anyone.`
        });

        res.status(200).json({ success: true, message: 'OTP sent to your registered email.' });

    } catch (error) {
        console.error('Error requesting OTP for doctor action:', error);
        res.status(500).json({ success: false, message: 'Error sending OTP.' });
    }
}

// Verify OTP for Doctor Action (VERIFICATION ONLY FROM IN-MEMORY STORE)
async function verifyOtpForDoctorAction(req, res) {
    try {
        const { otp } = req.body;
        const userID = req.session.user.UserID; // Get UserID from session

        if (!userID) {
            console.log('Error: 401 - Unauthorized: User not logged in.');
            return res.status(401).json({ success: false, message: 'Unauthorized: User not logged in.' });
        }

        if (!otp) {
            console.log('Error: 400 - OTP is required (otp is null/empty).');
            return res.status(400).json({ success: false, message: 'OTP is required.' });
        }

        // Retrieve OTP details from in-memory store for verification
        const storedOtpEntry = doctorOtpStore.get(userID);

        if (!storedOtpEntry) {
            console.log('Error: 400 - No OTP found in memory for this user.');
            return res.status(400).json({ success: false, message: 'No valid OTP found or OTP expired. Please request a new one.' });
        }

        const storedSecret = storedOtpEntry.secret;
        const expiresAt = storedOtpEntry.expires; // This is a timestamp (ms)

        if (Date.now() > expiresAt) {
            // Delete expired OTP from memory (important for preventing reuse and cleanup)
            doctorOtpStore.delete(userID);
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }

        const diagnosticGeneratedOtp = speakeasy.totp({
            secret: storedSecret,
            ...OTP_CONFIG // Must match the step used during generation
        });

        const verified = speakeasy.totp.verify({
            secret: storedSecret,
            token: otp,
            ...OTP_CONFIG, // Ensure consistency in step, digits, encoding
            window: 2 // Aligning with speakeasy's default and admin's implicit use
        });

        if (verified) {
            doctorOtpStore.delete(userID);
            // The DB record is for reference only, not part of the active verification lifecycle.
            return res.status(200).json({ success: true, message: 'OTP verified successfully.' });
        } else {
            console.log('Error: 400 - Invalid OTP. Speakeasy verification failed.');
            return res.status(400).json({ success: false, message: 'Invalid OTP. Please try again.' });
        }

    } catch (error) {
        res.status(500).json({ success: false, message: 'An unexpected error occurred during OTP verification.' });
    } 
}


// doctorAuth.js
async function getDocLogs(req, res) {
    if (!req.session.user || req.session.user.Role !== 'DOCTOR') {
        return res.redirect('/login');
    }
    const { doctorID } = await getDocID(req.session.user.UserID);

    try {

        let page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 9; // Set default limit to 9 logs per page

        // Count query for total doctor activities
        const [totalLogsCountResult] = await conPool.query(`
        SELECT COUNT(*) as totalLogs FROM doctor_activity
        WHERE DoctorID = ?
    `, [doctorID]); // Pass doctorID here
    

        const totalLogs = totalLogsCountResult[0].totalLogs;
        const totalPages = Math.ceil(totalLogs / limit);

        // Crucial: Restrict 'page' to be within valid range
        if (page < 1) {
            page = 1;
        } else if (page > totalPages && totalPages > 0) {
            page = totalPages;
        } else if (totalPages === 0) { // If there are no logs, page should be 1
            page = 1;
        }

        const offset = (page - 1) * limit; // Calculate offset for pagination

        const [logs] = await conPool.query(`
            SELECT
                da.ActivityID,
                d.Name AS Doctorname,
                da.ActionPerformed,
                da.Description,
                da.TargetType,
                da.TargetID,
                da.ActivityTimestamp
            FROM
                doctor_activity da
            JOIN
                doctor d ON da.DoctorID = d.DoctorID
           WHERE
                da.DoctorID = ?
            ORDER BY
                da.ActivityTimestamp DESC
            LIMIT ? OFFSET ?
        `, [doctorID, limit, offset]); 

        return res.render('users/doc/logs', {
            user: req.session.user,
            logs,
            currentPage: page,
            totalPages,
            limit,
            searchTerm: '' // Keep searchTerm for consistency with findDr.ejs, even if not used for logs currently
        });
    } catch (err) {
        // console.error('Error fetching doctor logs:', err);
        res.render('users/doc/logs', {
            user: req.session.user,
            logs: [],
            currentPage: 1,
            totalPages: 1,
            limit: 10,
            searchTerm: '',
            error: 'No Doctor logs'
        });
    }
};

module.exports ={
    getDoctor,
    addPatient,
    addPrescription,
    addMedRecords,
    deleteRelation,
    deleteRecord,
    deletePres,
    getRel,
    getRec,
    getPres,
    addingPres,
    addingRel,
    addingRec,
    getOldPres,
    revivePrescription,
    viewPatient,
    requestOtpForDoctorAction,
    verifyOtpForDoctorAction,
    getDocID,
    doctorLogin,
    getDocLogs
}
