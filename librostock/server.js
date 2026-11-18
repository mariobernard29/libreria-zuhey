// LibroStock - servidor web local (Node.js + Express + MySQL)
require('dotenv').config();
const express = require('express');
const path = require('path');
const pool = require('./db');
const auth = require('./auth');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const IVA = Number(process.env.IVA || 0.16);

app.use(express.json());
auth.instalar(app);
app.use(express.static(path.join(__dirname, 'public')));

// Envuelve rutas async para mandar los errores al manejador final
const h = fn => (req, res, next) => fn(req, res, next).catch(next);

// ---------- Catálogos simples (editoriales, géneros, autores, clientes) ----------
const catalogos = {
  editoriales: { id: 'id_editorial', campos: ['nombre_editorial', 'telefono'], orden: 'nombre_editorial' },
  generos:     { id: 'id_genero',    campos: ['nombre_genero'],               orden: 'nombre_genero' },
  autores:     { id: 'id_autor',     campos: ['nombre_autor', 'nacionalidad'], orden: 'nombre_autor' },
  cliente:     { id: 'id_cliente',   campos: ['nombre', 'ap_paterno', 'ap_materno', 'telefono', 'correo', 'rfc'], orden: 'nombre' }
};

for (const [tabla, cfg] of Object.entries(catalogos)) {
  const base = `/api/${tabla}`;

  app.get(base, h(async (req, res) => {
    const [rows] = await pool.query(`SELECT * FROM \`${tabla}\` ORDER BY ${cfg.orden}`);
    res.json(rows);
  }));

  app.post(base, h(async (req, res) => {
    const valores = cfg.campos.map(c => req.body[c] || null);
    const [r] = await pool.query(
      `INSERT INTO \`${tabla}\` (${cfg.campos.join(',')}) VALUES (${cfg.campos.map(() => '?').join(',')})`,
      valores
    );
    res.status(201).json({ id: r.insertId });
  }));

  app.put(`${base}/:id`, h(async (req, res) => {
    const valores = cfg.campos.map(c => req.body[c] || null);
    await pool.query(
      `UPDATE \`${tabla}\` SET ${cfg.campos.map(c => `${c}=?`).join(',')} WHERE ${cfg.id}=?`,
      [...valores, req.params.id]
    );
    res.json({ ok: true });
  }));

  app.delete(`${base}/:id`, h(async (req, res) => {
    await pool.query(`DELETE FROM \`${tabla}\` WHERE ${cfg.id}=?`, [req.params.id]);
    res.json({ ok: true });
  }));
}

// ---------- Libros (con editorial, género y varios autores) ----------
const SQL_LIBROS = `
  SELECT l.*, e.nombre_editorial, g.nombre_genero,
         GROUP_CONCAT(a.nombre_autor ORDER BY a.nombre_autor SEPARATOR ', ') AS autores,
         GROUP_CONCAT(a.id_autor) AS ids_autores
  FROM libros l
  LEFT JOIN editoriales e ON e.id_editorial = l.id_editorial
  LEFT JOIN generos g     ON g.id_genero    = l.id_genero
  LEFT JOIN libro_autor la ON la.id_libro   = l.id_libro
  LEFT JOIN autores a     ON a.id_autor     = la.id_autor`;

app.get('/api/libros', h(async (req, res) => {
  const q = `%${req.query.q || ''}%`;
  const [rows] = await pool.query(
    `${SQL_LIBROS} WHERE l.titulo LIKE ? OR l.isbn LIKE ? OR a.nombre_autor LIKE ?
     GROUP BY l.id_libro ORDER BY l.titulo`, [q, q, q]);
  res.json(rows);
}));

const CAMPOS_LIBRO = ['isbn', 'titulo', 'id_editorial', 'id_genero', 'anio_publicacion',
  'stock_max', 'stock_min', 'stock', 'costo_compra', 'precio_venta'];

async function guardarAutores(con, idLibro, autores) {
  await con.query('DELETE FROM libro_autor WHERE id_libro=?', [idLibro]);
  for (const idAutor of autores || []) {
    await con.query('INSERT INTO libro_autor (id_libro, id_autor) VALUES (?,?)', [idLibro, idAutor]);
  }
}

app.post('/api/libros', h(async (req, res) => {
  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    const [r] = await con.query(
      `INSERT INTO libros (${CAMPOS_LIBRO.join(',')}) VALUES (${CAMPOS_LIBRO.map(() => '?').join(',')})`,
      CAMPOS_LIBRO.map(c => req.body[c] ?? null));
    await guardarAutores(con, r.insertId, req.body.autores);
    await con.commit();
    res.status(201).json({ id: r.insertId });
  } catch (e) { await con.rollback(); throw e; } finally { con.release(); }
}));

app.put('/api/libros/:id', h(async (req, res) => {
  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    await con.query(
      `UPDATE libros SET ${CAMPOS_LIBRO.map(c => `${c}=?`).join(',')} WHERE id_libro=?`,
      [...CAMPOS_LIBRO.map(c => req.body[c] ?? null), req.params.id]);
    await guardarAutores(con, req.params.id, req.body.autores);
    await con.commit();
    res.json({ ok: true });
  } catch (e) { await con.rollback(); throw e; } finally { con.release(); }
}));

app.delete('/api/libros/:id', h(async (req, res) => {
  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    await con.query('DELETE FROM libro_autor WHERE id_libro=?', [req.params.id]);
    await con.query('DELETE FROM libros WHERE id_libro=?', [req.params.id]);
    await con.commit();
    res.json({ ok: true });
  } catch (e) { await con.rollback(); throw e; } finally { con.release(); }
}));

// ---------- Punto de venta: todo o nada en una transacción ----------
app.post('/api/ventas', h(async (req, res) => {
  const { id_cliente, partidas } = req.body; // partidas: [{id_libro, cantidad}]
  if (!Array.isArray(partidas) || partidas.length === 0) {
    return res.status(400).json({ error: 'La venta no tiene libros.' });
  }
  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    let subtotal = 0;
    const detalle = [];
    for (const p of partidas) {
      // FOR UPDATE bloquea la fila para que dos ventas no descuenten el mismo stock a la vez
      const [[libro]] = await con.query(
        'SELECT id_libro, titulo, stock, precio_venta FROM libros WHERE id_libro=? FOR UPDATE', [p.id_libro]);
      if (!libro) throw Object.assign(new Error('Libro no encontrado.'), { status: 400 });
      if ((libro.stock || 0) < p.cantidad) {
        throw Object.assign(new Error(`Stock insuficiente de "${libro.titulo}" (hay ${libro.stock || 0}).`), { status: 400 });
      }
      subtotal += libro.precio_venta * p.cantidad;
      detalle.push({ ...p, precio: libro.precio_venta });
    }
    subtotal = Math.round(subtotal * 100) / 100;
    const impuesto = Math.round(subtotal * IVA * 100) / 100;
    const total = Math.round((subtotal + impuesto) * 100) / 100;

    const [v] = await con.query(
      'INSERT INTO venta (id_cliente, subtotal, impuesto, total) VALUES (?,?,?,?)',
      [id_cliente || null, subtotal, impuesto, total]);
    const folio = `V-${new Date().getFullYear()}-${String(v.insertId).padStart(6, '0')}`;
    await con.query('UPDATE venta SET folio_venta=? WHERE id_venta=?', [folio, v.insertId]);

    for (const d of detalle) {
      await con.query(
        'INSERT INTO detalle_venta (id_venta, id_libro, cantidad, precio_unitario) VALUES (?,?,?,?)',
        [v.insertId, d.id_libro, d.cantidad, d.precio]);
      await con.query('UPDATE libros SET stock = stock - ? WHERE id_libro=?', [d.cantidad, d.id_libro]);
    }
    await con.commit();
    res.status(201).json({ id_venta: v.insertId, folio, subtotal, impuesto, total });
  } catch (e) { await con.rollback(); throw e; } finally { con.release(); }
}));

app.get('/api/ventas', h(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT v.*, CONCAT_WS(' ', c.nombre, c.ap_paterno, c.ap_materno) AS cliente
    FROM venta v LEFT JOIN cliente c ON c.id_cliente = v.id_cliente
    ORDER BY v.fecha_venta DESC LIMIT 50`);
  res.json(rows);
}));

// ---------- Préstamos: una copia por préstamo; baja el stock al prestar y sube al devolver ----------
app.post('/api/prestamos', h(async (req, res) => {
  const { id_libro, id_cliente } = req.body;
  const dias = Math.min(Math.max(parseInt(req.body.dias, 10) || 7, 1), 60);
  if (!id_libro || !id_cliente) return res.status(400).json({ error: 'Elige un libro y un cliente.' });
  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    const [[libro]] = await con.query('SELECT titulo, stock FROM libros WHERE id_libro=? FOR UPDATE', [id_libro]);
    if (!libro) throw Object.assign(new Error('Libro no encontrado.'), { status: 400 });
    if ((libro.stock || 0) < 1) throw Object.assign(new Error(`No hay ejemplares disponibles de "${libro.titulo}".`), { status: 400 });
    const [[cli]] = await con.query('SELECT id_cliente FROM cliente WHERE id_cliente=?', [id_cliente]);
    if (!cli) throw Object.assign(new Error('Cliente no encontrado.'), { status: 400 });
    const [r] = await con.query(
      'INSERT INTO prestamo (id_libro, id_cliente, fecha_limite) VALUES (?,?, DATE_ADD(CURDATE(), INTERVAL ? DAY))',
      [id_libro, id_cliente, dias]);
    await con.query('UPDATE libros SET stock = stock - 1 WHERE id_libro=?', [id_libro]);
    await con.commit();
    res.status(201).json({ id_prestamo: r.insertId });
  } catch (e) { await con.rollback(); throw e; } finally { con.release(); }
}));

app.post('/api/prestamos/:id/devolver', h(async (req, res) => {
  const con = await pool.getConnection();
  try {
    await con.beginTransaction();
    const [[p]] = await con.query('SELECT id_libro, fecha_devolucion FROM prestamo WHERE id_prestamo=? FOR UPDATE', [req.params.id]);
    if (!p) throw Object.assign(new Error('Préstamo no encontrado.'), { status: 404 });
    if (p.fecha_devolucion) throw Object.assign(new Error('Este préstamo ya fue devuelto.'), { status: 400 });
    await con.query('UPDATE prestamo SET fecha_devolucion = NOW() WHERE id_prestamo=?', [req.params.id]);
    await con.query('UPDATE libros SET stock = stock + 1 WHERE id_libro=?', [p.id_libro]);
    await con.commit();
    res.json({ ok: true });
  } catch (e) { await con.rollback(); throw e; } finally { con.release(); }
}));

app.get('/api/prestamos', h(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.*, l.titulo, CONCAT_WS(' ', c.nombre, c.ap_paterno, c.ap_materno) AS cliente,
           CASE WHEN p.fecha_devolucion IS NOT NULL THEN 'devuelto'
                WHEN p.fecha_limite < CURDATE() THEN 'vencido' ELSE 'activo' END AS estado
    FROM prestamo p
    JOIN libros l ON l.id_libro = p.id_libro
    JOIN cliente c ON c.id_cliente = p.id_cliente
    ORDER BY (p.fecha_devolucion IS NOT NULL), p.fecha_limite, p.id_prestamo DESC LIMIT 200`);
  res.json(rows);
}));

// ---------- Alertas y reportes ----------
app.get('/api/alertas', h(async (req, res) => {
  const [rows] = await pool.query(`
    SELECT id_libro, isbn, titulo, stock, stock_min, stock_max,
           GREATEST(COALESCE(stock_max,0) - COALESCE(stock,0), 0) AS sugerido_compra
    FROM libros WHERE COALESCE(stock,0) <= COALESCE(stock_min,0)
    ORDER BY stock`);
  res.json(rows);
}));

app.get('/api/reportes', h(async (req, res) => {
  const [[hoy]] = await pool.query(`
    SELECT COUNT(*) AS ventas, COALESCE(SUM(total),0) AS total
    FROM venta WHERE DATE(fecha_venta) = CURDATE()`);
  const [top] = await pool.query(`
    SELECT l.titulo, SUM(d.cantidad) AS vendidos, SUM(d.cantidad * d.precio_unitario) AS importe
    FROM detalle_venta d
    JOIN venta v  ON v.id_venta = d.id_venta
    JOIN libros l ON l.id_libro = d.id_libro
    WHERE v.fecha_venta >= DATE_FORMAT(CURDATE(), '%Y-%m-01')
    GROUP BY l.id_libro ORDER BY vendidos DESC LIMIT 10`);
  const [[inv]] = await pool.query(`
    SELECT COUNT(*) AS titulos, COALESCE(SUM(stock),0) AS ejemplares,
           COALESCE(SUM(stock * costo_compra),0) AS valor_costo
    FROM libros`);
  const [porGenero] = await pool.query(`
    SELECT COALESCE(g.nombre_genero,'Sin género') AS genero, SUM(d.cantidad) AS vendidos
    FROM detalle_venta d
    JOIN libros l ON l.id_libro = d.id_libro
    LEFT JOIN generos g ON g.id_genero = l.id_genero
    GROUP BY genero ORDER BY vendidos DESC`);
  res.json({ hoy, top, inventario: inv, porGenero });
}));

// ---------- Manejo de errores ----------
app.use((err, req, res, next) => {
  if (err.code === 'ER_DUP_ENTRY') return res.status(400).json({ error: 'Ya existe un registro con ese ISBN, correo o folio.' });
  if (err.code === 'ER_ROW_IS_REFERENCED_2') return res.status(400).json({ error: 'No se puede borrar: está en uso en otros registros.' });
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Error interno.' });
});

// Solo escucha en el propio equipo: no queda expuesto a la red
app.listen(PORT, '127.0.0.1', () => {
  console.log(`LibroStock en http://127.0.0.1:${PORT}`);
  if (auth.usandoClaveDefault) console.warn('AVISO: usando clave por defecto; define AUTH_PASSWORD en .env');
});
