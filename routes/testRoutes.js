const { conPool } = require('../config/dbHandler')
const express = require('express');
const router = express.Router();

// GET route to display the form
router.get('/test-doctor-patient', (req, res) => {
    res.render('testDoctorPatient');
});

// POST route to handle form submission
router.post('/test-doctor-patient', async (req, res) => {
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
router.get('/test-prescription', async (req, res) => {
    try{
        const [medData] = await conPool.query('SELECT * FROM medicines_data');
        res.render('testPrescription', {
            medData
        });
    }
    catch (err) {
        console.error('Error fetching records:', err);
        res.status(500).send('Error fetching records: ' + err.message);
    }

});

router.post('/test-prescription', async (req, res) => {
    const connection = await conPool.getConnection();

    try {
        await connection.beginTransaction();

        // Destructure with lowercase medicines
        const { 
            PatientID, 
            DoctorID, 
            DiagnosisNotes, 
            status, 
            GlobalReferenceID, 
            DateIssued, 
            medicines // Use lowercase to match form data
        } = req.body;

        // Validate and convert types
        const patientId = parseInt(PatientID, 10);
        const doctorId = parseInt(DoctorID, 10);
        if (isNaN(patientId) || isNaN(doctorId)) {
            throw new Error("PatientID and DoctorID must be valid integers");
        }

        // Validate Status
        const validStatuses = ['ACTIVE', 'COMPLETED', 'CANCELED', 'EXPIRED'];
        const finalStatus = validStatuses.includes(status) ? status : 'ACTIVE';

        // Convert DateIssued to a MySQL-compatible timestamp
        const dateIssued = DateIssued ? new Date(DateIssued).toISOString().slice(0, 19).replace('T', ' ') : new Date().toISOString().slice(0, 19).replace('T', ' ');

        // Validate GlobalReferenceID length
        if (GlobalReferenceID && GlobalReferenceID.length > 50) {
            throw new Error("GlobalReferenceID must not exceed 50 characters");
        }

        // Debug logging
        console.log('Received Data:', { patientId, doctorId, DiagnosisNotes, finalStatus, GlobalReferenceID, dateIssued, medicines });

        // 1. Insert the prescription header
        const [prescriptionResult] = await connection.query(
            `INSERT INTO PRESCRIPTION 
            (PatientID, DoctorID, DiagnosisNotes, Status, GlobalReferenceID, DateIssued) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                patientId, 
                doctorId, 
                DiagnosisNotes, 
                finalStatus, 
                GlobalReferenceID || null,
                dateIssued
            ]
        );

        const prescriptionId = prescriptionResult.insertId;

        // 2. Insert medicines into prescription_medicines (if provided)
        if (medicines && Array.isArray(medicines)) {
            for (const med of medicines) {
                // Ensure required fields are present
                if (!med.MedicineName || !med.Dosage) {
                    throw new Error("MedicineName and Dosage are required for each medicine");
                }

                // Convert checkbox values to 1/0 (tinyint(1))
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
        }

        await connection.commit();

        // Render success
        res.render('testPrescription', { 
            success: 'Prescription added successfully!',
            originalValues: {
                PatientID: patientId,
                DoctorID: doctorId,
                DiagnosisNotes,
                status: finalStatus,
                GlobalReferenceID
            }
        });

    } catch (err) {
        await connection.rollback();
        console.error('Full Error:', err);
        res.render('testPrescription', { 
            error: 'Error adding prescription: ' + err.message,
            originalValues: req.body
        });
    } finally {
        connection.release();
    }
});


// Medical Record Routes
router.get('/test-medical-record', (req, res) => {
    res.render('testMedicalRecord');
});

router.post('/test-medical-record', async (req, res) => {
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

router.get('/test-view-all', async (req, res) => {
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

router.get('/test-med',async(req,res)=>{

    try {
        // Fetch all records from all three tables
        const [medData] = await conPool.query('SELECT * FROM medicines_data');
    
        res.render('testMed', {
           medData
        });
    } catch (err) {
        console.error('Error fetching records:', err);
        res.status(500).send('Error fetching records: ' + err.message);
    }

});

module.exports = router;

