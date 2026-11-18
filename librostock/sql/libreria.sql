-- LibroStock: esquema de la base de datos "libreria" (MySQL)
-- Uso: mysql -u libreria_app -p libreria < sql/libreria.sql
SET NAMES utf8mb4;

CREATE TABLE `cliente`(
    `id_cliente` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `nombre` VARCHAR(100) NOT NULL,
    `ap_paterno` VARCHAR(50) NULL,
    `ap_materno` VARCHAR(50) NULL,
    `telefono` VARCHAR(15) NULL,
    `correo` VARCHAR(100) NULL,
    `rfc` VARCHAR(13) NULL
);
ALTER TABLE
    `cliente` ADD UNIQUE `cliente_correo_unique`(`correo`);
CREATE TABLE `editoriales`(
    `id_editorial` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `nombre_editorial` VARCHAR(150) NOT NULL,
    `telefono` VARCHAR(20) NULL
);
CREATE TABLE `generos`(
    `id_genero` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `nombre_genero` VARCHAR(100) NOT NULL
);
CREATE TABLE `autores`(
    `id_autor` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `nombre_autor` VARCHAR(255) NOT NULL,
    `nacionalidad` VARCHAR(100) NULL
);
CREATE TABLE `libros`(
    `id_libro` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `isbn` VARCHAR(30) NULL,
    `titulo` VARCHAR(255) NOT NULL,
    `id_editorial` BIGINT NULL,
    `id_genero` BIGINT NULL,
    `anio_publicacion` INT NULL,
    `stock_max` INT NULL,
    `stock_min` INT NULL,
    `stock` INT NULL,
    `costo_compra` DECIMAL(10, 2) NULL,
    `precio_venta` DECIMAL(10, 2) NULL,
    `registro` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP());
ALTER TABLE
    `libros` ADD UNIQUE `libros_isbn_unique`(`isbn`);
CREATE TABLE `libro_autor`(
    `id_libro_autor` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `id_libro` BIGINT NOT NULL,
    `id_autor` BIGINT NOT NULL
);
CREATE TABLE `venta`(
    `id_venta` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `folio_venta` VARCHAR(30) NULL,
    `fecha_venta` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP(), `id_cliente` BIGINT NULL, `subtotal` DECIMAL(10, 2) NULL, `impuesto` DECIMAL(10, 2) NULL, `total` DECIMAL(10, 2) NULL);
ALTER TABLE
    `venta` ADD UNIQUE `venta_folio_venta_unique`(`folio_venta`);
CREATE TABLE `detalle_venta`(
    `id_detalle_venta` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `id_venta` BIGINT NOT NULL,
    `id_libro` BIGINT NOT NULL,
    `cantidad` INT NOT NULL,
    `precio_unitario` DECIMAL(10, 2) NOT NULL
);
ALTER TABLE
    `detalle_venta` ADD CONSTRAINT `detalle_venta_id_venta_foreign` FOREIGN KEY(`id_venta`) REFERENCES `venta`(`id_venta`);
ALTER TABLE
    `venta` ADD CONSTRAINT `venta_id_cliente_foreign` FOREIGN KEY(`id_cliente`) REFERENCES `cliente`(`id_cliente`);
ALTER TABLE
    `libros` ADD CONSTRAINT `libros_id_genero_foreign` FOREIGN KEY(`id_genero`) REFERENCES `generos`(`id_genero`);
ALTER TABLE
    `detalle_venta` ADD CONSTRAINT `detalle_venta_id_libro_foreign` FOREIGN KEY(`id_libro`) REFERENCES `libros`(`id_libro`);
ALTER TABLE
    `libros` ADD CONSTRAINT `libros_id_editorial_foreign` FOREIGN KEY(`id_editorial`) REFERENCES `editoriales`(`id_editorial`);
ALTER TABLE
    `libro_autor` ADD CONSTRAINT `libro_autor_id_autor_foreign` FOREIGN KEY(`id_autor`) REFERENCES `autores`(`id_autor`);
ALTER TABLE
    `libro_autor` ADD CONSTRAINT `libro_autor_id_libro_foreign` FOREIGN KEY(`id_libro`) REFERENCES `libros`(`id_libro`);

-- ---------- Datos de prueba ----------
INSERT INTO generos (nombre_genero) VALUES
 ('Novela'), ('Infantil'), ('Ciencia'), ('Historia'), ('Poesía');

INSERT INTO editoriales (nombre_editorial, telefono) VALUES
 ('Penguin Random House', '5553540000'),
 ('Planeta', '5553222000'),
 ('Fondo de Cultura Económica', '5552274672');

INSERT INTO autores (nombre_autor, nacionalidad) VALUES
 ('Gabriel García Márquez', 'Colombiana'),
 ('Juan Rulfo', 'Mexicana'),
 ('Octavio Paz', 'Mexicano'),
 ('Elena Poniatowska', 'Mexicana'),
 ('Carl Sagan', 'Estadounidense');

INSERT INTO libros (isbn, titulo, id_editorial, id_genero, anio_publicacion, stock_max, stock_min, stock, costo_compra, precio_venta) VALUES
 ('9780307474728', 'Cien años de soledad', 1, 1, 1967, 20, 4, 12, 180.00, 299.00),
 ('9786071603081', 'Pedro Páramo', 3, 1, 1955, 25, 5, 3, 85.00, 149.00),
 ('9786071600998', 'El laberinto de la soledad', 3, 4, 1950, 15, 3, 8, 120.00, 199.00),
 ('9786070739736', 'La noche de Tlatelolco', 2, 4, 1971, 15, 3, 2, 140.00, 239.00),
 ('9788408176220', 'Cosmos', 2, 3, 1980, 10, 2, 6, 230.00, 389.00);

INSERT INTO libro_autor (id_libro, id_autor) VALUES
 (1, 1), (2, 2), (3, 3), (4, 4), (5, 5);

INSERT INTO cliente (nombre, ap_paterno, ap_materno, telefono, correo, rfc) VALUES
 ('Ana', 'López', 'Ruiz', '6681234567', 'ana.lopez@correo.com', NULL),
 ('Luis', 'Ramírez', 'Soto', '6687654321', 'luis.ramirez@correo.com', 'RASL900101AB1');
