require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_DATABASE
});

async function inicializar() {
  try {
    await pool.query(
      CREATE TABLE IF NOT EXISTS usuarios (
        id_usuario SERIAL PRIMARY KEY,
        username VARCHAR(50) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        rol VARCHAR(20) DEFAULT 'operador'
      );
    );
    
    await pool.query("DELETE FROM usuarios WHERE username = 'admin';");
    
    const hash = '.0yHhD6F9x3G1J7aV5L2n4M6k8q';
    await pool.query("INSERT INTO usuarios (username, password, rol) VALUES ('admin', , 'admin');", [hash]);
    
    const res = await pool.query("SELECT username, rol FROM usuarios;");
    console.log('✅ USUARIO ADMIN LISTO EN BD:', res.rows);
  } catch (err) {
    console.error('❌ ERROR:', err.message);
  } finally {
    await pool.end();
  }
}

inicializar();
