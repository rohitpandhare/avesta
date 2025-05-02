const e = require("cors");
const { conPool } = require("../config/dbHandler");

async function updateData(DoctorID) {
    // Fetch prescriptions
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

    // Fetch doctor-patient relationships
    const [doctorPatients] = await conPool.query(
        `SELECT 
            dp.*,
            pat.Name AS PatientName
        FROM doctor_patient dp
        LEFT JOIN patient pat ON dp.PatientID = pat.PatientID
        WHERE dp.flag = 0 AND dp.DoctorID = ?`,
        [DoctorID]
    );

    // Fetch medical records
    const [medicalRecords] = await conPool.query(
        `SELECT 
            mr.*,
            pat.Name AS PatientName
        FROM medical_record mr
        LEFT JOIN patient pat ON mr.PatientID = pat.PatientID
        WHERE mr.flag = 0 AND mr.DoctorID = ?`,
        [DoctorID]
    );

    return { prescriptions, doctorPatients, medicalRecords };
}

async function getDocID(UserID) {
    // Get doctor details
    const [doctorDetails] = await conPool.query(
        'SELECT d.*, u.Username as Username, u.Email FROM doctor d JOIN user u ON d.UserID = u.UserID WHERE d.UserID = ?',
        [UserID]
   );

    if (!doctorDetails.length) {
        throw new Error('Doctor details not found');
    }

    const doctorID = doctorDetails[0].DoctorID; 
    
    return {
        doctorID,
        doctorDetails: doctorDetails[0],
    };
}

// Helper function to build detailed missing-fields message
function checkRequiredFields(fields, data) {
    const missing = fields.filter(field => !data[field] || data[field].toString().trim() === '');
    if (missing.length) {
      throw new Error(`Missing required field(s): ${missing.join(', ')}`);
    }
  }

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

        // Send JSON response
        res.status(result.affectedRows > 0 ? 200 : 404).json({
            success: result.affectedRows > 0,
            message: result.affectedRows > 0 ? 'Patient Deleted successfully!' : 'Patient not found!'
        });

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

// DELETE medicalRecords
async function deleteRecord(req, res) {
    try {

        const RecordID = req.params.id; // get id manually

        // Attempt to delete the relationship
        const [result] = await conPool.query('DELETE FROM medical_record WHERE RecordID = ?', [RecordID]);

        // Send JSON response
        res.status(result.affectedRows > 0 ? 200 : 404).json({
            success: result.affectedRows > 0,
            message: result.affectedRows > 0 ? 'Medical Record Deleted successfully!' : 'Patient not found!'
        });

    } catch (err) {
        console.error(err);
        // Send error response
        res.status(500).json({ success: false, message: 'Error deleting record' });
    } finally {
        // Clear flash messages
        delete req.session.success;
        delete req.session.error;
    }
}

// DELETE medicalRecords
async function deletePres(req, res) {
    try {
        // const { doctorID } = await getDocID(req.session.user.UserID);
        // const { prescriptions } = await updateData(doctorID);
        // const PatientID = prescriptions[0]?.PatientID;

        // if (!PatientID) {
        //     throw new Error('No prescription found to delete.');
        // }
        const PrescriptionID = req.params.id;
        
        // First verify the prescription exists and belongs to this doctor
        const [prescription] = await conPool.query(
            'SELECT * FROM prescription WHERE PrescriptionID = ?',
            [PrescriptionID]
        );

        if (!prescription.length) {
            return res.status(404).json({ error: 'Prescription not found' });
        }

        // Attempt to delete the relationship
        const [result] = await conPool.query('DELETE FROM prescription WHERE PrescriptionID = ?', [PrescriptionID]);

        // Send JSON response
        // res.status(result.affectedRows > 0 ? 200 : 404).json({
        //     success: result.affectedRows > 0,
        //     message: result.affectedRows > 0 ? 'Prescription Deleted successfully!' : 'Patient not found!'
        // });
        res.json({ 
            success: true,
            message: 'Prescription deleted successfully'
        });

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
                "SELECT PatientID FROM patient WHERE Name = ? LIMIT 1",
                [patientName.trim()]
            );

            if (patient.length === 0) {
                throw new Error("Patient not found");
            }
            PatientID = patient[0].PatientID;
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
        console.log('Updated existing relationship');
    } else {
        throw new Error('Relationship already exists and is active');
    }
} else {
    // Insert the new relationship
    await conPool.query(
        `INSERT INTO DOCTOR_PATIENT
        (DoctorID, PatientID, FirstConsultation, ConsultationType, TreatmentNotes)
        VALUES (?, ?, ?, ?, ?)`,
        [doctorID, PatientID, FirstConsultation, ConsultationType, TreatmentNotes]
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
// Helper function to generate reference ID
function generateReferenceId() {
    const prefix = 'RX';
    const timestamp = Date.now().toString();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const uniqueId = timestamp.slice(-3) + randomNum;
    return `${prefix}${uniqueId}`;
}

async function addPrescription(req, res) {
    let connection;
    try {
        const { PrescriptionID, medicines } = req.body;

        // --- Validate PrescriptionID ---
        if (!PrescriptionID || isNaN(Number(PrescriptionID))) {
            throw new Error('Valid PrescriptionID is required');
        }
        // --- Validate medicines ---
        if (!Array.isArray(medicines) || medicines.length === 0) {
            throw new Error('At least one medicine required');
        }

        // Check each medicine for required fields
        for (const [i, med] of medicines.entries()) {
            if (!med.MedicineName || !med.Dosage) {
                throw new Error(`Medicine ${i+1}: Name and Dosage required`);
            }
        }

        // Open DB connection (for transaction)
        connection = await conPool.getConnection();
        await connection.beginTransaction();

        // Insert each medicine
        for (const med of medicines) {
            const {
                MedicineName,
                Dosage,
                Instructions = null,
                BeforeFood = 0,
                AfterFood = 0,
                Morning = 0,
                Afternoon = 0,
                Evening = 0,
                Night = 0,
                DrugLevel = 0,
                FrequencyPerDay = null,
                DurationDays = null,
                SpecialInstructions = null
            } = med;

            // Only allow 0/1 for checkboxes (convert truthy string too)
            const toNum = v => (v === true || v === 'true' || v === 1 || v === '1') ? 1 : 0;

            await connection.query(
                `INSERT INTO prescription_medicine (
                    PrescriptionID, MedicineName, Dosage, Instructions, DrugLevel,
                    BeforeFood, AfterFood, Morning, Afternoon, Evening, Night,
                    FrequencyPerDay, DurationDays, SpecialInstructions
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    PrescriptionID,
                    MedicineName,
                    Dosage,
                    Instructions,
                    DrugLevel,
                    toNum(BeforeFood),
                    toNum(AfterFood),
                    toNum(Morning),
                    toNum(Afternoon),
                    toNum(Evening),
                    toNum(Night),
                    FrequencyPerDay,
                    DurationDays,
                    SpecialInstructions
                ]
            );
        }

        await connection.commit();
        res.status(200).json({ success: true, message: "Medicines added successfully!" });

    } catch (err) {
        if (connection) await connection.rollback();
        res.status(400).json({ success: false, message: err.message });
    } finally {
        if (connection) connection.release();
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
                "SELECT PatientID FROM patient WHERE Name = ? LIMIT 1",
                [patientName.trim()]
            );

            if (patient.length === 0) {
                throw new Error("Patient not found");
            }
            PatientID = patient[0].PatientID;
        }

        // Validate patient exists
        const [patientExists] = await conPool.query(
            'SELECT PatientID FROM patient WHERE PatientID = ?',
            [PatientID]
        );
        
        if (!patientExists.length) {
            throw new Error('Patient not found');
        }

        // Validate required fields (PatientID, Diagnosis, Symptoms, Treatments, Notes, UpdatedBy)
        checkRequiredFields(['PatientID', 'Diagnosis', 'Symptoms', 'Treatments', 'Notes', 'UpdatedBy'], req.body);

        // Add validation
        if (!PatientID || !Diagnosis || !Symptoms || !Treatments || !RecordDate || !Notes || !UpdatedBy) {
            throw new Error('All required fields must be filled');
        }
         
         await conPool.query(
            `INSERT INTO medical_record 
            (PatientID, DoctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
            [PatientID, doctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy]
        );

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



module.exports ={
    getDoctor,
    addPatient,
    addPrescription,
    addMedRecords,
    deleteRelation,
    deleteRecord,
    deletePres
}
