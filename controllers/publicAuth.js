const { conPool } = require('../config/dbHandler')

// Find All Doctors & Search for Doctors with Pagination
async function findDoctor(req, res) {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 4; // Set limit to 4 doctors per page
        const offset = (page - 1) * limit; // Calculate offset for pagination

        const searchTerm = req.query.search || '';

        // Base query for active doctors
        let doctorQuery = 'SELECT DoctorID, Name, Specialty, Phone, LicenseNumber, Qualifications FROM doctor WHERE Flag = 0';

        // Count query for total doctors
        let countDoctorQuery = 'SELECT COUNT(*) as totalDoctors FROM doctor WHERE Flag = 0';
        const queryParams = [];
        const countQueryParams = [];

        if (searchTerm) {
            // Add search condition with AND
            doctorQuery += ' AND (Name LIKE ? OR Specialty LIKE ?)';
            countDoctorQuery += ' AND (Name LIKE ? OR Specialty LIKE ?)';
            queryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
            countQueryParams.push(`%${searchTerm}%`, `%${searchTerm}%`);
        }

        doctorQuery += ' ORDER BY Name LIMIT ? OFFSET ?'; // Order by name and apply pagination
        queryParams.push(limit, offset);

        const [doctorsResult] = await conPool.query(doctorQuery, queryParams);
        const [totalDoctorsCountResult] = await conPool.query(countDoctorQuery, countQueryParams);

        const doctors = doctorsResult;
        const totalDoctors = totalDoctorsCountResult[0].totalDoctors;
        const totalPages = Math.ceil(totalDoctors / limit);

        res.render('dashboard/findDr', {
            doctors,
            currentPage: page,
            totalPages,
            limit,
            searchTerm,
            user: req.session.user || null // Pass user session if available for nav.ejs
        });

    } catch (err) {
        console.error('Error fetching doctors:', err);
        res.render('dashboard/findDr', {
            doctors: [],
            currentPage: 1,
            totalPages: 1,
            limit: 4,
            searchTerm: '',
            error: 'Error retrieving doctor list',
            user: req.session.user || null
        });
    }
}

// View Prescription Form
async function viewPrescriptions(req, res){
    res.render('dashboard/viewPres');
};

async function printPres(req, res){
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
                pt.Name AS PatientName,
                pt.AadharID AS aadharID
            FROM prescription p
            LEFT JOIN doctor d ON p.DOCTORID = d.DoctorID
            LEFT JOIN patient pt ON p.PATIENTID = pt.PatientID
            WHERE p.STATUS = 'ACTIVE' AND p.GLOBALREFERENCEID = ?
        `, [refId]);

        if (prescriptions.length === 0) {
            return res.render('dashboard/viewPres', { 
                error: 'No prescription found with this reference ID or it has been deactivated.' 
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
};

module.exports = {
    findDoctor,
    viewPrescriptions,
    printPres
};
