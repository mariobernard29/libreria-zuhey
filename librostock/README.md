# LibroStock

Sistema de inventario y ventas para una librería. Node.js + Express + MySQL, con interfaz en HTML, CSS y JavaScript. Pensado para correr en MX Linux.

## Puesta en marcha (en MX Linux)

MX Linux (Debian) trae MariaDB en sus repositorios, no MySQL. Para MySQL se agrega el repositorio oficial de Oracle
(descargar `mysql-apt-config_*_all.deb` desde https://dev.mysql.com/downloads/repo/apt/):

```bash
sudo apt install -y wget gnupg nodejs npm git
sudo dpkg -i mysql-apt-config_*_all.deb   # elegir MySQL Server 8.4 LTS
sudo apt update
sudo apt install -y mysql-server         # pide la contraseña de root de MySQL
mysql -u root -p
```

```sql
CREATE DATABASE libreria CHARACTER SET utf8mb4;
CREATE USER 'libreria_app'@'localhost' IDENTIFIED BY 'CambiarEstaClave';
GRANT ALL PRIVILEGES ON libreria.* TO 'libreria_app'@'localhost';
FLUSH PRIVILEGES;
EXIT;
```

```bash
cd ~/librostock
mysql -u libreria_app -p libreria < sql/libreria.sql
cp .env.example .env      # cambiar la clave si se usó otra
npm install
npm start                 # abrir http://127.0.0.1:3000 en Firefox
```

## Estructura

```
librostock/
├── server.js          rutas de la API y servidor web
├── db.js              conexión a MySQL
├── package.json
├── .env.example
├── sql/libreria.sql   esquema + datos de prueba
└── public/
    ├── index.html
    ├── css/estilos.css
    └── js/app.js
```
