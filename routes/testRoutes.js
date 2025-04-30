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
router.get('/test-prescription', (req, res) => {
    res.render('testPrescription');
});

router.post('/test-prescription', async (req, res) => {
    const connection = await conPool.getConnection();

    try {
        await connection.beginTransaction();
        
        // Destructure with lowercase status
        const { 
            PatientID, 
            DoctorID, 
            DiagnosisNotes, 
            status,  // Lowercase here
            GlobalReferenceID, 
            DateIssued,  // Add this if you're using the date from the form
            medicines 
        } = req.body;

        // Validate Status
        const validStatuses = ['ACTIVE', 'COMPLETED', 'CANCELED', 'EXPIRED'];
        const finalStatus = validStatuses.includes(status) ? status : 'ACTIVE';
        
        // Debug logging
        console.log('Received Status:', status);
        console.log('Final Status:', finalStatus);

        // 1. Insert the prescription header
        const [prescriptionResult] = await connection.query(
            `INSERT INTO PRESCRIPTION 
            (PatientID, DoctorID, DiagnosisNotes, Status, GlobalReferenceID, DateIssued) 
            VALUES (?, ?, ?, ?, ?, ?)`,
            [
                PatientID, 
                DoctorID, 
                DiagnosisNotes, 
                finalStatus, 
                GlobalReferenceID || null,
                DateIssued || new Date()  // Use form date or current date
            ]
        );
        
        const prescriptionId = prescriptionResult.insertId;
        
        // Rest of your code remains the same...

        // Update originalValues with lowercase status
        res.render('testPrescription', { 
            success: 'Prescription added successfully!',
            originalValues: {
                PatientID,
                DoctorID,
                DiagnosisNotes,
                status: finalStatus,  // Use lowercase here
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



module.exports = router;

