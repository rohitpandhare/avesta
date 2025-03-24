// routes/adminRoutes.js
const router = require('express').Router();
// Role check middleware

const { checkRole } = require('../middlware/dc_middleware');
router.use(checkRole(['ADMIN']));

router.get('/', async (req, res) => {
    try {
        const [adminDetails] = await conPool.query(
            'SELECT Username FROM user WHERE UserID = ?',
            [req.session.user.UserID]
        );

        const [userList, doctorList, patientList] = await Promise.all([
            conPool.query('SELECT UserID, Username, Email, Role, CreatedAt FROM user'),
            conPool.query('SELECT DoctorID, Name, Specialty, Phone, LicenseNumber, Qualifications FROM doctor'),
            conPool.query('SELECT PatientID, Name, Address, Phone, DOB, BloodGroup FROM patient')
        ]);
        
        res.render('users/admin', { 
            user: adminDetails[0] || { Username: 'Admin' },
            userList: userList[0],
            doctorList: doctorList[0],
            patientList: patientList[0]
        });
    } catch (err) {
        console.error('Error fetching data:', err);
        res.render('users/admin', { 
            user: { Username: 'Admin' },
            userList: [],
            doctorList: [],
            patientList: []
        });
    }
});

router.post('/delete-doctor/:id', async (req, res) => {
    try {
        await conPool.query('DELETE FROM doctor WHERE DoctorID = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting doctor:', err);
        res.status(500).json({ success: false });
    }
});

router.post('/delete-patient/:id', async (req, res) => {
    try {
        await conPool.query('DELETE FROM patient WHERE PatientID = ?', [req.params.id]);
        res.json({ success: true });
    } catch (err) {
        console.error('Error deleting patient:', err);
        res.status(500).json({ success: false });
    }
});

module.exports = router;
