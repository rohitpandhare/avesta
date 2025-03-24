// routes/publicRoutes.js
const router = require('express').Router();
var myDB = require('mysql2/promise'); //importing mysql 

const conPool = myDB.createPool({ //creating conpool connection - so all the func can acess them
    connectionLimit: 100,
    host: 'localhost',
    user: 'root',
    password: 'root',
    database: "doctorsync_db", //created DB
    debug: false,
    waitForConnections: true,
    queueLimit: 0
});


router.get('/', (req, res) => {
    res.render('dashboard/index');
});

router.get('/login', (req, res) => {
    res.render('dashboard/login');
});

router.get('/signup', (req, res) => {
    res.render('dashboard/signup');
});

router.get('/reset', (req, res) => {
    res.render('dashboard/resetPass');
});

// Find All Doctors
router.get('/findDr', async (req, res) => {
    try {
        const [doctors] = await conPool.query(`
            SELECT 
                DoctorID,
                Name,
                Specialty,
                Phone,
                LicenseNumber,
                Qualifications
            FROM DOCTOR
            ORDER BY Name
        `);

        res.render('dashboard/findDr', { doctors });
    } catch (err) {
        console.error('Error fetching doctors:', err);
        res.render('dashboard/findDr', { 
            doctors: [],
            error: 'Error retrieving doctor list'
        });
    }
});

// Search for Doctors
router.get('/findDr/search', async (req, res) => {
    try {
        const searchTerm = req.query.search || '';

        const [doctors] = await conPool.query(`
            SELECT 
                DoctorID,
                Name,
                Specialty,
                Phone,
                LicenseNumber,
                Qualifications
            FROM DOCTOR 
            WHERE 
                Name LIKE ? 
                OR Specialty LIKE ?
        `, [`%${searchTerm}%`, `%${searchTerm}%`]);

        res.render('dashboard/findDr', { doctors });
    } catch (err) {
        console.error('Error searching doctors:', err);
        res.render('dashboard/findDr', { 
            doctors: [],
            error: 'Error searching doctors'
        });
    }
});


// GET: View Prescription Form
router.get('/viewPres', (req, res) => {
    res.render('dashboard/viewPres');
});

// POST: Handle Prescription Lookup by Reference ID
router.post('/viewPres', async (req, res) => {
    try {
        const refId = req.body.refId;

        const [prescriptions] = await conPool.query(`
            SELECT 
                p.PrescriptionID, 
                p.DateIssued, 
                p.DiagnosisNotes, 
                p.Medicines, 
                p.Status, 
                p.GlobalReferenceID, 
                d.Name as DoctorName
            FROM PRESCRIPTION p
            JOIN DOCTOR d ON p.DoctorID = d.DoctorID
            WHERE p.GlobalReferenceID = ?
        `, [refId]);

        if (prescriptions.length === 0) {
            return res.render('dashboard/viewPres', { 
                error: 'No prescription found with this reference ID' 
            });
        }

        res.render('dashboard/viewPres', { prescription: prescriptions[0] });
    } catch (err) {
        console.error('Error fetching prescription:', err);
        res.render('dashboard/viewPres', { 
            error: 'Database error, please try again later' 
        });
    }
});


module.exports = router;
