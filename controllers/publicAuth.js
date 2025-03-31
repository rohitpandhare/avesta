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

// Handle Prescription Lookup
async function viewCreatedPres (req, res){
    try {
        const refId = req.query.refId;

        if (!refId) {
            return res.render('dashboard/viewPres', { error: 'Please enter a prescription reference ID' });
        }

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
};

module.exports = {
    findDoctor,
    findPerticularDoctor,
    viewPrescriptions,
    viewCreatedPres
};

