// Doctor login controller function
const loginDoctor = async (req, res) => {
    console.log('=== LOGIN CONTROLLER CALLED ===');
    console.log('Request body:', req.body);
    try {
        const { contact, password } = req.body;
        if (!contact || !password) {
            return res.render('doctors/login', { error: 'Contact and password are required.' });
        }
        const db = require('../db');
        const bcrypt = require('bcryptjs');
        const query = 'SELECT * FROM doctors WHERE contact = $1';
        const result = await db.query(query, [contact]);
        if (result.rows.length === 0) {
            return res.render('doctors/login', { error: 'Invalid email or password' });
        }
        const doctor = result.rows[0];
        const validPassword = await bcrypt.compare(password, doctor.password);
        if (!validPassword) {
            return res.render('doctors/login', { error: 'Invalid email or password' });
        }
        // Set session for doctor
        req.session.doctor = {
            id: doctor.id,
            name: doctor.name,
            email: doctor.email,
            specialization: doctor.specialization
        };
        console.log('Session set, redirecting to dashboard');
        res.redirect('/doctors/dashboard');
    } catch (error) {
        console.error('Doctor login error:', error);
        res.render('doctors/login', { error: 'Internal server error during doctor login' });
    }
};

const db = require('../db');

const registerDoctor = async (req, res) => {
    try {
        const { name, specialization, contact, schedule } = req.body;

        // Basic validation
        if (!name || !contact) {
            return res.render('doctors/register', { error: 'Name and contact are required.' });
        }

        // Contact format validation (email or phone)
        const contactRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (contact && contact.includes('@') && !contactRegex.test(contact)) {
            return res.render('doctors/register', { error: 'Please provide a valid email address in contact.' });
        }

        // Check if contact already exists in database
        const existingDoctor = await db.query('SELECT id FROM doctors WHERE contact = $1', [contact]);
        if (existingDoctor.rows.length > 0) {
            return res.render('doctors/register', { error: 'Contact already registered.' });
        }

        // Hash password (for demo, use contact as password if not provided)
        const bcrypt = require('bcryptjs');
        const password = req.body.password || contact;
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert doctor into database (add password field)
        const insertQuery = `
            INSERT INTO doctors (name, specialization, contact, schedule, password)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, name, specialization, contact, schedule
        `;
        const values = [name, specialization, contact, schedule, hashedPassword];
        const result = await db.query(insertQuery, values);

        console.log('Doctor registration attempt:', { name, specialization, contact, schedule });

        // Redirect to login after successful registration
        return res.redirect('/doctors/login');
    } catch (error) {
        console.error('Doctor registration error:', error);
        return res.render('doctors/register', { error: 'Internal server error during doctor registration.' });
    }
};

module.exports = {
	registerDoctor,
	loginDoctor
};
