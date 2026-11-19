# AGENTS.md — Instalación de LibroStock en MX Linux

Instrucciones para que un agente (o una persona) instale y ejecute LibroStock en MX Linux (base Debian).
La app vive en `librostock/`: Node.js + Express + MySQL/MariaDB, sin build; se sirve en `http://127.0.0.1:3000`.

## Reglas para el agente

- Pide al usuario (no inventes ni imprimas en logs) estas credenciales: clave de la BD (`DB_PASSWORD`), usuario/clave web (`AUTH_USER`, `AUTH_PASSWORD`).
- `AUTH_SECRET` sí lo generas tú: `openssl rand -hex 32`.
- Nunca subas `.env` a git (ya está en `.gitignore`).
- El servidor escucha solo en `127.0.0.1`; no lo expongas a la red sin que el usuario lo pida.
- Los comandos con `sudo` requieren que el usuario tenga permisos; si no, detente y avisa.

## 1. Dependencias del sistema

```bash
sudo apt update
sudo apt install -y git nodejs npm mariadb-server
node -v   # requiere Node 18 o superior
```

Se usa MariaDB (viene en los repos de MX Linux, instalación sin preguntas). `mysql2` es compatible con MariaDB.
Si el usuario exige MySQL de Oracle, ver "MySQL en lugar de MariaDB" abajo.

```bash
sudo systemctl enable --now mariadb
```

Si `node -v` es menor a 18, instala Node LTS (p. ej. con NodeSource o `nvm`) antes de seguir.

## 2. Obtener el código

```bash
git clone https://github.com/mariobernard29/libreria-zuhey.git ~/libreria-zuhey
cd ~/libreria-zuhey/librostock
```

## 3. Base de datos

Sustituye `CLAVE_BD` por la clave que dio el usuario:

```bash
sudo mysql <<'SQL'
CREATE DATABASE IF NOT EXISTS libreria CHARACTER SET utf8mb4;
CREATE USER IF NOT EXISTS 'libreria_app'@'localhost' IDENTIFIED BY 'CLAVE_BD';
GRANT ALL PRIVILEGES ON libreria.* TO 'libreria_app'@'localhost';
FLUSH PRIVILEGES;
SQL
```

Cargar esquema y datos, **en este orden** (el esquema crea las tablas; los demás dependen de él):

```bash
mysql -u libreria_app -p libreria < sql/libreria.sql     # esquema + datos de prueba (obligatorio)
mysql -u libreria_app -p libreria < sql/catalogo.sql     # catálogo ampliado (opcional, datos de muestra)
mysql -u libreria_app -p libreria < sql/prestamos.sql    # tabla de préstamos (necesaria si se usan préstamos)
```

Ejecuta cada archivo **una sola vez**: `libreria.sql` usa `CREATE TABLE` sin `IF NOT EXISTS` y `catalogo.sql` inserta datos que se duplicarían.

## 4. Configuración

```bash
cp .env.example .env
```

Edita `.env`:

| Variable | Valor |
|---|---|
| `DB_HOST` / `DB_PORT` | `127.0.0.1` / `3306` |
| `DB_USER` / `DB_NAME` | `libreria_app` / `libreria` |
| `DB_PASSWORD` | la clave de la sección 3 |
| `PORT` | `3000` |
| `IVA` | `0.16` |
| `AUTH_USER` / `AUTH_PASSWORD` | credenciales de acceso web que dio el usuario |
| `AUTH_SECRET` | salida de `openssl rand -hex 32` |

## 5. Instalar y arrancar

```bash
npm install
npm start
```

Debe imprimir `LibroStock en http://127.0.0.1:3000`.

## 6. Verificación

```bash
curl -sI http://127.0.0.1:3000/ | head -n 1                  # esperado: HTTP 200 (o 302 a login.html)
mysql -u libreria_app -p libreria -e "SHOW TABLES;"           # deben verse cliente, libros, autores, etc.
```

Para comprobar el acceso: abrir `http://127.0.0.1:3000` en Firefox e iniciar sesión con `AUTH_USER`/`AUTH_PASSWORD`.

## 7. (Opcional) Arranque automático con systemd

Reemplaza `USUARIO` por el usuario de Linux dueño de la carpeta y ajusta la ruta de `node` (`which node`):

```bash
sudo tee /etc/systemd/system/librostock.service >/dev/null <<'EOF'
[Unit]
Description=LibroStock
After=network.target mariadb.service

[Service]
User=USUARIO
WorkingDirectory=/home/USUARIO/libreria-zuhey/librostock
ExecStart=/usr/bin/node server.js
Restart=on-failure

[Install]
WantedBy=multi-user.target
EOF
sudo systemctl daemon-reload
sudo systemctl enable --now librostock
```

Nota: MX Linux usa sysvinit por defecto en algunas ediciones. Si `systemctl` no está disponible, omite este paso y
ejecuta `npm start` (p. ej. dentro de `tmux`) o usa un autostart de sesión.

## Problemas comunes

- `ER_ACCESS_DENIED_ERROR`: la clave de `.env` no coincide con la del usuario `libreria_app`.
- `ECONNREFUSED 127.0.0.1:3306`: la base no está corriendo (`sudo systemctl start mariadb` o `sudo service mariadb start`).
- `EADDRINUSE`: el puerto 3000 está ocupado; cambia `PORT` en `.env`.
- `Table ... already exists`: ya se cargó `libreria.sql`; no lo repitas.

## MySQL en lugar de MariaDB (solo si el usuario lo exige)

1. Descargar `mysql-apt-config_*_all.deb` desde https://dev.mysql.com/downloads/repo/apt/ (puede requerir interacción).
2. `sudo dpkg -i mysql-apt-config_*_all.deb` y elegir MySQL Server 8.4 LTS.
3. `sudo apt update && sudo apt install -y mysql-server` (pide clave de root).
4. Seguir desde la sección 3, usando `mysql -u root -p` en lugar de `sudo mysql`.
