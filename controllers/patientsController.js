// Patient login controller function
const loginPatient = async (req, res) => {
    try {
        const { contact, password } = req.body;
        if (!contact || !password) {
            return res.status(400).json({
                success: false,
                message: 'Contact and password are required.'
            });
        }
        const bcrypt = require('bcryptjs');
        const query = 'SELECT * FROM patients WHERE contact = $1';
        const result = await db.query(query, [contact]);
        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials or patient not found.'
            });
        }
        const patient = result.rows[0];
        const validPassword = await bcrypt.compare(password, patient.password);
        if (!validPassword) {
            return res.status(401).json({
                success: false,
                message: 'Invalid credentials or patient not found.'
            });
        }
        // Login successful
        res.json({
            success: true,
            message: 'Patient login successful.',
            patient: { id: patient.id, name: patient.name, contact: patient.contact }
        });
    } catch (error) {
        console.error('Patient login error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error during patient login',
            error: error.message
        });
    }
};
const db = require('../db');

// Patient registration controller function
const registerPatient = async (req, res) => {
    try {
        // Extract patient data from request body
        const { name, age, gender, contact, address, medical_history, password } = req.body;

        // Basic validation
        if (!name || !contact || !password) {
            return res.status(400).json({
                success: false,
                message: 'Name, contact, and password are required.'
            });
        }

        // Contact format validation (email or phone)
        const contactRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (contact && contact.includes('@') && !contactRegex.test(contact)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address in contact.'
            });
        }

        // Check if contact already exists in database
        const existingPatient = await db.query('SELECT id FROM patients WHERE contact = $1', [contact]);
        if (existingPatient.rows.length > 0) {
            return res.status(409).json({
                success: false,
                message: 'Contact already registered'
            });
        }

        // Hash password before storing
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert patient into database
        const insertQuery = `
            INSERT INTO patients (name, age, gender, contact, address, medical_history, password)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING id, name, age, gender, contact, address, medical_history
        `;
        const values = [name, age, gender, contact, address, medical_history, hashedPassword];
        const result = await db.query(insertQuery, values);

        console.log('Patient registration attempt:', { name, age, gender, contact, address, medical_history });

        // Respond with actual database result
        res.status(201).json({
            success: true,
            message: 'Patient registered successfully',
            data: result.rows[0]
        });
        
    } catch (error) {
        console.error('Patient registration error:', error);
        // Always log the full error for debugging
        if (error && error.stack) {
            console.error(error.stack);
        }
        res.status(500).json({
            success: false,
            message: 'Internal server error during patient registration',
            error: error.message
        });
    }
};

// Get patient by ID controller function
const getPatientById = async (req, res) => {
    try {
        const patientId = req.params.id;
        
        // Validate patient ID
        if (!patientId || isNaN(patientId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid patient ID is required'
            });
        }
        
        // TODO: Fetch patient from database
        // const query = 'SELECT * FROM patients WHERE id = $1';
        // const result = await db.query(query, [patientId]);
        // 
        // if (result.rows.length === 0) {
        //     return res.status(404).json({
        //         success: false,
        //         message: 'Patient not found'
        //     });
        // }
        
        console.log('Fetching patient profile for ID:', patientId);
        
        // Placeholder response
        res.json({
            success: true,
            message: 'Patient profile retrieved successfully',
            data: {
                // ...result.rows[0]
                id: patientId,
                firstName: 'John',
                lastName: 'Doe',
                email: 'john.doe@example.com',
                phone: '123-456-7890'
            }
        });
        
    } catch (error) {
        console.error('Get patient by ID error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error fetching patient profile',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Get all patients controller function
const getAllPatients = async (req, res) => {
    try {
        // Extract query parameters for pagination
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;
        
        // TODO: Fetch patients from database with pagination
        // const countQuery = 'SELECT COUNT(*) FROM patients';
        // const patientsQuery = 'SELECT id, first_name, last_name, email, phone, created_at FROM patients ORDER BY created_at DESC LIMIT $1 OFFSET $2';
        // 
        // const countResult = await db.query(countQuery);
        // const patientsResult = await db.query(patientsQuery, [limit, offset]);
        // 
        // const totalPatients = parseInt(countResult.rows[0].count);
        // const totalPages = Math.ceil(totalPatients / limit);
        
        console.log('Fetching all patients - Page:', page, 'Limit:', limit);
        
        // Placeholder response
        res.json({
            success: true,
            message: 'Patients retrieved successfully',
            data: {
                patients: [], // patientsResult.rows
                pagination: {
                    currentPage: page,
                    totalPages: 1, // totalPages
                    totalPatients: 0, // totalPatients
                    hasNextPage: false, // page < totalPages
                    hasPrevPage: false // page > 1
                }
            }
        });
        
    } catch (error) {
        console.error('Get all patients error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error fetching patients',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Update patient controller function
const updatePatient = async (req, res) => {
    try {
        const patientId = req.params.id;
        const updateData = req.body;
        
        // Validate patient ID
        if (!patientId || isNaN(patientId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid patient ID is required'
            });
        }
        
        // Remove sensitive fields that shouldn't be updated directly
        delete updateData.id;
        delete updateData.created_at;
        
        // Validate email if provided
        if (updateData.email) {
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!emailRegex.test(updateData.email)) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide a valid email address'
                });
            }
        }
        
        // TODO: Update patient in database
        // const updateFields = Object.keys(updateData).map((key, index) => `${key} = $${index + 2}`).join(', ');
        // const values = Object.values(updateData);
        // 
        // const query = `UPDATE patients SET ${updateFields}, updated_at = NOW() WHERE id = $1 RETURNING *`;
        // const result = await db.query(query, [patientId, ...values]);
        // 
        // if (result.rows.length === 0) {
        //     return res.status(404).json({
        //         success: false,
        //         message: 'Patient not found'
        //     });
        // }
        
        console.log('Updating patient:', patientId, updateData);
        
        // Placeholder response
        res.json({
            success: true,
            message: 'Patient updated successfully',
            data: {
                id: patientId,
                ...updateData
                // ...result.rows[0]
            }
        });
        
    } catch (error) {
        console.error('Update patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error updating patient',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

// Delete patient controller function
const deletePatient = async (req, res) => {
    try {
        const patientId = req.params.id;
        
        // Validate patient ID
        if (!patientId || isNaN(patientId)) {
            return res.status(400).json({
                success: false,
                message: 'Valid patient ID is required'
            });
        }
        
        // TODO: Soft delete or hard delete patient from database
        // const query = 'DELETE FROM patients WHERE id = $1 RETURNING id';
        // const result = await db.query(query, [patientId]);
        // 
        // if (result.rows.length === 0) {
        //     return res.status(404).json({
        //         success: false,
        //         message: 'Patient not found'
        //     });
        // }
        
        console.log('Deleting patient:', patientId);
        
        // Placeholder response
        res.json({
            success: true,
            message: 'Patient deleted successfully',
            data: {
                deletedId: patientId
            }
        });
        
    } catch (error) {
        console.error('Delete patient error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error deleting patient',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

module.exports = {
    registerPatient,
    getPatientById,
    getAllPatients,
    updatePatient,
    deletePatient,
    loginPatient
};