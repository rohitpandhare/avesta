const { faker } = require('@faker-js/faker');
const conPool = require('./seeders/dbConfig');

// Indian name pools
const indianFirstNames = [
    'Amit', 'Rohit', 'Sanjay', 'Kiran', 'Priya', 'Neha',
    'Anjali', 'Raj', 'Vikas', 'Divya', 'Sunita', 'Pooja',
    'Ravi', 'Ankit', 'Manoj', 'Sneha', 'Vivek', 'Asha'
];
const indianLastNames = [
    'Sharma', 'Patel', 'Verma', 'Singh', 'Mehta',
    'Desai', 'Reddy', 'Nair', 'Iyer', 'Pandey',
    'Mishra', 'Joshi', 'Kapoor', 'Bose', 'Chatterjee'
];

// Generate Indian-style full name
const getFullName = () => {
    const useIndianName = Math.random() < 0.6; // ~60% Indian names, 40% Western
    if (useIndianName) {
        const first = faker.helpers.arrayElement(indianFirstNames);
        const last = faker.helpers.arrayElement(indianLastNames);
        return `${first} ${last}`;
    } else {
        return faker.person.fullName();
    }
};


// Generate random user data
const createUser = (role) => {
    return {
        Username: faker.internet.username().substring(0, 50),
        Password: '$2b$10$abcdefghijklmnopqrstuvwx', // Example bcrypt hash
        Email: faker.internet.email().substring(0, 100),
        Role: role,
        CreatedAt: new Date(),
        LastLogin: null,
        IsActive: 1,
        FailedLoginAttempts: 0,
        LastPasswordChange: null,
        Flag: 0
    };
};

// Generate doctor data
const createDoctor = (userId) => {
    const specialties = [
        'Family Medicine', 'Internal Medicine', 'Pediatrics', 'Cardiology',
        'Dermatology', 'Neurology', 'Orthopedics', 'Psychiatry',
        'Obstetrics', 'ENT', 'Ophthalmology', 'Urology',
        'Oncology', 'Endocrinology', 'Pulmonology',
        'Gastroenterology', 'Nephrology', 'Rheumatology', 'Other'
    ];
    const selectedSpecialty = faker.helpers.arrayElement(specialties);

    return {
        UserID: userId,
        Name: getFullName().substring(0, 100),
        Specialty: selectedSpecialty,
        other_specialty: selectedSpecialty === 'Other' ? faker.lorem.words(2).substring(0, 100) : null,
        Phone: faker.string.numeric(10),
        LicenseNumber: 'DOC' + faker.string.numeric(6),
        LicenseDocument: null,
        Qualifications: faker.helpers.arrayElement(['MBBS', 'MD', 'MS', 'DNB']),
        IsVerified: 0,
        VerificationDate: null,
        Flag: 0
    };
};

// Generate patient data
const createPatient = (userId) => {
    return {
        UserID: userId,
        Name: getFullName().substring(0, 100),
        Address: faker.location.streetAddress().slice(0, 100),
        Phone: faker.string.numeric(10),
        DOB: faker.date.birthdate({ min: 18, max: 80, mode: 'year' }),
        BloodGroup: faker.helpers.arrayElement(['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
        MedicalHistory: faker.lorem.sentences(1).substring(0, 200),
        EmergencyContact: getFullName().substring(0, 100),
        EmergencyPhone: faker.string.numeric(10),
        Flag: 0
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
                const [userResult] = await pool.query('INSERT INTO user SET ?', userData);

                const doctorData = createDoctor(userResult.insertId);
                await pool.query('INSERT INTO doctor SET ?', doctorData);

                console.log(`Doctor created with UserID: ${userResult.insertId}`);
            } catch (err) {
                console.error('Error creating doctor:', err.message);
            }
        }

        // Insert patients
        for (let i = 0; i < patientCount; i++) {
            try {
                const userData = createUser('PATIENT');
                const [userResult] = await pool.query('INSERT INTO user SET ?', userData);

                const patientData = createPatient(userResult.insertId);
                await pool.query('INSERT INTO patient SET ?', patientData);

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
seedDatabase(3, 5);
