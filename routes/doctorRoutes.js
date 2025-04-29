const express = require('express');
const router = express.Router();
const { checkRole } = require('../middlware/dc_middleware')

// User CRUD func import
const {  
    getDoctor,
    // getDocProfile,
    addPatient,
    addPrescription,
    addMedRecords,
    deleteRelation,
    deleteRecord,
    deletePres
} = require('../controllers/doctorAuth');

router.get('/',checkRole(['doctor']), getDoctor);
// router.post('/profile', getDocProfile);

router.post('/addPatient', addPatient);
router.post('/addPres', checkRole(['doctor']),addPrescription);
router.post('/addMedRec', addMedRecords);

router.delete('/deleteRelation/:id',deleteRelation)
router.delete('/deleteRecord/:id',deleteRecord)
router.delete('/deletePres/:id',deletePres) 


const { conPool } = require('../config/dbHandler');

function ensureAuthenticated(req, res, next) {
    if (req.session.user && req.session.user.role.toLowerCase() === 'doctor') {
        return next();
    }
    res.redirect('/login');
}

router.get('/dashboard', ensureAuthenticated, async (req, res) => {
    try {
        // Get doctor data
        const [doctorData] = await conPool.query(
            'SELECT * FROM doctor WHERE UserID = ?',
            [req.session.user.id]
        );

        res.render('users/doctor', {
            user: req.session.user,
            doctor: doctorData[0]
        });
    } catch (error) {
        console.error('Doctor dashboard error:', error);
        res.status(500).render('error', { message: 'Failed to load doctor dashboard' });
    }
});


module.exports = router;


