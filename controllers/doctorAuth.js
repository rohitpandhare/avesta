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
      WHERE p.flag = 0 AND p.DoctorID = ?
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
        const [result] = await conPool.query('UPDATE medical_record SET flag = 1 WHERE RecordID = ?', [RecordID]);

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
      const [result] = await conPool.query('UPDATE prescription SET flag = 1 WHERE PrescriptionID = ?', [PrescriptionID]);

        // Send JSON response
        res.status(result.affectedRows > 0 ? 200 : 404).json({
            success: result.affectedRows > 0,
            message: result.affectedRows > 0 ? 'Prescription Deleted successfully!' : 'Patient not found!'
        });
        // res.json({ 
        //     success: true,
        //     message: 'Prescription deleted successfully'
        // });

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
                "SELECT PatientID FROM patient WHERE Name = ? LIMIT 1",
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
            'SELECT PatientID FROM patient WHERE PatientID = ?',
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
            (PatientID, DoctorID, DateIssued, DiagnosisNotes, Status, GlobalReferenceID)
            VALUES (?, ?, ?, ?, ?, ?)`,
            [req.body.PatientID, doctorID, DateIssued, DiagnosisNotes, Status, GlobalReferenceID]
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
            'SELECT * FROM medical_record WHERE DoctorID = ? AND PatientID = ?',
            [doctorID, PatientID]
        );

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
            [PatientID, doctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy]
        );
            console.log('Inserted new relationship');
        }
            
        // Validate required fields (PatientID, Diagnosis, Symptoms, Treatments, Notes, UpdatedBy)
        checkRequiredFields(['PatientID', 'Diagnosis', 'Symptoms', 'Treatments', 'Notes', 'UpdatedBy'], req.body);

        // Add validation
        if (!PatientID || !Diagnosis || !Symptoms || !Treatments || !RecordDate || !Notes || !UpdatedBy) {
            throw new Error('All required fields must be filled');
        }
         
        //  await conPool.query(
        //     `INSERT INTO medical_record 
        //     (PatientID, DoctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy) 
        //     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        //     [PatientID, doctorID, Diagnosis, Symptoms, Treatments, RecordDate, Notes, UpdatedBy]
        // );

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
    addingRec
}
