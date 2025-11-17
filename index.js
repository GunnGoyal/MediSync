const auth = require('./middleware/auth');
// ...existing code...
// (moved below app initialization)
// Import Express and PostgreSQL
const express = require('express');
const { Pool } = require('pg');
require('dotenv').config();

// Create an Express app
const app = express();
// Middleware to parse form data and JSON (must be before any routes)
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// Session middleware setup
const session = require('express-session');
app.use(session({
    secret: process.env.SESSION_SECRET || 'your_session_secret',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 2 * 60 * 60 * 1000 } // 2 hours
}));

// Setup Socket.IO early (before routes)
const http = require('http');
const server = http.createServer(app);
const { Server } = require('socket.io');
const io = new Server(server);

// Socket.IO connection handling
io.on('connection', (socket) => {
    console.log('✅ A user connected:', socket.id);
    console.log('   Total connected clients:', io.engine.clientsCount);
    
    socket.on('disconnect', () => {
        console.log('❌ User disconnected:', socket.id);
        console.log('   Remaining clients:', io.engine.clientsCount);
    });
});

// Make io accessible in routes (MUST be before routes that use it)
app.set('io', io);

// Add direct POST route for doctor registration so the form works
const { registerDoctor } = require('./controllers/doctorsController');
app.post('/doctors/register', registerDoctor);

// PostgreSQL connection configuration
const pool = new Pool({
  user: process.env.DB_USER || 'postgres',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'your_database',
  password: process.env.DB_PASSWORD || 'your_password',
  port: process.env.DB_PORT || 5432,
});

// Book appointment form (patient)
const patientAuth = require('./middleware/patientAuth');
app.get('/patients/book-appointment/:doctorId', patientAuth, async (req, res) => {
    try {
        const doctorId = req.params.doctorId;
        const client = await pool.connect();
        const result = await client.query('SELECT * FROM doctors WHERE id = $1', [doctorId]);
        client.release();
        if (result.rows.length === 0) return res.status(404).send('Doctor not found');
        res.render('patients/book_appointment', { doctor: result.rows[0], error: null });
    } catch (err) {
        res.status(500).send('Error loading appointment form');
    }
});

// Handle appointment booking (patient)
app.post('/patients/book-appointment/:doctorId', patientAuth, async (req, res) => {
    try {
        const doctorId = req.params.doctorId;
        const patient_id = req.session.patient.id; // Get from session
        const patientName = req.session.patient.name;
        const { appointment_date, start_time, end_time } = req.body;
        // Prevent double booking
        const client = await pool.connect();
        const conflict = await client.query(
            `SELECT * FROM appointments WHERE doctor_id = $1 AND appointment_date = $2
            AND NOT ($4 <= start_time OR $3 >= end_time)`,
            [doctorId, appointment_date, start_time, end_time]
        );
        if (conflict.rows.length > 0) {
            const docResult = await client.query('SELECT * FROM doctors WHERE id = $1', [doctorId]);
            client.release();
            return res.render('patients/book_appointment', { doctor: docResult.rows[0], error: 'This doctor is already booked for the selected time.' });
        }
        // Insert appointment with status 'pending'
        const insertResult = await client.query(
            'INSERT INTO appointments (patient_id, doctor_id, appointment_date, start_time, end_time, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
            [patient_id, doctorId, appointment_date, start_time, end_time, 'pending']
        );
        const appointmentId = insertResult.rows[0].id;
        client.release();
        
        // Emit Socket.IO event for real-time update
        const io = req.app.get('io');
        if (!io) {
            console.error('❌ ERROR: Socket.IO instance not found!');
        } else {
            console.log('📡 Emitting appointmentBooked event...');
            console.log('   Doctor ID:', parseInt(doctorId));
            console.log('   Patient Name:', patientName);
            console.log('   Appointment ID:', appointmentId);
            
            io.emit('appointmentBooked', {
                doctorId: parseInt(doctorId),
                patientName: patientName,
                timeSlot: `${appointment_date} ${start_time} - ${end_time}`,
                appointmentId: appointmentId,
                appointmentDate: appointment_date,
                startTime: start_time,
                endTime: end_time,
                status: 'pending'
            });
            
            console.log('✅ appointmentBooked event emitted successfully');
        }
        
        // Redirect to confirmation page
        res.redirect(`/patients/appointment-confirmation/${appointmentId}`);
    } catch (err) {
        console.error('Error booking appointment:', err);
        res.status(500).send('Error booking appointment');
    }
});

// Patient dashboard: show all available specializations
app.get('/patients/dashboard', patientAuth, async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT DISTINCT specialization FROM doctors WHERE specialization IS NOT NULL AND specialization <> \'\'');
        client.release();
        const specializations = result.rows.map(row => row.specialization);
        res.render('patients/dashboard', { 
            specializations,
            patient: req.session.patient
        });
    } catch (err) {
        res.status(500).send('Error loading dashboard');
    }
});

// Patient dashboard: show doctors for a specialization
app.get('/patients/dashboard/:specialization', patientAuth, async (req, res) => {
    try {
        const specialization = req.params.specialization;
        const client = await pool.connect();
        let doctorsQuery = 'SELECT * FROM doctors WHERE specialization = $1';
        let doctorsParams = [specialization];

        let doctorsResult = await client.query(doctorsQuery, doctorsParams);
        let doctors = doctorsResult.rows;

        client.release();
        res.render('patients/doctors', { 
            specialization, 
            doctors
        });
    } catch (err) {
        console.error('Error loading doctors:', err);
        res.status(500).send('Error loading doctors');
    }
});

// Appointment confirmation page
app.get('/patients/appointment-confirmation/:appointmentId', patientAuth, async (req, res) => {
    try {
        const appointmentId = req.params.appointmentId;
        const client = await pool.connect();
        
        const result = await client.query(`
            SELECT a.*, d.name as doctor_name, d.specialization, p.name as patient_name
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            JOIN patients p ON a.patient_id = p.id
            WHERE a.id = $1
        `, [appointmentId]);
        
        client.release();
        
        if (result.rows.length === 0) {
            return res.status(404).send('Appointment not found');
        }
        
        const appointment = result.rows[0];
        res.render('patients/appointment_confirmation', {
            patient: { name: appointment.patient_name },
            doctor: { name: appointment.doctor_name, specialization: appointment.specialization },
            appointment: appointment
        });
    } catch (err) {
        console.error('Error loading confirmation:', err);
        res.status(500).send('Error loading confirmation');
    }
});

// Patient appointments list
app.get('/patients/my-appointments', patientAuth, async (req, res) => {
    try {
        const patientId = req.session.patient.id;
        const client = await pool.connect();
        
        const result = await client.query(`
            SELECT a.*, d.name as doctor_name, d.specialization
            FROM appointments a
            JOIN doctors d ON a.doctor_id = d.id
            WHERE a.patient_id = $1
            ORDER BY a.appointment_date DESC, a.start_time DESC
        `, [patientId]);
        
        client.release();
        
        res.render('patients/my_appointments', {
            patient: req.session.patient,
            appointments: result.rows
        });
    } catch (err) {
        console.error('Error loading appointments:', err);
        res.status(500).send('Error loading appointments');
    }
});

// Test database connection
pool.connect((err, client, release) => {
  if (err) {
    return console.error('❌ Error connecting to PostgreSQL:', err.stack);
  }
  console.log('✅ Connected to PostgreSQL database successfully!');
  release();
});

// Handle pool errors
pool.on('error', (err, client) => {
  console.error('❌ Unexpected error on idle client', err);
  process.exit(-1);
});

// Define the port
const PORT = process.env.PORT || 3000;

// Middleware to parse JSON bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Add logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Import and use routes
const patientsRoutes = require('./routes/patients');
const doctorsRoutes = require('./routes/doctors');
app.use('/api/patients', patientsRoutes);
app.use('/doctors', doctorsRoutes);

// Set EJS as the view engine
app.set('view engine', 'ejs');
app.set('views', __dirname + '/views');

// Serve static files
app.use(express.static(__dirname + '/public'));

// Homepage
app.get('/', (req, res) => {
    res.render('index');
});

// Patient registration form
app.get('/patients/register', (req, res) => {
    res.render('patients/register');
});

// Patient login form
app.get('/patients/login', (req, res) => {
    res.render('patients/login');
});

// Handle patient login form POST
const { loginPatient } = require('./controllers/patientsController');
app.post('/patients/login', async (req, res) => {
    const { contact, password } = req.body;
    const db = require('./db');
    const bcrypt = require('bcryptjs');
    try {
        if (!contact || !password) {
            return res.render('patients/login', { error: 'Contact and password are required.' });
        }
        const query = 'SELECT * FROM patients WHERE contact = $1';
        const result = await db.query(query, [contact]);
        if (result.rows.length === 0) {
            return res.render('patients/login', { error: 'Invalid credentials or patient not found.' });
        }
        const patient = result.rows[0];
        const validPassword = await bcrypt.compare(password, patient.password);
        if (!validPassword) {
            return res.render('patients/login', { error: 'Invalid credentials or patient not found.' });
        }
        // Set session for patient
        req.session.patient = {
            id: patient.id,
            name: patient.name,
            contact: patient.contact
        };
        console.log('Patient session set, redirecting to dashboard');
        // Login successful, redirect to dashboard
        return res.redirect('/patients/dashboard');
    } catch (error) {
        console.error('Patient login error:', error);
        return res.render('patients/login', { error: 'Internal server error during patient login.' });
    }
});

// Doctor registration form
app.get('/doctors/register', (req, res) => {
    res.render('doctors/register');
});

// Doctor login form
app.get('/doctors/login', (req, res) => {
    res.render('doctors/login');
});

// Login choice page
app.get('/login', (req, res) => {
    res.render('login');
});

// Additional example routes
app.get('/api/status', (req, res) => {
    res.json({
        message: 'Server is running successfully!',
        timestamp: new Date().toISOString(),
        port: PORT
    });
});

// Database test route
app.get('/api/db-test', async (req, res) => {
    try {
        const client = await pool.connect();
        const result = await client.query('SELECT NOW() as current_time, version() as version');
        client.release();
        
        res.json({
            message: 'Database connection successful!',
            data: result.rows[0]
        });
    } catch (err) {
        console.error('Database query error:', err);
        res.status(500).json({
            message: 'Database connection failed',
            error: err.message
        });
    }
});

// Start the server (server variable already created at top with Socket.IO)
server.listen(PORT, () => {
    console.log(`🚀 Server is running on http://localhost:${PORT}`);
    console.log(`📊 Status endpoint available at http://localhost:${PORT}/api/status`);
    console.log(`🔌 Socket.IO enabled for real-time updates`);
});
