# StockMaster - Sistema de Gestión de Inventario y Abastecimiento

Proyecto APT para la carrera Analista Programador Computacional (Duoc UC).

## Requisitos Previos
- Node.js 18+
- PostgreSQL 14+

## Instalación y Puesta en Marcha

1. **Base de Datos:**
   - Crear una base de datos llamada \StockMaster\ en PostgreSQL.
   - Ejecutar el script \db/schema.sql\ para crear las tablas, el trigger de control de stock, la vista predictiva y los datos semilla.

2. **Backend:**
   - Copiar \.env.example\ a \.env\ y configurar las credenciales de PostgreSQL.
   - Instalar dependencias y ejecutar:
     \\\ash
     npm install
     npm start
     \\\

3. **Frontend:**
   - Entrar al directorio del cliente:
     \\\ash
     cd client
     npm install
     npm run dev
     \\\
   - Acceder en el navegador a \http://localhost:5173\ con el usuario \dmin\ y contraseña \dmin123\.
