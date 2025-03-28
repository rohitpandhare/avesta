const { conPool } = require('../config/dbHandler')

async function getAdmin (req, res){
    try {
        // Fetch all required data in parallel
        const [userList, doctorList, patientList] = await all([
            conPool.query('SELECT UserID, Username, Email, Role, CreatedAt FROM user'),
            conPool.query('SELECT DoctorID, Name, Specialty, Phone, LicenseNumber, Qualifications FROM doctor'),
            conPool.query('SELECT PatientID, Name, Address, Phone, DOB, BloodGroup FROM patient')
        ]);

        res.render('users/admin', {
            user: req.session.user,
            userList: userList[0],
            doctorList: doctorList[0],
            patientList: patientList[0]
        });
    } catch (err) {
        console.error('Error fetching admin data:', err);
        res.status(500).render('users/admin', {
            user: req.session.user,
            userList: [],
            doctorList: [],
            patientList: [],
            error: 'Error loading data'
        });
    }
};

// DELETE user
async function deleteUser (req, res) {
    const userId = req.params.id;

    try {
        const [result] = await conPool.query('DELETE FROM USER WHERE UserID = ?', [userId]);

        if (result.affectedRows > 0) {
            res.status(200).json({ success: true, message: 'User deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'User not found' });
        }
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error deleting user' });
    }
};

// DELETE doctor
async function deleteDoctor (req, res) {
    const doctorId = req.params.id;
    
    try {
        const connection = await conPool.getConnection();
        await connection.beginTransaction();

        const [doctorData] = await connection.query(
            'SELECT UserID FROM DOCTOR WHERE DoctorID = ?',
            [doctorId]
        );

        if (!doctorData.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Doctor not found' });
        }

        const userId = doctorData[0].UserID;

        await connection.query('DELETE FROM DOCTOR WHERE DoctorID = ?', [doctorId]);
        await connection.query('DELETE FROM USER WHERE UserID = ?', [userId]);

        await connection.commit();
        res.json({ success: true, message: 'Doctor deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error deleting doctor' });
    }
};

// DELETE patient
async function deletePatient (req, res) {
    const patientId = req.params.id;
    
    try {
        const connection = await conPool.getConnection();
        await connection.beginTransaction();

        const [patientData] = await connection.query(
            'SELECT UserID FROM PATIENT WHERE PatientID = ?',
            [patientId]
        );

        if (!patientData.length) {
            await connection.rollback();
            return res.status(404).json({ success: false, message: 'Patient not found' });
        }

        const userId = patientData[0].UserID;

        await connection.query('DELETE FROM PATIENT WHERE PatientID = ?', [patientId]);
        await connection.query('DELETE FROM USER WHERE UserID = ?', [userId]);

        await connection.commit();
        res.json({ success: true, message: 'Patient deleted successfully' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ success: false, message: 'Error deleting patient' });
    }
};

module.exports = {
    getAdmin,
    deleteUser,
    deleteDoctor,
    deletePatient
};
