-- db/schema.sql
DROP TABLE IF EXISTS movimientos CASCADE;
DROP TABLE IF EXISTS productos CASCADE;
DROP TABLE IF EXISTS proveedores CASCADE;
DROP TABLE IF EXISTS usuarios CASCADE;

-- 1. Tabla Usuarios (HU-02)
CREATE TABLE usuarios (
    id_usuario SERIAL PRIMARY KEY,
    username VARCHAR(50) UNIQUE NOT NULL,
    password VARCHAR(255) NOT NULL,
    rol VARCHAR(20) DEFAULT 'operador'
);

-- 2. Tabla Proveedores
CREATE TABLE proveedores (
    id_proveedor SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email_contacto VARCHAR(100) NOT NULL,
    telefono VARCHAR(20)
);

-- 3. Tabla Productos
CREATE TABLE productos (
    id_producto SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    stock_actual INT NOT NULL CHECK (stock_actual >= 0),
    stock_minimo INT NOT NULL CHECK (stock_minimo >= 0),
    id_proveedor INT REFERENCES proveedores(id_proveedor)
);

-- 4. Tabla Movimientos (HU-03)
CREATE TABLE movimientos (
    id_movimiento SERIAL PRIMARY KEY,
    id_producto INT REFERENCES productos(id_producto),
    tipo_movimiento VARCHAR(10) CHECK (tipo_movimiento IN ('ENTRADA', 'SALIDA')),
    cantidad INT NOT NULL CHECK (cantidad > 0),
    fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 5. Trigger y Función Transaccional (HU-03)
CREATE OR REPLACE FUNCTION actualizar_stock()
RETURNS TRIGGER AS $$
DECLARE
    v_stock_actual INT;
BEGIN
    SELECT stock_actual INTO v_stock_actual 
    FROM productos 
    WHERE id_producto = NEW.id_producto 
    FOR UPDATE;

    IF NEW.tipo_movimiento = 'SALIDA' THEN
        IF v_stock_actual < NEW.cantidad THEN
            RAISE EXCEPTION 'Stock insuficiente para realizar la salida. Operacion cancelada.'
                USING ERRCODE = 'P0001';
        END IF;
        UPDATE productos 
        SET stock_actual = stock_actual - NEW.cantidad 
        WHERE id_producto = NEW.id_producto;
    ELSIF NEW.tipo_movimiento = 'ENTRADA' THEN
        UPDATE productos 
        SET stock_actual = stock_actual + NEW.cantidad 
        WHERE id_producto = NEW.id_producto;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_movimiento_stock
AFTER INSERT ON movimientos
FOR EACH ROW
EXECUTE FUNCTION actualizar_stock();

-- 6. Vista Analítica Predictiva (HU-04)
CREATE OR REPLACE VIEW vista_prediccion_reposicion AS
SELECT 
    p.id_producto,
    p.nombre,
    p.stock_actual,
    p.stock_minimo,
    pr.nombre AS proveedor,
    pr.email_contacto AS email_proveedor,
    COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'SALIDA' AND m.fecha >= NOW() - INTERVAL '30 days' THEN m.cantidad ELSE 0 END), 0) AS salidas_mes,
    CASE 
        WHEN COALESCE(SUM(CASE WHEN m.tipo_movimiento = 'SALIDA' AND m.fecha >= NOW() - INTERVAL '30 days' THEN m.cantidad ELSE 0 END), 0) = 0 THEN 999
        ELSE ROUND(p.stock_actual / (SUM(CASE WHEN m.tipo_movimiento = 'SALIDA' AND m.fecha >= NOW() - INTERVAL '30 days' THEN m.cantidad ELSE 0 END) / 30.0))
    END AS dias_autonomia
FROM productos p
LEFT JOIN proveedores pr ON p.id_proveedor = pr.id_proveedor
LEFT JOIN movimientos m ON p.id_producto = m.id_producto
GROUP BY p.id_producto, p.nombre, p.stock_actual, p.stock_minimo, pr.nombre, pr.email_contacto;

-- 7. Datos Semilla (Hash bcrypt para 'admin123')
INSERT INTO usuarios (username, password, rol) VALUES 
('admin', '$2b$10$wE96Yy6BsqB1pT0HnI2qYeZ5Kk.0yHhD6F9x3G1J7aV5L2n4M6k8q', 'admin');

INSERT INTO proveedores (nombre, email_contacto, telefono) VALUES
('Distribuidora Central', 'contacto@distribuidoracentral.cl', '+56911223344'),
('Molino del Sur', 'ventas@molinodelsur.cl', '+56955667788');

INSERT INTO productos (nombre, stock_actual, stock_minimo, id_proveedor) VALUES
('Arroz Grano Largo 1kg', 10, 15, 1),
('Aceite Vegetal 900ml', 45, 20, 1),
('Azúcar Blanca 1kg', 8, 10, 2);