const express = require('express');
const router = express.Router();
const { conPool } = require('../config/dbHandler');

// Middleware to verify doctor role
const verifyDoctor = async (req, res, next) => {
    if (!req.session.user || req.session.user.Role !== 'DOCTOR') {
        return res.status(403).json({ message: 'Access restricted to doctors only' });
    }
    next();
};

// Add this error handling middleware at the end of your routes
router.use((err, req, res, next) => {
    console.error('Error handler:', err);
    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: err.message
    });
});

// Modified add patient route
router.post('/patients/add', verifyDoctor, async (req, res) => {
    const { patient_id } = req.body;
    const userId = req.session.user.UserID;

    // Validate input first
    if (!patient_id || isNaN(patient_id)) {
        return res.status(400).json({
            success: false,
            message: 'Invalid Patient ID format'
        });
    }

    let connection;
    try {
        connection = await conPool.getConnection();

        // Get DoctorID using JOIN with USER table
        const [doctor] = await connection.query(`
            SELECT d.DoctorID 
            FROM DOCTOR d
            INNER JOIN USER u ON d.UserID = u.UserID
            WHERE u.UserID = ? AND u.Role = 'DOCTOR'
        `, [userId]);

        if (doctor.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'Doctor profile not found'
            });
        }

        // Rest of your code remains the same...
        // ...

    } catch (err) {
        console.error('Route error:', err);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: err.message
        });
    } finally {
        if (connection) connection.release();
    }
});

module.exports = router;
// const express = require('express');
// const router = express.Router();
// const { 
//     getPatients,
//     createPrescription,
//     updatePrescription,
//     deletePrescription,
//     removePatient,
//     getPrescriptionHistory,
//     createMedicalRecord,
//     getPatientMedicalHistory,
//     addPatient
// } = require('../controllers/doctorAuth');

// // Import middleware
// const { chkLogin } = require('../middlware/dc_middleware');

// // Apply login check to all doctor routes
// router.use(chkLogin);

// // Patient Management Routes
// router.get('/patients', getPatients); // GET /doctor/patients
// router.post('/patients/add', addPatient); // POST /doctor/patients/add
// router.delete('/patients/:patient_id', removePatient); // DELETE /doctor/patients/123

// // Prescription Routes
// router.post('/prescriptions', createPrescription); // POST /doctor/prescriptions
// router.put('/prescriptions/:prescription_id', updatePrescription); // PUT /doctor/prescriptions/456
// router.delete('/prescriptions/:prescription_id', deletePrescription); // DELETE /doctor/prescriptions/456
// router.get('/prescriptions/history', getPrescriptionHistory); // GET /doctor/prescriptions/history

// // Medical Records Routes
// router.post('/medical-records', createMedicalRecord); // POST /doctor/medical-records
// router.get('/patients/:patient_id/medical-history', getPatientMedicalHistory); // GET /doctor/patients/123/medical-history

// module.exports = router;

