const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlware/dc_middleware')

// User CRUD func import
const {  
    getPatients,
	// getPatientProfile
} = require('../controllers/patientAuth');

router.get('/',checkRole(['patient']), getPatients);
// router.post('/profile', getPatientProfile);

const { conPool } = require('../config/dbHandler');

function ensureAuthenticated(req, res, next) {
    if (req.session.user && req.session.user.role.toLowerCase() === 'patient') {
        return next();
    }
    res.redirect('/login');
}

router.get('/dashboard', ensureAuthenticated, async (req, res) => {
    try {
        // Get patient data
        const [patientData] = await conPool.query(
            'SELECT * FROM patient WHERE UserID = ?',
            [req.session.user.id]
        );

        res.render('users/patient', {
            user: req.session.user,
            patient: patientData[0]
        });
    } catch (error) {
        console.error('Patient dashboard error:', error);
        res.status(500).render('error', { message: 'Failed to load patient dashboard' });
    }
});

module.exports = router;




