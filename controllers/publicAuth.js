const { conPool } = require('../config/dbHandler')

// Find All Doctors
async function findDoctor(req, res) {
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
};

// Search for Doctors
async function findPerticularDoctor(req, res){
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
};

// View Prescription Form
async function viewPrescriptions(req, res){
    res.render('dashboard/viewPres');
};

module.exports = {
    findDoctor,
    findPerticularDoctor,
    viewPrescriptions,
    // viewCreatedPres
};

// // Handle Prescription Lookup
// async function viewCreatedPres(req, res) {
//     try {
//         const refId = req.query.refId;

//         if (!refId) {
//             return res.render('dashboard/viewPres', { error: 'Please enter a prescription reference ID' });
//         }

//         // Fetch prescription details including patient name
//         const [prescriptions] = await conPool.query(`
//             SELECT 
//                 p.PrescriptionID, 
//                 p.DateIssued, 
//                 p.DiagnosisNotes,  
//                 p.Status, 
//                 p.GlobalReferenceID, 
//                 p.ValidityDays,
//                 d.Name as DoctorName,
//                 pt.Name as PatientName
//             FROM PRESCRIPTION p
//             JOIN DOCTOR d ON p.DoctorID = d.DoctorID
//             JOIN PATIENT pt ON p.PatientID = pt.PatientID
//             WHERE p.GlobalReferenceID = ?
//         `, [refId]);

//         if (prescriptions.length === 0) {
//             return res.render('dashboard/viewPres', { 
//                 error: 'No prescription found with this reference ID' 
//             });
//         }

//         // Fetch associated medicines
//         const [medicines] = await conPool.query(`
//             SELECT 
//                 MedicineName, 
//                 Dosage, 
//                 Instructions, 
//                 BeforeFood, 
//                 AfterFood
//             FROM PRESCRIPTION_MEDICINE
//             WHERE PrescriptionID = ?
//         `, [prescriptions[0].PrescriptionID]);

//         res.render('dashboard/viewPres', { 
//             prescription: prescriptions[0],
//             medicines: medicines
//         });
//     } catch (err) {
//         console.error('Error fetching prescription:', err);
//         res.render('dashboard/viewPres', { 
//             error: 'Database error, please try again later' 
//         });
//     }
// }

