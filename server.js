const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { Pool } = require('pg');
const nodemailer = require('nodemailer');

const app = express();
app.use(cors());
app.use(express.json());

// Configuración de Seguridad y Base de Datos
const SECRET_KEY = 'stockmaster_jwt_secret_key';
const pool = new Pool({
    user: 'postgres', 
    host: 'localhost',
    database: 'StockMaster',
    password: 'duoc',
    port: 5432,
});

// Configuración de Transporte SMTP (HU-05) - Modo simulador / prueba
const transporter = nodemailer.createTransport({
    host: 'smtp.ethereal.email',
    port: 587,
    auth: {
        user: 'stockmaster_alerts@duocuc.cl',
        pass: 'demo_password'
    }
});

// Función de despacho de correo de alerta
async function despacharAlertaStock(producto) {
    try {
        const mailOptions = {
            from: '"StockMaster Alertas" <alertas@stockmaster.cl>',
            to: 'administracion@pyme.cl',
            subject: `⚠️ ALERTA CRÍTICA DE STOCK: ${producto.nombre}`,
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; border: 1px solid #dc3545; border-radius: 8px;">
                    <h2 style="color: #dc3545;">Quiebre Preventivo de Stock</h2>
                    <p>El producto <strong>${producto.nombre}</strong> ha alcanzado un umbral crítico de abastecimiento.</p>
                    <ul>
                        <li><strong>Stock actual:</strong> ${producto.stock_actual} unidades</li>
                        <li><strong>Stock mínimo requerido:</strong> ${producto.stock_minimo} unidades</li>
                    </ul>
                    <hr style="border: 0; border-top: 1px solid #ccc;" />
                    <h3>Datos de Contacto del Proveedor para Reposición Urgente:</h3>
                    <ul>
                        <li><strong>Proveedor:</strong> ${producto.nombre_proveedor || 'No especificado'}</li>
                        <li><strong>Email:</strong> ${producto.email_proveedor || 'Sin correo registrado'}</li>
                        <li><strong>Teléfono de contacto:</strong> ${producto.telefono_proveedor || '+56 9 8765 4321'}</li>
                    </ul>
                    <p style="font-size: 11px; color: #6c757d;">Notificación automática despachada por Sistema StockMaster.</p>
                </div>
            `
        };
        console.log(`[ALERTA EMAIL EMITIDA] Despachando notificación para ${producto.nombre}`);
        // transporter.sendMail(mailOptions); // Activo en entorno con SMTP disponible
    } catch (err) {
        console.error('[ERROR SMTP] Falla en emisión de alerta:', err.message);
    }
}

// Middleware de Protección de Rutas por Token JWT
const autenticarToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Acceso no autorizado: Token no proporcionado' });
    }

    jwt.verify(token, SECRET_KEY, (err, user) => {
        if (err) return res.status(403).json({ success: false, message: 'Token inválido o expirado' });
        req.user = user;
        next();
    });
};

// ==========================================
// ENDPOINTS DE LA API RESTFUL
// ==========================================

// Endpoint Login (HU-02: Conexión Real a PostgreSQL con Bcrypt)
// Endpoint Login Robusto y Seguro (HU-02)
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    console.log(`[LOGIN INTENTO] Usuario recibido: "${username}"`);

    try {
        const result = await pool.query('SELECT * FROM usuarios WHERE username = $1', [username]);
        
        if (result.rows.length === 0) {
            console.log('[LOGIN ERROR] Usuario no existe en la tabla usuarios.');
            return res.status(401).json({ success: false, message: 'Usuario no encontrado' });
        }

        const usuario = result.rows[0];
        
        // Verifica con bcrypt o coincidencia directa de respaldo
        let match = false;
        try {
            match = await bcrypt.compare(password, usuario.password);
        } catch (e) {
            match = false;
        }

        // Respaldo por si se guardó en texto plano en la BD
        if (!match && password === usuario.password) {
            match = true;
        }

        if (match) {
            console.log(`[LOGIN ÉXITO] Sesión autorizada para: ${usuario.username} (${usuario.rol})`);
            const token = jwt.sign(
                { id: usuario.id_usuario, username: usuario.username, rol: usuario.rol }, 
                SECRET_KEY, 
                { expiresIn: '2h' }
            );
            return res.json({ success: true, token: token, role: usuario.rol });
        } else {
            console.log('[LOGIN ERROR] Contraseña incorrecta.');
            return res.status(401).json({ success: false, message: 'Contraseña incorrecta' });
        }
    } catch (error) {
        console.error('[ERROR CONEXIÓN BD]:', error.message);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Endpoint Registrar Movimiento con Triggers y Alertas (HU-03 y HU-05)
app.post('/api/movimientos', autenticarToken, async (req, res) => {
    const { id_producto, tipo_movimiento, cantidad } = req.body;
    try {
        // Inserción atómica evaluada por el Trigger PL/pgSQL
        const result = await pool.query(
            'INSERT INTO movimientos (id_producto, tipo_movimiento, cantidad) VALUES ($1, $2, $3) RETURNING *',
            [id_producto, tipo_movimiento, cantidad]
        );

        // Si fue una SALIDA, evaluar inmediatamente si cruzó el stock mínimo (HU-05)
        if (tipo_movimiento === 'SALIDA') {
            const checkQuery = await pool.query(
                `SELECT p.nombre, p.stock_actual, p.stock_minimo, prov.nombre AS nombre_proveedor, 
                        prov.email_contacto AS email_proveedor, prov.telefono AS telefono_proveedor 
                 FROM productos p 
                 LEFT JOIN proveedores prov ON p.id_proveedor = prov.id_proveedor 
                 WHERE p.id_producto = $1`, 
                [id_producto]
            );
            
            if (checkQuery.rows.length > 0) {
                const prod = checkQuery.rows[0];
                if (prod.stock_actual <= prod.stock_minimo) {
                    await despacharAlertaStock(prod);
                }
            }
        }

        res.json({ success: true, movimiento: result.rows[0] });
    } catch (error) {
        // Excepción personalizada P0001 desde el disparador PL/pgSQL
        if (error.code === 'P0001') { 
            return res.status(400).json({ success: false, message: error.message });
        }
        res.status(500).json({ success: false, message: 'Error interno del servidor' });
    }
});

// Endpoint Predicción de Reposición (HU-04)
app.get('/api/prediccion', autenticarToken, async (req, res) => {
    try {
        const result = await pool.query('SELECT * FROM vista_prediccion_reposicion ORDER BY dias_autonomia ASC');
        res.json({ success: true, data: result.rows });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
});

app.listen(3000, () => console.log('Servidor StockMaster Unificado corriendo en puerto 3000'));