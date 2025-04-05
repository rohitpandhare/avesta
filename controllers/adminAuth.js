const { conPool } = require('../config/dbHandler')
const md5 = require('md5'); // for hashing passwords

async function getAdmin(req, res) {
    try {
        const { Username, Password } = req.body;

        // Basic validation
        if (!Username || !Password) {
            return res.render('secret/adminLogin', {
                error: 'All fields are required'
            });
        }

        const hashedPassword = md5(Password);

        // Query to find user
        const [users] = await conPool.query(
            'SELECT * FROM user WHERE Username = ?',
            [Username]
        );
        Role = 'admin';

        if (!users.length || users[0].Password !== hashedPassword){
            return res.render('secret/adminLogin', {
                error: 'Invalid credentials'
            });
        }

        // Set up base session
        req.session.user = {
            UserID: users[0].UserID,
            Username: users[0].Username,
            Role: Role
        };

        const [userList, doctorList, patientList, prescriptionStats] = await Promise.all([
            conPool.query('SELECT * FROM user'),
            conPool.query(`
                SELECT d.*, u.Username
                FROM doctor d
                JOIN user u ON d.UserID = u.UserID
                WHERE u.Role = 'DOCTOR'
            `),
            conPool.query(`
                SELECT p.*, u.Username
                FROM patient p
                JOIN user u ON p.UserID = u.UserID
                WHERE u.Role = 'PATIENT'
            `),
            conPool.query(`
                SELECT 
                    d.Specialty, 
                    SUM(CASE WHEN p.Status = 'ACTIVE' THEN 1 ELSE 0 END) as active,
                    SUM(CASE WHEN p.Status = 'COMPLETED' THEN 1 ELSE 0 END) as completed
                FROM 
                    prescription p
                JOIN 
                    doctor d ON p.DoctorID = d.DoctorID
                GROUP BY 
                    d.Specialty
            `)
        ]);
    
        // Process specialties data (same as in getAdmin)
        const specialtyStats = {};
        doctorList[0].forEach(doctor => {
            const spec = doctor.Specialty || 'Other';
            if (!specialtyStats[spec]) {
                specialtyStats[spec] = {
                    doctorCount: 0,
                    activePrescriptions: 0,
                    completedPrescriptions: 0
                };
            }
            specialtyStats[spec].doctorCount++;
        });
    
        prescriptionStats[0].forEach(row => {
            const spec = row.Specialty || 'Other';
            if (specialtyStats[spec]) {
                specialtyStats[spec].activePrescriptions = row.active;
                specialtyStats[spec].completedPrescriptions = row.completed;
            }
        });
    
        const specialties = Object.entries(specialtyStats)
            .map(([name, stats]) => ({ name, ...stats }))
            .sort((a, b) => b.doctorCount - a.doctorCount);
    
        return res.render('users/admin', {
            user: req.session.user,
            userList: userList[0],
            doctorList: doctorList[0],
            patientList: patientList[0],
            specialties: specialties // MUST include this
        });
        
    } catch (err) {
        console.error('Login error:', err);
        return res.render('secret/adminLogin', {
            error: 'Server error during login: ' + err.message
        });
    }
}

async function createAdmin (req,res){
    const { 
        Username, Email, Password
    } = req.body;

    // Base validation
    if (!Username || !Email || !Password) {
        return res.status(400).render('secret/adminCreate', {
            error: "All fields are required"
        });
    }

    const connection = await conPool.getConnection();
    try {
        await connection.beginTransaction();
        const createdAt = new Date().toISOString().split('T')[0];
        Role = 'admin';
        // Insert into USER table
        const [userResult] = await connection.query(
            `INSERT INTO user (Username, Email, Password,Role,CreatedAt)
             VALUES (?, ?, ?, ?,?)`,
            [Username, Email, md5(Password),Role, createdAt]
        );
        const userId = userResult.insertId;

        await connection.commit();

        req.session.user = {
            UserID: userId,
            Username,
            Role
        };

        res.redirect(`/silver`);

    } catch (err) {
        await connection.rollback();
        console.error("Signup error:", err);
        
        const errorMessage = err.code === 'ER_DUP_ENTRY' 
            ? "Username or email already exists" 
            : "Registration failed";
        
        res.status(400).render('secret/adminCreate', { 
            error: errorMessage
        });
    } finally {
        connection.release();
    }
}
module.exports = {
    getAdmin,
    createAdmin
    // deleteUser,
    // deleteDoctor,
    // deletePatient
};


// DELETE user
// async function deleteUser (req, res) {
//     const userId = req.params.id;

//     try {
//         const [result] = await conPool.query('DELETE FROM USER WHERE UserID = ?', [userId]);

//         if (result.affectedRows > 0) {
//             res.status(200).json({ success: true, message: 'User deleted successfully' });
//         } else {
//             res.status(404).json({ success: false, message: 'User not found' });
//         }
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ success: false, message: 'Error deleting user' });
//     }
// };

// // DELETE doctor
// async function deleteDoctor (req, res) {
//     const doctorId = req.params.id;
    
//     try {
//         const connection = await conPool.getConnection();
//         await connection.beginTransaction();

//         const [doctorData] = await connection.query(
//             'SELECT UserID FROM DOCTOR WHERE DoctorID = ?',
//             [doctorId]
//         );

//         if (!doctorData.length) {
//             await connection.rollback();
//             return res.status(404).json({ success: false, message: 'Doctor not found' });
//         }

//         const userId = doctorData[0].UserID;

//         await connection.query('DELETE FROM DOCTOR WHERE DoctorID = ?', [doctorId]);
//         await connection.query('DELETE FROM USER WHERE UserID = ?', [userId]);

//         await connection.commit();
//         res.json({ success: true, message: 'Doctor deleted successfully' });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ success: false, message: 'Error deleting doctor' });
//     }
// };

// // DELETE patient
// async function deletePatient (req, res) {
//     const patientId = req.params.id;
    
//     try {
//         const connection = await conPool.getConnection();
//         await connection.beginTransaction();

//         const [patientData] = await connection.query(
//             'SELECT UserID FROM PATIENT WHERE PatientID = ?',
//             [patientId]
//         );

//         if (!patientData.length) {
//             await connection.rollback();
//             return res.status(404).json({ success: false, message: 'Patient not found' });
//         }

//         const userId = patientData[0].UserID;

//         await connection.query('DELETE FROM PATIENT WHERE PatientID = ?', [patientId]);
//         await connection.query('DELETE FROM USER WHERE UserID = ?', [userId]);

//         await connection.commit();
//         res.json({ success: true, message: 'Patient deleted successfully' });
//     } catch (err) {
//         console.error(err);
//         res.status(500).json({ success: false, message: 'Error deleting patient' });
//     }
// };
