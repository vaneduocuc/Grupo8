import React, { useState, useEffect } from 'react';
import axios from 'axios';

function App() {
  const [token, setToken] = useState(null);
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  
  const [productos, setProductos] = useState([]);
  const [mensaje, setMensaje] = useState({ texto: '', tipo: '' });
  const [movimiento, setMovimiento] = useState({ id_producto: '', tipo_movimiento: 'ENTRADA', cantidad: 1 });

  // === LOGICA SPRINT 1 (LOGIN) ===
  const manejarLogin = async (e) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:3000/api/login', loginForm);
      if (res.data.success) {
        setToken(res.data.token);
        cargarPredicciones();
      }
    } catch (error) {
      alert("Credenciales incorrectas");
    }
  };

  // === LOGICA SPRINT 2 (INVENTARIO) ===
  const cargarPredicciones = async () => {
    try {
      const res = await axios.get('http://localhost:3000/api/prediccion');
      if (res.data.success) setProductos(res.data.data);
    } catch (error) {
      console.error(error);
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
      });
      if (res.data.success) {
        setMensaje({ texto: 'Movimiento registrado con exito', tipo: 'exito' });
        cargarPredicciones();
      }
    } catch (error) {
      if (error.response && error.response.status === 400) {
        setMensaje({ texto: error.response.data.message, tipo: 'error' });
      } else {
        setMensaje({ texto: 'Error interno del servidor', tipo: 'error' });
      }
    }
  };

  const cerrarSesion = () => {
    setToken(null);
    setProductos([]);
  };

  // === VISTA SPRINT 1 (LOGIN) ===
  if (!token) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10%' }}>
        <div style={{ background: '#f4f4f4', padding: '30px', borderRadius: '8px', width: '300px' }}>
          <h2 style={{ textAlign: 'center' }}>StockMaster Login</h2>
          <form onSubmit={manejarLogin}>
            <input type="text" placeholder="Usuario" style={{ width: '100%', marginBottom: '10px', padding: '10px', boxSizing: 'border-box' }} value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} required />
            <input type="password" placeholder="Contrasena" style={{ width: '100%', marginBottom: '10px', padding: '10px', boxSizing: 'border-box' }} value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} required />
            <button type="submit" style={{ width: '100%', padding: '10px', background: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}>Ingresar</button>
          </form>
        </div>
      </div>
    );
  }

  // === VISTA SPRINT 2 (PANEL) ===
  return (
    <div style={{ padding: '20px', fontFamily: 'Arial' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Panel Administrativo - StockMaster</h2>
        <button onClick={cerrarSesion} style={{ padding: '8px 15px', background: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>Cerrar Sesion</button>
      </div>

      {mensaje.texto && (
        <div style={{ padding: '10px', marginBottom: '20px', backgroundColor: mensaje.tipo === 'error' ? '#f8d7da' : '#d4edda', color: mensaje.tipo === 'error' ? '#721c24' : '#155724', border: '1px solid', borderRadius: '4px' }}>
          {mensaje.texto}
        </div>
      )}

      <div style={{ display: 'flex', gap: '30px' }}>
        <div style={{ flex: '1', border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
          <h3>Registrar Movimiento</h3>
          <form onSubmit={registrarMovimiento} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
            <select value={movimiento.id_producto} onChange={e => setMovimiento({...movimiento, id_producto: e.target.value})} required>
              <option value="">Seleccione un producto</option>
              {productos.map(p => <option key={p.id_producto} value={p.id_producto}>{p.nombre} (Stock: {p.stock_actual})</option>)}
            </select>
            <select value={movimiento.tipo_movimiento} onChange={e => setMovimiento({...movimiento, tipo_movimiento: e.target.value})} required>
              <option value="ENTRADA">Entrada</option>
              <option value="SALIDA">Salida</option>
            </select>
            <input type="number" min="1" value={movimiento.cantidad} onChange={e => setMovimiento({...movimiento, cantidad: e.target.value})} required />
            <button type="submit" style={{ padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', cursor: 'pointer' }}>Registrar</button>
          </form>
        </div>

        <div style={{ flex: '2', border: '1px solid #ccc', padding: '20px', borderRadius: '8px' }}>
          <h3>Modulo Predictivo de Reposicion</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead>
              <tr style={{ backgroundColor: '#f4f4f4', borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px' }}>Producto</th>
                <th style={{ padding: '10px' }}>Stock</th>
                <th style={{ padding: '10px' }}>Salidas (30 dias)</th>
                <th style={{ padding: '10px' }}>Dias Autonomia</th>
              </tr>
            </thead>
            <tbody>
              {productos.map(prod => (
                <tr key={prod.id_producto} style={{ borderBottom: '1px solid #ddd' }}>
                  <td style={{ padding: '10px' }}>{prod.nombre}</td>
                  <td style={{ padding: '10px' }}>{prod.stock_actual}</td>
                  <td style={{ padding: '10px' }}>{prod.salidas_ultimo_mes}</td>
                  <td style={{ padding: '10px' }}>{prod.dias_autonomia === 999 ? 'Sin movimientos' : prod.dias_autonomia}</td>
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
