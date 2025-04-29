const { conPool } = require("../config/dbHandler");

// Helper function to generate reference ID
function generateReferenceId() {
    const prefix = 'RX';
    const timestamp = Date.now().toString();
    const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    const uniqueId = timestamp.slice(-3) + randomNum;
    return `${prefix}${uniqueId}`;
}


async function generatePrescription() {
    const connection = await conPool.getConnection();
    try {
        await connection.beginTransaction();
        
        const { PatientID, DoctorID, DiagnosisNotes, Status, GlobalReferenceID, medicines } = req.body;
        
        // 1. Insert the prescription header
        const [prescriptionResult] = await connection.query(
            `INSERT INTO PRESCRIPTION 
            (PatientID, DoctorID, DiagnosisNotes, Status, GlobalReferenceID) 
            VALUES (?, ?, ?, ?, ?)`,
            [PatientID, DoctorID, DiagnosisNotes, Status, GlobalReferenceID || null]
        );
        
        const prescriptionId = prescriptionResult.insertId;
        
        // 2. Insert each medicine with timing information
        for (const medicine of medicines) {
            await connection.query(
                `INSERT INTO PRESCRIPTION_MEDICINE 
                (PrescriptionID, MedicineName, Dosage, Instructions, BeforeFood, AfterFood, 
                 Morning, Afternoon, Evening, Night, FrequencyPerDay, DurationDays) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    prescriptionId,
                    medicine.MedicineName,
                    medicine.Dosage,
                    medicine.Instructions || null,
                    medicine.BeforeFood === 'true' ? 1 : 0,
                    medicine.AfterFood === 'true' ? 1 : 0,
                    medicine.Morning === 'true' ? 1 : 0,
                    medicine.Afternoon === 'true' ? 1 : 0,
                    medicine.Evening === 'true' ? 1 : 0,
                    medicine.Night === 'true' ? 1 : 0,
                    medicine.FrequencyPerDay || 1,
                    medicine.DurationDays || 7
                ]
            );
        }
        
        await connection.commit();
        res.render('testPrescription', { 
            success: 'Prescription added successfully!',
            // Keep form values for better UX
            originalValues: {
                PatientID,
                DoctorID,
                DiagnosisNotes,
                Status,
                GlobalReferenceID
            }
        });
    } catch (err) {
        await connection.rollback();
        console.error('Error:', err);
        res.render('testPrescription', { 
            error: 'Error adding prescription: ' + err.message,
            // Return submitted values to maintain form state
            originalValues: req.body
        });
    } finally {
        connection.release();
    }
};