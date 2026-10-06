import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [token, setToken] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: 'admin', password: 'admin123' });
  
  const [productos, setProductos] = useState([]);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
  const [movimiento, setMovimiento] = useState({ id_producto: '', tipo_movimiento: 'ENTRADA', cantidad: 1 });

  // === LOGICA SPRINT 1 (LOGIN HU-02) ===
  const manejarLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:3000/api/login', loginForm);
      if (res.data.success) {
        setToken(res.data.token);
        cargarPredicciones(res.data.token);
      }
    } catch (error) {
      alert("Credenciales incorrectas o usuario no encontrado en base de datos.");
    }
  };

  // === LOGICA SPRINT 2 Y 3 (INVENTARIO Y PREDICCIÓN CON BEARER JWT) ===
  const cargarPredicciones = async (jwtToken = token) => {
    try {
      const res = await axios.get('http://localhost:3000/api/prediccion', {
        headers: { Authorization: `Bearer ${jwtToken}` }
      });
      if (res.data.success) setProductos(res.data.data);
    } catch (error) {
      console.error("Error al cargar predicciones:", error);
    }
  };

  const registrarMovimiento = async (e) => {
    e.preventDefault();
    setMensaje({ texto: '', tipo: '' });
    try {
      const res = await axios.post('http://localhost:3000/api/movimientos', {
        id_producto: parseInt(movimiento.id_producto),
        tipo_movimiento: movimiento.tipo_movimiento,
        cantidad: parseInt(movimiento.cantidad)
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (res.data.success) {
        setMensaje({ texto: 'Movimiento registrado con éxito en base de datos.', tipo: 'exito' });
        cargarPredicciones(token);
      }
    } catch (error) {
      // Captura del código HTTP 400 emitido ante la excepción P0001 del Trigger SQL
      if (error.response && error.response.status === 400) {
        setMensaje({ texto: error.response.data.message, tipo: 'error' });
      } else {
        setMensaje({ texto: 'Error de servidor o sesión expirada.', tipo: 'error' });
      }
    }
  };

  const cerrarSesion = () => {
    setToken(null);
    setProductos([]);
    setMensaje({ texto: '', tipo: '' });
  };

  // === VISTA DE LOGIN ===
  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10%' }}>
        <div style={{ background: '#f8f9fa', padding: '30px', borderRadius: '8px', width: '320px', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>
          <h2 style={{ textAlign: 'center', color: '#1E3A8A' }}>StockMaster Login</h2>
          <p style={{ fontSize: '12px', color: '#6c757d', textAlign: 'center' }}>Validado con PostgreSQL y Bcrypt</p>
          <form onSubmit={manejarLogin}>
            <input 
              type="text" 
              placeholder="Usuario" 
              style={{ width: '100%', marginBottom: '10px', padding: '10px', boxSizing: 'border-box', border: '1px solid #ced4da', borderRadius: '4px' }} 
              value={loginForm.username} 
              onChange={e => setLoginForm({...loginForm, username: e.target.value})} 
              required 
            />
            <input 
              type="password" 
              placeholder="Contraseña" 
              style={{ width: '100%', marginBottom: '15px', padding: '10px', boxSizing: 'border-box', border: '1px solid #ced4da', borderRadius: '4px' }} 
              value={loginForm.password} 
              onChange={e => setLoginForm({...loginForm, password: e.target.value})} 
              required 
            />
            <button type="submit" style={{ width: '100%', padding: '10px', background: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Ingresar al Sistema
            </button>
          </form>
        </div>
      </div>
    );
  }

  // === VISTA DE PANEL ADMINISTRATIVO (HU-07) ===
  return (
    <div style={{ padding: '25px', fontFamily: 'Arial, sans-serif', maxWidth: '1200px', margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #e9ecef', paddingBottom: '15px' }}>
        <div>
          <h2 style={{ margin: 0, color: '#0F172A' }}>StockMaster — Control de Existencias</h2>
          <span style={{ fontSize: '13px', color: '#64748B' }}>Gestión transaccional y analítica de reposición</span>
        </div>
        <button onClick={cerrarSesion} style={{ padding: '8px 15px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
          Cerrar Sesión
        </button>
      </div>

      {mensaje.texto && (
        <div style={{ padding: '12px', marginTop: '15px', marginBottom: '15px', backgroundColor: mensaje.tipo === 'error' ? '#f8d7da' : '#d4edda', color: mensaje.tipo === 'error' ? '#721c24' : '#155724', border: `1px solid ${mensaje.tipo === 'error' ? '#f5c6cb' : '#c3e6cb'}`, borderRadius: '4px' }}>
          <strong>{mensaje.tipo === 'error' ? '⛔ Error: ' : '✅ Éxito: '}</strong> {mensaje.texto}
        </div>
      )}

      <div style={{ display: 'flex', gap: '25px', marginTop: '20px' }}>
        {/* FORMULARIO DE REGISTRO DE MOVIMIENTOS */}
        <div style={{ flex: '1', border: '1px solid #dee2e6', padding: '20px', borderRadius: '8px', background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#1E293B' }}>Registrar Movimiento</h3>
          <form onSubmit={registrarMovimiento} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Producto:</label>
            <select value={movimiento.id_producto} onChange={e => setMovimiento({...movimiento, id_producto: e.target.value})} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}>
              <option value="">Seleccione un producto</option>
              {productos.map(p => <option key={p.id_producto} value={p.id_producto}>{p.nombre} (Stock actual: {p.stock_actual})</option>)}
            </select>

            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Tipo de Movimiento:</label>
            <select value={movimiento.tipo_movimiento} onChange={e => setMovimiento({...movimiento, tipo_movimiento: e.target.value})} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }}>
              <option value="ENTRADA">Entrada (+)</option>
              <option value="SALIDA">Salida (-)</option>
            </select>

            <label style={{ fontSize: '13px', fontWeight: 'bold' }}>Cantidad:</label>
            <input type="number" min="1" value={movimiento.cantidad} onChange={e => setMovimiento({...movimiento, cantidad: e.target.value})} required style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ced4da' }} />

            <button type="submit" style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
              Confirmar Transacción
            </button>
          </form>
        </div>

        {/* TABLA ANALÍTICA DE REPOSICIÓN PREDICTIVA */}
        <div style={{ flex: '2', border: '1px solid #dee2e6', padding: '20px', borderRadius: '8px', background: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }}>
          <h3 style={{ marginTop: 0, color: '#1E293B' }}>Módulo Predictivo de Reposición (HU-04)</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', marginTop: '10px' }}>
            <thead>
              <tr style={{ backgroundColor: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                <th style={{ padding: '10px' }}>Producto</th>
                <th style={{ padding: '10px' }}>Stock</th>
                <th style={{ padding: '10px' }}>Umbral Mín.</th>
                <th style={{ padding: '10px' }}>Salidas (30d)</th>
                <th style={{ padding: '10px' }}>Autonomía</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(prod => (
                <tr key={prod.id_producto} style={{ borderBottom: '1px solid #e2e8f0', backgroundColor: prod.stock_actual <= prod.stock_minimo ? '#fff1f2' : 'transparent' }}>
                  <td style={{ padding: '10px' }}>
                    <strong>{prod.nombre}</strong><br/>
                    <small style={{ color: '#64748b' }}>Prov: {prod.nombre_proveedor || 'N/A'}</small>
                  </td>
                  <td style={{ padding: '10px', fontWeight: 'bold', color: prod.stock_actual <= prod.stock_minimo ? '#e11d48' : '#0f172a' }}>
                    {prod.stock_actual}
                  </td>
                  <td style={{ padding: '10px' }}>{prod.stock_minimo}</td>
                  <td style={{ padding: '10px' }}>{prod.salidas_ultimo_mes}</td>
                  <td style={{ padding: '10px' }}>
                    {prod.dias_autonomia === 999 ? (
                      <span style={{ color: '#64748b' }}>Sin rotación</span>
                    ) : (
                      <span style={{ fontWeight: 'bold', color: prod.dias_autonomia <= 7 ? '#d97706' : '#16a34a' }}>
                        {prod.dias_autonomia} días
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

export default App;