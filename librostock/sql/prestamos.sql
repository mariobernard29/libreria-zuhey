-- LibroStock: préstamos de libros (una copia por préstamo)
-- Uso: mysql -u libreria_app -p libreria < sql/prestamos.sql
CREATE TABLE IF NOT EXISTS `prestamo`(
    `id_prestamo` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
    `id_libro` BIGINT NOT NULL,
    `id_cliente` BIGINT NOT NULL,
    `fecha_prestamo` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    `fecha_limite` DATE NOT NULL,
    `fecha_devolucion` DATETIME NULL,
    CONSTRAINT `prestamo_libro_fk` FOREIGN KEY (`id_libro`) REFERENCES `libros`(`id_libro`),
    CONSTRAINT `prestamo_cliente_fk` FOREIGN KEY (`id_cliente`) REFERENCES `cliente`(`id_cliente`)
);
