const { faker } = require('@faker-js/faker');
const conPool = require('./seeders/dbConfig');

// Hardcoded medicines (name + dosage)
const medicines = [
  { name: 'Paracetamol', dosage: '500mg' },
  { name: 'Amoxicillin', dosage: '250mg' },
  { name: 'Ibuprofen', dosage: '400mg' },
  { name: 'Azithromycin', dosage: '500mg' },
  { name: 'Ciprofloxacin', dosage: '250mg' },
  { name: 'Cetirizine', dosage: '10mg' },
  { name: 'Metformin', dosage: '500mg' },
  { name: 'Atorvastatin', dosage: '10mg' },
  { name: 'Omeprazole', dosage: '20mg' },
  { name: 'Pantoprazole', dosage: '40mg' }
];

// Utility
const generateGlobalReferenceID = () => 'RX' + faker.string.numeric(6);

// Prescription generator
const createPrescription = (doctorId, patientId) => ({
  PatientID: patientId,
  DoctorID: doctorId,
  DateIssued: new Date(),
  DiagnosisNotes: faker.lorem.sentences(2),
  ValidityDays: faker.number.int({ min: 7, max: 15 }),
  Status: faker.helpers.arrayElement(['ACTIVE', 'COMPLETED', 'CANCELED', 'EXPIRED']),
  GlobalReferenceID: generateGlobalReferenceID(),
  LastModified: new Date(),
  Flag: 0
});

// Prescription medicine generator
const createPrescriptionMedicine = (prescriptionId) => {
  const medicine = faker.helpers.arrayElement(medicines);
  return {
    PrescriptionID: prescriptionId,
    MedicineName: medicine.name,
    Dosage: medicine.dosage,
    Instructions: faker.lorem.sentence(),
    DrugLevel: faker.number.int({ min: 1, max: 10 }),
    BeforeFood: faker.datatype.boolean() ? 1 : 0,
    AfterFood: faker.datatype.boolean() ? 1 : 0,
    Morning: faker.datatype.boolean() ? 1 : 0,
    Afternoon: faker.datatype.boolean() ? 1 : 0,
    Evening: faker.datatype.boolean() ? 1 : 0,
    Night: faker.datatype.boolean() ? 1 : 0,
    FrequencyPerDay: faker.number.int({ min: 1, max: 3 }),
    DurationDays: faker.number.int({ min: 3, max: 15 }),
    SpecialInstructions: faker.lorem.sentence().substring(0, 255)
  };
};

// Indian name generator
const indianFirstNames = ['Amit', 'Rohit', 'Sanjay', 'Kiran', 'Priya', 'Neha', 'Anjali', 'Raj', 'Vikas', 'Divya'];
const indianLastNames = ['Sharma', 'Patel', 'Verma', 'Singh', 'Mehta', 'Desai', 'Reddy', 'Nair', 'Iyer', 'Pandey'];
const getFullName = () => {
  const useIndianName = Math.random() < 0.6;
  return useIndianName
    ? `${faker.helpers.arrayElement(indianFirstNames)} ${faker.helpers.arrayElement(indianLastNames)}`
    : faker.person.fullName();
};

// User generator
const createUser = (role) => ({
  Username: faker.internet.username().substring(0, 50),
  Password: '$2b$10$abcdefghijklmnopqrstuvwx', // bcrypt dummy
  Email: faker.internet.email().substring(0, 100),
  Role: role,
  CreatedAt: new Date(),
  LastLogin: null,
  IsActive: 1,
  FailedLoginAttempts: 0,
  LastPasswordChange: null,
  Flag: 0
});

// Doctor and patient creators
const createDoctor = (userId) => {
  const specialties = ['Family Medicine', 'Internal Medicine', 'Pediatrics', 'Cardiology', 'Other'];
  const selected = faker.helpers.arrayElement(specialties);
  return {
    UserID: userId,
    Name: getFullName().substring(0, 100),
    Specialty: selected,
    other_specialty: selected === 'Other' ? faker.lorem.words(2).substring(0, 100) : null,
    Phone: faker.string.numeric(10),
    LicenseNumber: 'DOC' + faker.string.numeric(6),
    LicenseDocument: null,
    Qualifications: faker.helpers.arrayElement(['MBBS', 'MD', 'MS', 'DNB']),
    IsVerified: 0,
    VerificationDate: null,
    Flag: 0
  };
};

const createPatient = (userId) => ({
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
});

// Main seeder
async function seedDatabase(doctorCount = 3, patientCount = 5) {
  try {
    console.log('🔄 Starting database seeding...');
    const pool = conPool.promise();

    const doctorIDs = [];
    const patientIDs = [];

    // Doctors
    for (let i = 0; i < doctorCount; i++) {
      const [userRes] = await pool.query('INSERT INTO user SET ?', createUser('DOCTOR'));
      const [docRes] = await pool.query('INSERT INTO doctor SET ?', createDoctor(userRes.insertId));
      doctorIDs.push(docRes.insertId);
      console.log(`✅ Doctor inserted: ${docRes.insertId}`);
    }

    // Patients
    for (let i = 0; i < patientCount; i++) {
      const [userRes] = await pool.query('INSERT INTO user SET ?', createUser('PATIENT'));
      const [patRes] = await pool.query('INSERT INTO patient SET ?', createPatient(userRes.insertId));
      patientIDs.push(patRes.insertId);
      console.log(`✅ Patient inserted: ${patRes.insertId}`);
    }

    // Prescriptions
    for (const patientId of patientIDs) {
      const doctorId = faker.helpers.arrayElement(doctorIDs);
      const prescription = createPrescription(doctorId, patientId);
      const [presRes] = await pool.query('INSERT INTO prescription SET ?', prescription);

      const medCount = faker.number.int({ min: 1, max: 3 });
      for (let m = 0; m < medCount; m++) {
        const presMed = createPrescriptionMedicine(presRes.insertId);
        await pool.query('INSERT INTO prescription_medicine SET ?', presMed);
      }

      console.log(`📝 Prescription created: ${prescription.GlobalReferenceID}`);
    }

    console.log('✅ Seeding completed.');
    await pool.end();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  }
}

// Run
seedDatabase(3, 5);
