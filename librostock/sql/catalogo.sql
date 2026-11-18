-- LibroStock: catálogo ampliado de libros y clientes (datos de muestra)
-- Los ISBN son ficticios de ejemplo. Uso: mysql -u libreria_app -p libreria < sql/catalogo.sql
SET NAMES utf8mb4;

INSERT INTO generos (nombre_genero) VALUES ('Ensayo'), ('Fantasía'), ('Policiaca'), ('Biografía'), ('Cuento');

INSERT INTO editoriales (nombre_editorial, telefono) VALUES
 ('Alfaguara', '5553540100'), ('Anagrama', '5552550000'), ('Siruela', '5555550101'), ('Era', '5556580000');

INSERT INTO autores (nombre_autor, nacionalidad) VALUES
 ('Mario Vargas Llosa','Peruana'), ('Julio Cortázar','Argentina'), ('Jorge Luis Borges','Argentina'),
 ('Isabel Allende','Chilena'), ('Laura Esquivel','Mexicana'), ('Carlos Fuentes','Mexicana'),
 ('Roberto Bolaño','Chilena'), ('Antoine de Saint-Exupéry','Francesa'), ('George Orwell','Británica'),
 ('J. R. R. Tolkien','Británica'), ('Agatha Christie','Británica'), ('Yuval Noah Harari','Israelí'),
 ('Stephen Hawking','Británica'), ('Sor Juana Inés de la Cruz','Mexicana'), ('Mario Benedetti','Uruguaya'),
 ('Juan José Arreola','Mexicana'), ('Rosario Castellanos','Mexicana'), ('Miguel de Cervantes','Española'),
 ('Paulo Coelho','Brasileña'), ('Ray Bradbury','Estadounidense');

-- (isbn, titulo, editorial, genero, anio, stock_max, stock_min, stock, costo, precio, autor)
CREATE TEMPORARY TABLE tmp_cat (isbn VARCHAR(30), titulo VARCHAR(255), editorial VARCHAR(150), genero VARCHAR(100),
  anio INT, smax INT, smin INT, stock INT, costo DECIMAL(10,2), precio DECIMAL(10,2), autor VARCHAR(255));
INSERT INTO tmp_cat VALUES
 ('9780000000011','La ciudad y los perros','Alfaguara','Novela',1963,20,4,10,170,289,'Mario Vargas Llosa'),
 ('9780000000028','Rayuela','Alfaguara','Novela',1963,20,4,7,190,319,'Julio Cortázar'),
 ('9780000000035','Ficciones','Penguin Random House','Cuento',1944,20,4,14,130,219,'Jorge Luis Borges'),
 ('9780000000042','La casa de los espíritus','Penguin Random House','Novela',1982,20,4,3,175,299,'Isabel Allende'),
 ('9780000000059','Como agua para chocolate','Planeta','Novela',1989,25,5,18,110,189,'Laura Esquivel'),
 ('9780000000066','La muerte de Artemio Cruz','Fondo de Cultura Económica','Novela',1962,15,3,6,140,239,'Carlos Fuentes'),
 ('9780000000073','Los detectives salvajes','Anagrama','Novela',1998,15,3,2,260,429,'Roberto Bolaño'),
 ('9780000000080','El principito','Siruela','Infantil',1943,40,8,30,70,129,'Antoine de Saint-Exupéry'),
 ('9780000000097','1984','Planeta','Novela',1949,25,5,11,120,209,'George Orwell'),
 ('9780000000103','El señor de los anillos','Planeta','Fantasía',1954,15,3,9,350,589,'J. R. R. Tolkien'),
 ('9780000000110','Asesinato en el Orient Express','Penguin Random House','Policiaca',1934,15,3,5,115,199,'Agatha Christie'),
 ('9780000000127','Sapiens','Penguin Random House','Historia',2011,20,4,13,230,389,'Yuval Noah Harari'),
 ('9780000000134','Breve historia del tiempo','Planeta','Ciencia',1988,15,3,4,180,309,'Stephen Hawking'),
 ('9780000000141','Primero sueño','Fondo de Cultura Económica','Poesía',1692,10,2,8,90,159,'Sor Juana Inés de la Cruz'),
 ('9780000000158','La tregua','Alfaguara','Novela',1960,15,3,6,105,179,'Mario Benedetti'),
 ('9780000000165','Confabulario','Fondo de Cultura Económica','Cuento',1952,12,3,2,95,169,'Juan José Arreola'),
 ('9780000000172','Balún Canán','Fondo de Cultura Económica','Novela',1957,12,3,7,100,175,'Rosario Castellanos'),
 ('9780000000189','Don Quijote de la Mancha','Alfaguara','Novela',1605,20,4,15,210,349,'Miguel de Cervantes'),
 ('9780000000196','El alquimista','Planeta','Novela',1988,30,6,22,95,169,'Paulo Coelho'),
 ('9780000000202','Fahrenheit 451','Penguin Random House','Novela',1953,20,4,1,125,215,'Ray Bradbury');

INSERT INTO libros (isbn, titulo, id_editorial, id_genero, anio_publicacion, stock_max, stock_min, stock, costo_compra, precio_venta)
SELECT t.isbn, t.titulo, e.id_editorial, g.id_genero, t.anio, t.smax, t.smin, t.stock, t.costo, t.precio
FROM tmp_cat t JOIN editoriales e ON e.nombre_editorial = t.editorial JOIN generos g ON g.nombre_genero = t.genero;

INSERT INTO libro_autor (id_libro, id_autor)
SELECT l.id_libro, a.id_autor FROM tmp_cat t
JOIN libros l ON l.isbn = t.isbn JOIN autores a ON a.nombre_autor = t.autor;
DROP TEMPORARY TABLE tmp_cat;

INSERT INTO cliente (nombre, ap_paterno, ap_materno, telefono, correo, rfc) VALUES
 ('María','Hernández','Gómez','6681112233','maria.hernandez@correo.com',NULL),
 ('Carlos','Martínez','Pérez','6684445566','carlos.martinez@correo.com','MAPC850312KJ4'),
 ('Sofía','García','Torres','6687778899','sofia.garcia@correo.com',NULL),
 ('Javier','Sánchez','Flores','6681231234','javier.sanchez@correo.com','SAFJ920715HD2'),
 ('Lucía','Morales','Vega','6684564567','lucia.morales@correo.com',NULL),
 ('Diego','Castillo','Rangel','6687897890','diego.castillo@correo.com',NULL),
 ('Valeria','Ortiz','Mendoza','6682223344','valeria.ortiz@correo.com','OIMV980228PL7'),
 ('Andrés','Navarro','Ibarra','6685556677','andres.navarro@correo.com',NULL),
 ('Paola','Reyes','Salas','6688889900','paola.reyes@correo.com',NULL),
 ('Ricardo','Domínguez','León','6683334455','ricardo.dominguez@correo.com','DOLR880930QW5');
