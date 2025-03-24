const express = require('express');
const router = express.Router();
const { conPool } = require('../config/dbHandler');
const { checkProfileComplete } = require('../middlware/dc_middleware');



const { checkRole } = require('../middlware/dc_middleware');
router.use(checkRole(['DOCTOR']));

router.get('/', checkProfileComplete, async (req, res) => {
    try {
        const [stats] = await conPool.query(`
            SELECT 
                (SELECT COUNT(*) FROM doctor_patient WHERE DoctorID = 
                    (SELECT DoctorID FROM doctor WHERE UserID = ?)) as totalPatients,
                (SELECT COUNT(*) FROM appointments WHERE DoctorID = 
                    (SELECT DoctorID FROM doctor WHERE UserID = ?) AND Date >= CURDATE()) as upcomingAppointments
        `, [req.session.user.UserID, req.session.user.UserID]);

        res.render('users/doctor', { 
            user: req.session.user,
            stats: stats[0] || { totalPatients: 0, upcomingAppointments: 0 }
        });
    } catch (err) {
        console.error("Doctor dashboard error: ", err);
        res.render('users/doctor', { 
            user: req.session.user,
            error: "Failed to load dashboard" 
        });
    }
});

router.get('/profile', (req, res) => {
    if (req.session.user.profileComplete) {
        return res.redirect('/doctor');
    }
    res.render('dashboard/doctorProfile');
});

module.exports = router;


// Modified add patient route
// router.post('/patients/add', verifyDoctor, async (req, res) => {
//     const { patient_id } = req.body;
//     const userId = req.session.user.UserID;

//     // Validate input first
//     if (!patient_id || isNaN(patient_id)) {
//         return res.status(400).json({
//             success: false,
//             message: 'Invalid Patient ID format'
//         });
//     }

//     let connection;
//     try {
//         connection = await conPool.getConnection();

//         // Get DoctorID using JOIN with USER table
//         const [doctor] = await connection.query(`
//             SELECT d.DoctorID 
//             FROM DOCTOR d
//             INNER JOIN USER u ON d.UserID = u.UserID
//             WHERE u.UserID = ? AND u.Role = 'DOCTOR'
//         `, [userId]);

//         if (doctor.length === 0) {
//             return res.status(404).json({
//                 success: false,
//                 message: 'Doctor profile not found'
//             });
//         }

//         // Rest of your code remains the same...
//         // ...

//     } catch (err) {
//         console.error('Route error:', err);
//         res.status(500).json({
//             success: false,
//             message: 'Internal server error',
//             error: err.message
//         });
//     } finally {
//         if (connection) connection.release();
//     }
// });

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

