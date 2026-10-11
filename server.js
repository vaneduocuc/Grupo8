require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
const PORT = process.env.PORT || 3000;

// S6: Restringir CORS al origen del frontend
app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173' }));
app.use(express.json());

// S1: Conexión mediante variables de entorno
const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE,
});

// Middleware JWT con algoritmo estricto
const verificarToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Acceso no autorizado' });

  jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'] }, (err, user) => {
    if (err) return res.status(403).json({ error: 'Token inválido o expirado' });
    req.user = user;
    next();
  });
};

// S2 y S5: Login seguro sin texto plano y con mensaje unificado
app.post('/api/login', async (req, res) => {
  const { username, password } = req.body;
  try {
    const result = await pool.query(
      'SELECT id_usuario, username, password, rol FROM usuarios WHERE username = $1',
      [username]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const user = result.rows[0];
    const passwordMatch = await bcrypt.compare(password, user.password);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      { id: user.id_usuario, username: user.username, rol: user.rol },
      process.env.JWT_SECRET,
      { expiresIn: '2h', algorithm: 'HS256' }
    );

    res.json({ token, user: { username: user.username, rol: user.rol } });
  } catch (error) {
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

// F4: Validación de tipos y parámetros en movimientos
app.post('/api/movimientos', verificarToken, async (req, res) => {
  const { id_producto, tipo_movimiento, cantidad } = req.body;
  const parsedId = parseInt(id_producto, 10);
  const parsedCant = parseInt(cantidad, 10);

  if (isNaN(parsedId) || isNaN(parsedCant) || parsedCant <= 0 || !['ENTRADA', 'SALIDA'].includes(tipo_movimiento)) {
    return res.status(400).json({ error: 'Parámetros de movimiento inválidos' });
  }

  try {
    await pool.query(
      'INSERT INTO movimientos (id_producto, tipo_movimiento, cantidad) VALUES ($1, $2, $3)',
      [parsedId, tipo_movimiento, parsedCant]
    );

    // F2: Registro formal de alerta en servidor (Simulación arquitectónica documentada)
    if (tipo_movimiento === 'SALIDA') {
      const prodCheck = await pool.query('SELECT stock_actual, stock_minimo, nombre FROM productos WHERE id_producto = $1', [parsedId]);
      if (prodCheck.rows.length > 0) {
        const p = prodCheck.rows[0];
        if (p.stock_actual <= p.stock_minimo) {
          console.info(`[ALERTA STOCK] Producto "${p.nombre}" bajo stock mínimo (${p.stock_actual}/${p.stock_minimo}).`);
        }
      }
    }

    res.status(201).json({ mensaje: 'Movimiento registrado con éxito' });
  } catch (error) {
    if (error.code === 'P0001') {
      return res.status(400).json({ error: error.message });
    }
    res.status(500).json({ error: 'Error al procesar el movimiento' });
  }
});

app.get('/api/prediccion', verificarToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM vista_prediccion_reposicion ORDER BY dias_autonomia ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Error al consultar la vista predictiva' });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor StockMaster operativo en el puerto ${PORT}`);
});