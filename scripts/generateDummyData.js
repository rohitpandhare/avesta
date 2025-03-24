const { faker } = require('@faker-js/faker');
const conPool = require('./seeders/dbConfig');

// Generate random user data
const createUser = (role) => {
    return {
        Username: faker.internet.username().substring(0, 20),
        Password: '\$2b\$10$abcdefghijklmnopqrstuvwx', // shorter hash
        Email: faker.internet.email().substring(0, 30),
        Role: role,
        CreatedAt: new Date(),
        LastLogin: null
    };
};

// Generate doctor data
const createDoctor = (userId) => {
    const specialties = [
        'Family Medicine', 'Internal Medicine', 'Pediatrics', 'Cardiology',
        'Dermatology', 'Neurology', 'Orthopedics', 'Psychiatry'
    ];

    return {
        UserID: userId,
        Name: faker.person.fullName().substring(0, 30),
        Specialty: faker.helpers.arrayElement(specialties),
        Phone: faker.string.numeric(10), // exactly 10 digits
        LicenseNumber: 'DOC' + faker.string.numeric(4),
        Qualifications: faker.helpers.arrayElement(['MBBS', 'MD', 'MS', 'DNB'])
    };
};

// Generate patient data
const createPatient = (userId) => {
    return {
        UserID: userId,
        Name: faker.person.fullName().substring(0, 30),
        Address: faker.location.streetAddress().substring(0, 50),
        Phone: faker.string.numeric(10), // exactly 10 digits
        DOB: faker.date.birthdate({ min: 18, max: 80, mode: 'year' }),
        BloodGroup: faker.helpers.arrayElement(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
        MedicalHistory: faker.lorem.sentence().substring(0, 100) // shorter medical history
    };
};

// Insert dummy data
async function seedDatabase(doctorCount = 5, patientCount = 10) {
    try {
        console.log('Starting database seeding...');
        const pool = conPool.promise();

        // Insert doctors
        for (let i = 0; i < doctorCount; i++) {
            try {
                const userData = createUser('DOCTOR');
                const [userResult] = await pool.query('INSERT INTO USER SET ?', userData);
                
                const doctorData = createDoctor(userResult.insertId);
                await pool.query('INSERT INTO DOCTOR SET ?', doctorData);
                
                console.log(`Doctor created with UserID: ${userResult.insertId}`);
            } catch (err) {
                console.error('Error creating doctor:', err.message);
            }
        }

        // Insert patients
        for (let i = 0; i < patientCount; i++) {
            try {
                const userData = createUser('PATIENT');
                const [userResult] = await pool.query('INSERT INTO USER SET ?', userData);
                
                const patientData = createPatient(userResult.insertId);
                await pool.query('INSERT INTO PATIENT SET ?', patientData);
                
                console.log(`Patient created with UserID: ${userResult.insertId}`);
            } catch (err) {
                console.error('Error creating patient:', err.message);
            }
        }

        console.log('Seeding completed successfully');
        await pool.end();
        process.exit(0);

    } catch (error) {
        console.error('Seeding failed:', error.message);
        process.exit(1);
    }
}

// Run the seeder
seedDatabase(3, 5); // Reduced number of records to create
