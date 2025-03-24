// routes/patientRoutes.js
const router = require('express').Router();
const { checkProfileComplete } = require('../middlware/dc_middleware');

const { checkRole } = require('../middlware/dc_middleware');
router.use(checkRole(['PATIENT']));


router.get('/', checkProfileComplete, async (req, res) => {
    try {
        const [doctors] = await conPool.query(`
            SELECT d.Name, d.Specialty, d.Phone 
            FROM doctor_patient dp
            JOIN doctor d ON dp.DoctorID = d.DoctorID
            WHERE dp.PatientID = (SELECT PatientID FROM patient WHERE UserID = ?)
        `, [req.session.user.UserID]);

        res.render('users/patient', {
            user: req.session.user,
            doctors: doctors
        });
    } catch (err) {
        console.error("Patient dashboard error: ", err);
        res.render('users/patient', { 
            user: req.session.user,
            error: "Failed to load dashboard" 
        });
    }
});

router.get('/profile', (req, res) => {
    if (req.session.user.profileComplete) {
        return res.redirect('/patient');
    }
    res.render('dashboard/patientProfile');
});

module.exports = router;
