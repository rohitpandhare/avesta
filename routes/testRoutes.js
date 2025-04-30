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
        
        const { PatientID, DoctorID, DiagnosisNotes, Status, GlobalReferenceID, medicines } = req.body;
        
        // 1. Insert the prescription header
        const [prescriptionResult] = await connection.query(
            `INSERT INTO PRESCRIPTION 
            (PatientID, DoctorID, DiagnosisNotes, Status, GlobalReferenceID) 
            VALUES (?, ?, ?, ?, ?)`,
            [PatientID, DoctorID, DiagnosisNotes, Status, GlobalReferenceID || null]
        );
        
        const prescriptionId = prescriptionResult.insertId;
        
        // 2. Insert each medicine with timing information
        for (const medicine of medicines) {
            await connection.query(
                `INSERT INTO PRESCRIPTION_MEDICINE 
                (PrescriptionID, MedicineName, Dosage, Instructions, BeforeFood, AfterFood, 
                 Morning, Afternoon, Evening, Night, FrequencyPerDay, DurationDays) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    prescriptionId,
                    medicine.MedicineName,
                    medicine.Dosage,
                    medicine.Instructions || null,
                    medicine.BeforeFood === 'true' ? 1 : 0,
                    medicine.AfterFood === 'true' ? 1 : 0,
                    medicine.Morning === 'true' ? 1 : 0,
                    medicine.Afternoon === 'true' ? 1 : 0,
                    medicine.Evening === 'true' ? 1 : 0,
                    medicine.Night === 'true' ? 1 : 0,
                    medicine.FrequencyPerDay || 1,
                    medicine.DurationDays || 7
                ]
            );
        }
        
        await connection.commit();
        res.render('testPrescription', { 
            success: 'Prescription added successfully!',
            // Keep form values for better UX
            originalValues: {
                PatientID,
                DoctorID,
                DiagnosisNotes,
                Status,
                GlobalReferenceID
            }
        });
    } catch (err) {
        await connection.rollback();
        console.error('Error:', err);
        res.render('testPrescription', { 
            error: 'Error adding prescription: ' + err.message,
            // Return submitted values to maintain form state
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

