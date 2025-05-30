const express = require('express');
const session = require('express-session');
const path = require('path');
const cors = require('cors');
const bodyParser = require('body-parser'); // This was already here

const app = express();
const port = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use(bodyParser.json()); // This was already here

// View engine setup
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// CORS configuration
const corsOptions = {
    credentials: true,
    origin: ['http://localhost:3001', 'http://localhost:3005'],
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    optionsSuccessStatus: 200
};
app.use(cors(corsOptions));

// Session middleware
app.use(session({
    secret: 'rohitiscool',
    resave: false,
    saveUninitialized: true,
    cookie: {
        secure: false,
        maxAge: 1000 * 60 * 60 * 24
    }
}));


// ADD THIS LOG
app.use((req, res, next) => {
    console.log(`Incoming Request (Global Middleware): ${req.method} ${req.originalUrl}`);
    next();
});

// --- IMPORTANT: Adjust the order of route mounting here ---
// Mount specific API routes (like admin or auth APIs) earlier
const authlinks = require('./routes/auth');
app.use('/auth', authlinks); // Auth routes are mounted under /auth

const adminLinks = require('./routes/adminRoutes');
console.log('--- Before mounting adminLinks ---');
app.use('/', adminLinks); // Admin routes mounted at root /

// ADD THIS LOG AFTER adminLinks MOUNTING
console.log('--- After mounting adminLinks ---');


// Now, mount more general or less specific routes later
const dashboardLinks = require('./routes/dashboardRoutes');
app.use('/', dashboardLinks);

const publicLinks = require('./routes/publicRoutes');
app.use('/', publicLinks);

const testLinks = require('./routes/testRoutes');
app.use('/', testLinks);

const doctorLinks = require('./routes/doctorRoutes');
app.use('/doctor', doctorLinks);

const patientLinks = require('./routes/patientRoutes');
app.use('/patient', patientLinks);

app.get("/testPres", (req, res) => {
    res.render("testPres");
});

const { conPool } = require('./config/dbHandler');

app.get("/search-patient", async (req, res) => {
    const searchQuery = req.query.query;
    
    if (!searchQuery) {
        return res.json([]);
    }

    try {
        const [patients] = await conPool.query(
            "SELECT PatientID, Name FROM patient WHERE Name LIKE ? LIMIT 5",
            [`%${searchQuery}%`]
        );
        res.json(patients);
    } catch (error) {
        console.error("Error fetching patients:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/search-med", async (req, res) => {
    const searchQuery = req.query.query;
    
    if (!searchQuery) {
        return res.json([]);
    }

    try {
        const [medicines] = await conPool.query(
            "SELECT name FROM medicines_data WHERE name LIKE ? LIMIT 10",
            [`%${searchQuery}%`]
        );
        res.json(medicines);
    } catch (error) {
        console.error("Error fetching medicines:", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get("/adminLogin", async (req, res) => {
    res.render("secret/adminLogin");
});

// Error handling middleware (should be last)
app.use((err, req, res, next) => {
    console.error('Unhandled Error:', err);
    res.status(500).render('error', {
        message: 'Internal Server Error'
    });
});

// Start server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});