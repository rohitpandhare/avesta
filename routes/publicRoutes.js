const {
    findDoctor,
    findPerticularDoctor,
    viewPrescriptions
} = require('../controllers/publicAuth');

const { conPool } = require('../config/dbHandler')
const router = require('express').Router();


router.get('/findDr', findDoctor);
router.get('/findDr/search', findPerticularDoctor);

// Amended routes
router.get('/viewPres', viewPrescriptions);

// Route for displaying a single prescription for printing
router.get('/printPrescription/:refId', async (req, res) => {
    try {
        const refId = req.params.refId;

        const [prescriptions] = await conPool.query(`
            SELECT 
                p.PrescriptionID, 
                p.DateIssued, 
                p.DiagnosisNotes,  
                p.Status, 
                p.GlobalReferenceID, 
                p.ValidityDays,
                d.Name as DoctorName,
                pt.Name as PatientName
            FROM PRESCRIPTION p
            JOIN DOCTOR d ON p.DoctorID = d.DoctorID
            JOIN PATIENT pt ON p.PatientID = pt.PatientID
            WHERE p.GlobalReferenceID = ?
        `, [refId]);

        if (prescriptions.length === 0) {
            return res.render('dashboard/viewPres', { 
                error: 'No prescription found with this reference ID' 
            });
        }

        const [medicines] = await conPool.query(`
            SELECT 
                MedicineName, 
                Dosage, 
                Instructions, 
                BeforeFood, 
                AfterFood
            FROM PRESCRIPTION_MEDICINE
            WHERE PrescriptionID = ?
        `, [prescriptions[0].PrescriptionID]);

        res.render('dashboard/printPrescription', { 
            prescription: prescriptions[0],
            medicines: medicines
        });
    } catch (err) {
        console.error('Error fetching prescription:', err);
        res.render('dashboard/viewPres', { 
            error: 'Database error, please try again later' 
        });
    }
});

module.exports = router;
