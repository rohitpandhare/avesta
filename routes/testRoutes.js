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
    try {
        const { PatientID, DoctorID, DateIssued, DiagnosisNotes, Medicines, Status, GlobalReferenceID } = req.body;

        await conPool.query(
            `INSERT INTO PRESCRIPTION 
            (PatientID, DoctorID, DateIssued, DiagnosisNotes, Medicines, Status, GlobalReferenceID) 
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [PatientID, DoctorID, DateIssued, DiagnosisNotes, Medicines, Status, GlobalReferenceID]
        );

        res.render('testPrescription', { success: 'Prescription added successfully!' });
    } catch (err) {
        console.error('Error:', err);
        res.render('testPrescription', { error: 'Error adding prescription: ' + err.message });
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

