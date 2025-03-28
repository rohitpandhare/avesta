const {conPool } = require('../config/dbHandler')

async function getPatients (req, res) {
    try {
        if (req.session.user && req.session.user.Role === 'PATIENT') {
            // Get patientID
            const [patientData] = await conPool.query(
                'SELECT PatientID FROM patient WHERE UserID = ?',
                [req.session.user.UserID]
            );

            if (!patientData.length) {
                throw new Error('Patient ID not found');
            }

            // Get all data in parallel
            const [doctorRelationships, medicalRecords, prescriptions] = await Promise.all([
                conPool.query(`
                    SELECT 
                        dp.*,
                        d.Name as DoctorName,
                        d.Specialty,
                        d.Phone as DoctorPhone
                    FROM doctor_patient dp
                    LEFT JOIN doctor d ON dp.DoctorID = d.DoctorID
                    WHERE dp.PatientID = ?`,
                    [patientData[0].PatientID]
                ),
                conPool.query(`
                    SELECT 
                        mr.*,
                        d.Name as DoctorName
                    FROM medical_record mr
                    LEFT JOIN doctor d ON mr.DoctorID = d.DoctorID
                    WHERE mr.PatientID = ?`,
                    [patientData[0].PatientID]
                ),
                conPool.query(`
                    SELECT 
                        p.*,
                        d.Name as DoctorName
                    FROM prescription p
                    LEFT JOIN doctor d ON p.DoctorID = d.DoctorID
                    WHERE p.PatientID = ?`,
                    [patientData[0].PatientID]
                )
            ]);

            res.render('users/patient', {
                user: req.session.user,
                currentPatientID: patientData[0].PatientID,
                doctorRelationships: doctorRelationships[0],
                medicalRecords: medicalRecords[0],
                prescriptions: prescriptions[0],
                success: req.session.success,
                error: req.session.error
            });

            // Clear flash messages
            delete req.session.success;
            delete req.session.error;
        } else {
            res.redirect('/login');
        }
    } catch (err) {
        console.error('Error loading patient dashboard:', err);
        res.render('users/patient', {
            user: req.session.user,
            currentPatientID: null,
            doctorRelationships: [],
            medicalRecords: [],
            prescriptions: [],
            error: 'Error loading dashboard: ' + err.message
        });
    }
};

async function getPatientProfile (req, res) {
    const userId = req.session.user.UserID;
    const { Name, Address, Phone, DOB, BloodGroup } = req.body;

    try {
        await conPool.query(
            `UPDATE PATIENT SET 
                Name = ?, 
                Address = ?, 
                Phone = ?, 
                DOB = ?, 
                BloodGroup = ?
             WHERE UserID = ?`,
            [Name, Address, Phone, DOB, BloodGroup, userId]
        );

        // Update session
        req.session.user.profileComplete = true;
        res.redirect('/patient');
    } catch (err) {
        console.error(err);
        res.render('dashboard/singup', { 
            error: 'Failed to update profile',
            formData: req.body
        });
    }
};

module.exports ={
	getPatients,
	getPatientProfile
}

/**
 all task under patients

 	getMyPrescriptions  - of --Status ENUM('ACTIVE', 'COMPLETED', 'CANCELED') DEFAULT 'ACTIVE',

	viewMyDoctors

	createMedicalRecord,
	
	getPatientMedicalHistory,

	updateProfile

 */