const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// Configuracion Base de Datos y JWT
const SECRET_KEY = 'stockmaster_jwt_secret_key';
const pool = new Pool({
    user: 'postgres', 
    host: 'localhost',
    database: 'StockMaster',
    password: 'duoc',
    port: 5432,
});

// Usuarios del Sprint 1
const users = [];
const salt = bcrypt.genSaltSync(10);
users.push({
    id: 1,
    username: 'admin',
    password: bcrypt.hashSync('admin123', salt),
    role: 'Administrador'
});

// Endpoint Login (Sprint 1)
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const user = users.find(u => u.username === username);
    
    if (user && bcrypt.compareSync(password, user.password)) {
        const token = jwt.sign({ id: user.id, role: user.role }, SECRET_KEY, { expiresIn: '2h' });
        res.json({ success: true, token: token, role: user.role });
    } else {
        res.status(401).json({ success: false, message: 'Credenciales incorrectas' });
    }
});

// Endpoint Registrar Movimiento (Sprint 2)
app.post('/api/movimientos', async (req, res) => {
    const { id_producto, tipo_movimiento, cantidad } = req.body;
    try {
        const result = await pool.query(
            'INSERT INTO movimientos (id_producto, tipo_movimiento, cantidad) VALUES ($1, $2, $3) RETURNING *',
            [id_producto, tipo_movimiento, cantidad]
        );
        res.json({ success: true, movimiento: result.rows[0] });
    } catch (error) {
        if (error.code === 'P0001') { 
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// Endpoint Prediccion y Alertas (Sprint 2)
app.get('/api/prediccion', async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM vista_prediccion_reposicion');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(3000, () => console.log('Servidor StockMaster Unificado corriendo en puerto 3000'));