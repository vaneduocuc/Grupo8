const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();
app.use(cors());
app.use(express.json());

const SECRET_KEY = 'stockmaster_jwt_secret_key';
const users = [];

const salt = bcrypt.genSaltSync(10);
users.push({
    id: 1,
    username: 'admin',
    password: bcrypt.hashSync('admin123', salt),
    role: 'Administrador'
});

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

app.listen(3000, () => console.log('Servidor Base corriendo en puerto 3000'));