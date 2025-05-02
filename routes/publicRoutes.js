const { conPool } = require('../config/dbHandler')
const router = require('express').Router();

const {
    findDoctor,
    findPerticularDoctor,
    viewPrescriptions
} = require('../controllers/publicAuth');

router.get('/findDr', findDoctor);
router.get('/findDr/search', findPerticularDoctor);

// Amended routes
router.get('/viewPres', viewPrescriptions);

router.get('/printPrescription/:refId', async (req, res) => {
    try {
        const refId = req.params.refId;

        const [prescriptions] = await conPool.query(`
            SELECT 
                p.PRESCRIPTIONID, 
                p.DATEISSUED, 
                p.DIAGNOSISNOTES,  
                p.STATUS, 
                p.GLOBALREFERENCEID, 
                p.VALIDITYDAYS,
                d.Name AS DoctorName,
                d.LicenseNumber,
                d.Phone,
                d.Specialty,
                pt.Name AS PatientName
            FROM PRESCRIPTION p
            LEFT JOIN DOCTOR d ON p.DOCTORID = d.DoctorID
            LEFT JOIN PATIENT pt ON p.PATIENTID = pt.PatientID
            WHERE p.GLOBALREFERENCEID = ?
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
                AfterFood,
                Morning,
                Afternoon,
                Evening,
                Night
            FROM prescription_medicine
            WHERE PrescriptionID = ?
        `, [prescriptions[0].PRESCRIPTIONID]);

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
