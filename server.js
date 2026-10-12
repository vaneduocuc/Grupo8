require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');
const { Pool } = require('pg');

const app = express();
const PORT = process.env.PORT || 3000;

// S6: Seguridad en cabeceras y restricción de CORS
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  methods: ['GET', 'POST'],
  credentials: true
}));
app.use(express.json());

// Conexión a PostgreSQL
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE
});

// F2: Transporte de correo configurable
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.ethereal.email',
  port: parseInt(process.env.SMTP_PORT || '587', 10),
  secure: false,
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS
  }
});

// Middleware de autenticación JWT (S6: algoritmo explícito)
const autenticarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Acceso no autorizado: Token no suministrado' });
  }

  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (err, usuario) => {
    if (err) {
      return res.status(403).json({ error: 'Token inválido o expirado' });
    }
    req.usuario = usuario;
    next();
  });
};

// S4: Middleware de autorización por rol
const verificarRol = (rolesPermitidos) => {
  return (req, res, next) => {
    if (!req.usuario || !rolesPermitidos.includes(req.usuario.rol)) {
      return res.status(403).json({ error: 'No posee los privilegios necesarios para esta acción' });
    }
    next();
  };
};

// === HU-02: INICIO DE SESIÓN ===
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Usuario y contraseña son requeridos' });
  }

  try {
    const result = await pool.query(
      'SELECT id_usuario, username, password, rol FROM usuarios WHERE username = $1',
      [username]
    );

    // S5: Mensaje unificado para evitar enumeración de usuarios
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const usuario = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, usuario.password);

    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: usuario.id_usuario, username: usuario.username, rol: usuario.rol },
      process.env.JWT_SECRET,
      { expiresIn: '2h', algorithm: 'HS256' }
    );

    res.json({ token, user: { username: usuario.username, rol: usuario.rol } });
  } catch (error) {
    console.error('Error interno en login:', error.message);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// === HU-04: VISTA PREDICTIVA DE REPOSICIÓN ===
app.get('/api/prediccion', autenticarToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vista_prediccion_reposicion');
    res.json(result.rows);
  } catch (error) {
    console.error('Error al obtener predicciones:', error.message);
    res.status(500).json({ error: 'Error al consultar módulo predictivo' });
  }
});

// === HU-03 & HU-05: REGISTRO DE MOVIMIENTOS Y ALERTA DE STOCK ===
app.post('/api/movimientos', autenticarToken, async (req, res) => {
  const { id_producto, tipo_movimiento, cantidad } = req.body;

  // F4: Validación exhaustiva de entradas
  const cantidadNum = parseInt(cantidad, 10);
  const idProductoNum = parseInt(id_producto, 10);

  if (!idProductoNum || isNaN(idProductoNum)) {
    return res.status(400).json({ error: 'El ID de producto es obligatorio y numérico' });
  }

  if (!['ENTRADA', 'SALIDA'].includes(tipo_movimiento)) {
    return res.status(400).json({ error: 'El tipo de movimiento debe ser ENTRADA o SALIDA' });
  }

  if (isNaN(cantidadNum) || cantidadNum <= 0) {
    return res.status(400).json({ error: 'La cantidad debe ser un entero estrictamente mayor a 0' });
  }

  const client = await pool.connect();

  try {
    // F3: Transacción SQL atómica
    await client.query('BEGIN');

    // 1. Obtener estado previo del stock y datos del proveedor
    const prodPrevio = await client.query(
      `SELECT p.id_producto, p.nombre, p.stock_actual, p.stock_minimo, 
              pr.nombre AS nombre_proveedor, pr.email AS email_proveedor
       FROM productos p
       LEFT JOIN proveedores pr ON p.id_proveedor = pr.id_proveedor
       WHERE p.id_producto = $1 FOR UPDATE`,
      [idProductoNum]
    );

    if (prodPrevio.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'El producto especificado no existe' });
    }

    const producto = prodPrevio.rows[0];
    const stockAntes = producto.stock_actual;

    // 2. Registrar movimiento (el Trigger PL/pgSQL actualiza el stock y valida no-negativos)
    await client.query(
      'INSERT INTO movimientos (id_producto, tipo_movimiento, cantidad) VALUES ($1, $2, $3)',
      [idProductoNum, tipo_movimiento, cantidadNum]
    );

    // 3. Obtener el nuevo stock calculado por el Trigger
    const prodActualizado = await client.query(
      'SELECT stock_actual FROM productos WHERE id_producto = $1',
      [idProductoNum]
    );
    const stockDespues = prodActualizado.rows[0].stock_actual;

    await client.query('COMMIT');

    // F3 / F2: Detección de cruce de umbral (solo si antes estaba sobre el mínimo y ahora cayó por debajo o igual)
    const cruzoUmbral = stockAntes > producto.stock_minimo && stockDespues <= producto.stock_minimo;

    if (tipo_movimiento === 'SALIDA' && cruzoUmbral) {
      const emailDestino = producto.email_proveedor || process.env.EMAIL_ADMIN;
      
      const mailOptions = {
        from: `"StockMaster Alertas" <${process.env.SMTP_USER || 'no-reply@stockmaster.cl'}>`,
        to: emailDestino,
        subject: `⚠️ Alerta de Quiebre Crítico: ${producto.nombre}`,
        html: `
          <h2>Alerta de Reposición Inmediata</h2>
          <p>El producto <strong>${producto.nombre}</strong> ha cruzado su umbral de seguridad.</p>
          <ul>
            <li><strong>Stock previo:</strong> ${stockAntes} unidades</li>
            <li><strong>Stock actual:</strong> ${stockDespues} unidades</li>
            <li><strong>Umbral mínimo:</strong> ${producto.stock_minimo} unidades</li>
            <li><strong>Proveedor asignado:</strong> ${producto.nombre_proveedor || 'Sin asignar'}</li>
          </ul>
          <p>Favor gestionar una orden de abastecimiento a la brevedad.</p>
        `
      };

      // Envío asíncrono sin bloquear la respuesta HTTP
      transporter.sendMail(mailOptions).catch(err => {
        console.error('Error al emitir correo de alerta HU-05:', err.message);
      });
    }

    res.status(201).json({
      success: true,
      mensaje: 'Movimiento registrado correctamente',
      stock_actual: stockDespues
    });

  } catch (error) {
    await client.query('ROLLBACK');
    // Manejo de la excepción P0001 del Trigger de PostgreSQL
    if (error.code === 'P0001') {
      return res.status(400).json({ error: error.message });
    }
    console.error('Error transaccional en movimientos:', error.message);
    res.status(500).json({ error: 'Error interno al procesar el movimiento' });
  } finally {
    client.release();
  }
});

app.listen(PORT, () => {
  console.log(`Servidor StockMaster operativo en el puerto ${PORT}`);
});