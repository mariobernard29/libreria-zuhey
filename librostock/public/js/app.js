// LibroStock - lógica del navegador
const $ = s => document.querySelector(s);
const $$ = s => document.querySelectorAll(s);
const pesos = n => '$' + Number(n || 0).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const esc = t => String(t ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

async function api(url, metodo = 'GET', datos) {
  const r = await fetch(url, {
    method: metodo,
    headers: datos ? { 'Content-Type': 'application/json' } : {},
    body: datos ? JSON.stringify(datos) : undefined
  });
  if (r.status === 401) { location.href = '/login.html'; return new Promise(() => {}); }
  const json = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(json.error || 'Error de servidor');
  return json;
}

function aviso(texto, error = false) {
  const a = $('#aviso');
  a.textContent = texto;
  a.className = 'aviso' + (error ? ' error' : '');
  a.hidden = false;
  clearTimeout(aviso.t);
  aviso.t = setTimeout(() => (a.hidden = true), 3500);
}

// ---------- Navegación ----------
const cargadores = {};
$$('#menu button').forEach(b => b.addEventListener('click', () => {
  $$('#menu button').forEach(x => x.classList.toggle('activo', x === b));
  $$('.vista').forEach(v => (v.hidden = v.id !== 'vista-' + b.dataset.vista));
  cargadores[b.dataset.vista]?.();
}));

// ---------- Libros ----------
let libros = [];

async function cargarLibros() {
  libros = await api('/api/libros?q=' + encodeURIComponent($('#buscar-libro').value));
  const tbody = $('#tabla-libros');
  if (!libros.length) { tbody.innerHTML = '<tr><td colspan="8" class="vacio">Sin libros registrados</td></tr>'; return; }
  tbody.innerHTML = libros.map(l => `
    <tr class="${(l.stock ?? 0) <= (l.stock_min ?? 0) ? 'bajo' : ''}">
      <td>${esc(l.isbn)}</td><td><strong>${esc(l.titulo)}</strong></td>
      <td>${esc(l.autores)}</td><td>${esc(l.nombre_editorial)}</td><td>${esc(l.nombre_genero)}</td>
      <td class="num">${l.stock ?? 0}</td><td class="num">${pesos(l.precio_venta)}</td>
      <td class="num">
        <button data-editar="${l.id_libro}">Editar</button>
        <button class="peligro" data-borrar="${l.id_libro}">Borrar</button>
      </td>
    </tr>`).join('');
}
cargadores.libros = cargarLibros;

let tBusqueda;
$('#buscar-libro').addEventListener('input', () => { clearTimeout(tBusqueda); tBusqueda = setTimeout(cargarLibros, 250); });

async function llenarSelects() {
  const [eds, gens, auts] = await Promise.all([api('/api/editoriales'), api('/api/generos'), api('/api/autores')]);
  const f = $('#form-libro');
  f.id_editorial.innerHTML = '<option value="">—</option>' + eds.map(e => `<option value="${e.id_editorial}">${esc(e.nombre_editorial)}</option>`).join('');
  f.id_genero.innerHTML = '<option value="">—</option>' + gens.map(g => `<option value="${g.id_genero}">${esc(g.nombre_genero)}</option>`).join('');
  f.autores.innerHTML = auts.map(a => `<option value="${a.id_autor}">${esc(a.nombre_autor)}</option>`).join('');
}

async function abrirLibro(libro) {
  await llenarSelects();
  const f = $('#form-libro');
  f.reset();
  $('#dlg-titulo').textContent = libro ? 'Editar libro' : 'Nuevo libro';
  f.id_libro.value = libro?.id_libro || '';
  if (libro) {
    ['isbn', 'titulo', 'id_editorial', 'id_genero', 'anio_publicacion', 'stock', 'stock_min', 'stock_max', 'costo_compra', 'precio_venta']
      .forEach(c => (f[c].value = libro[c] ?? ''));
    const ids = String(libro.ids_autores || '').split(',');
    [...f.autores.options].forEach(o => (o.selected = ids.includes(o.value)));
  }
  $('#dlg-libro').showModal();
}

$('#nuevo-libro').addEventListener('click', () => abrirLibro(null));
$('#cancelar-libro').addEventListener('click', () => $('#dlg-libro').close());

$('#tabla-libros').addEventListener('click', async e => {
  const idEditar = e.target.dataset.editar, idBorrar = e.target.dataset.borrar;
  if (idEditar) abrirLibro(libros.find(l => l.id_libro == idEditar));
  if (idBorrar && confirm('¿Borrar este libro?')) {
    try { await api('/api/libros/' + idBorrar, 'DELETE'); aviso('Libro borrado'); cargarLibros(); }
    catch (err) { aviso(err.message, true); }
  }
});

$('#form-libro').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const num = v => (v === '' ? null : Number(v));
  const datos = {
    isbn: f.isbn.value.trim() || null,
    titulo: f.titulo.value.trim(),
    id_editorial: num(f.id_editorial.value),
    id_genero: num(f.id_genero.value),
    anio_publicacion: num(f.anio_publicacion.value),
    stock: num(f.stock.value), stock_min: num(f.stock_min.value), stock_max: num(f.stock_max.value),
    costo_compra: num(f.costo_compra.value), precio_venta: num(f.precio_venta.value),
    autores: [...f.autores.selectedOptions].map(o => Number(o.value))
  };
  try {
    if (f.id_libro.value) await api('/api/libros/' + f.id_libro.value, 'PUT', datos);
    else await api('/api/libros', 'POST', datos);
    $('#dlg-libro').close();
    aviso('Libro guardado');
    cargarLibros(); actualizarAlertas();
  } catch (err) { aviso(err.message, true); }
});

// ---------- Punto de venta ----------
let partidas = [];
let librosVenta = [];

async function cargarVenta() {
  const [clientes, ls, ventas] = await Promise.all([api('/api/cliente'), api('/api/libros'), api('/api/ventas')]);
  librosVenta = ls;
  $('#venta-cliente').innerHTML = '<option value="">Público en general</option>' +
    clientes.map(c => `<option value="${c.id_cliente}">${esc([c.nombre, c.ap_paterno, c.ap_materno].filter(Boolean).join(' '))}</option>`).join('');
  $('#lista-libros').innerHTML = ls.map(l => `<option value="${esc(l.isbn || '')} | ${esc(l.titulo)}">${l.stock ?? 0} en stock</option>`).join('');
  $('#tabla-ventas').innerHTML = ventas.length ? ventas.map(v => `
    <tr><td>${esc(v.folio_venta)}</td><td>${new Date(v.fecha_venta).toLocaleString('es-MX')}</td>
    <td>${esc(v.cliente || 'Público en general')}</td><td class="num">${pesos(v.total)}</td></tr>`).join('')
    : '<tr><td colspan="4" class="vacio">Aún no hay ventas</td></tr>';
  pintarPartidas();
}
cargadores.venta = cargarVenta;

function pintarPartidas() {
  const tbody = $('#tabla-partidas');
  tbody.innerHTML = partidas.length ? partidas.map((p, i) => `
    <tr><td>${esc(p.titulo)}</td><td class="num">${p.cantidad}</td><td class="num">${pesos(p.precio)}</td>
    <td class="num">${pesos(p.precio * p.cantidad)}</td><td><button class="peligro" data-quitar="${i}">✕</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="vacio">Agrega libros a la venta</td></tr>';
  const sub = partidas.reduce((s, p) => s + p.precio * p.cantidad, 0);
  const iva = Math.round(sub * 0.16 * 100) / 100;
  $('#t-subtotal').textContent = pesos(sub);
  $('#t-iva').textContent = pesos(iva);
  $('#t-total').textContent = pesos(sub + iva);
}

$('#agregar-partida').addEventListener('click', () => {
  const texto = $('#venta-buscar').value;
  const libro = librosVenta.find(l => texto === `${l.isbn || ''} | ${l.titulo}` || texto === l.isbn || texto === l.titulo);
  const cantidad = Number($('#venta-cantidad').value);
  if (!libro) return aviso('Elige un libro de la lista', true);
  if (cantidad < 1) return aviso('La cantidad debe ser mayor a 0', true);
  const existente = partidas.find(p => p.id_libro === libro.id_libro);
  const total = (existente?.cantidad || 0) + cantidad;
  if (total > (libro.stock ?? 0)) return aviso(`Solo hay ${libro.stock ?? 0} de "${libro.titulo}"`, true);
  if (existente) existente.cantidad = total;
  else partidas.push({ id_libro: libro.id_libro, titulo: libro.titulo, precio: Number(libro.precio_venta), cantidad });
  $('#venta-buscar').value = ''; $('#venta-cantidad').value = 1;
  pintarPartidas();
});

$('#tabla-partidas').addEventListener('click', e => {
  if (e.target.dataset.quitar !== undefined) { partidas.splice(Number(e.target.dataset.quitar), 1); pintarPartidas(); }
});

$('#cobrar').addEventListener('click', async () => {
  if (!partidas.length) return aviso('La venta está vacía', true);
  try {
    const r = await api('/api/ventas', 'POST', {
      id_cliente: $('#venta-cliente').value || null,
      partidas: partidas.map(p => ({ id_libro: p.id_libro, cantidad: p.cantidad }))
    });
    aviso(`Venta ${r.folio} guardada: ${pesos(r.total)}`);
    partidas = [];
    cargarVenta(); actualizarAlertas();
  } catch (err) { aviso(err.message, true); }
});

// ---------- Préstamos ----------
let librosPrestamo = [];

async function cargarPrestamos() {
  const [clientes, ls, prestamos] = await Promise.all([api('/api/cliente'), api('/api/libros'), api('/api/prestamos')]);
  librosPrestamo = ls;
  $('#prestamo-cliente').innerHTML = '<option value="">Elige un cliente</option>' +
    clientes.map(c => `<option value="${c.id_cliente}">${esc([c.nombre, c.ap_paterno, c.ap_materno].filter(Boolean).join(' '))}</option>`).join('');
  $('#lista-prestamo').innerHTML = ls.filter(l => (l.stock ?? 0) > 0)
    .map(l => `<option value="${esc(l.isbn || '')} | ${esc(l.titulo)}">${l.stock} disponibles</option>`).join('');
  $('#tabla-prestamos').innerHTML = prestamos.length ? prestamos.map(p => `
    <tr class="${p.estado === 'vencido' ? 'bajo' : ''}">
      <td><strong>${esc(p.titulo)}</strong></td><td>${esc(p.cliente)}</td>
      <td>${new Date(p.fecha_prestamo).toLocaleDateString('es-MX')}</td>
      <td>${new Date(p.fecha_limite).toLocaleDateString('es-MX')}</td>
      <td>${p.estado === 'devuelto' ? 'Devuelto ' + new Date(p.fecha_devolucion).toLocaleDateString('es-MX') : p.estado === 'vencido' ? '⚠ Vencido' : 'Activo'}</td>
      <td class="num">${p.estado === 'devuelto' ? '' : `<button data-devolver="${p.id_prestamo}">Devolver</button>`}</td>
    </tr>`).join('')
    : '<tr><td colspan="6" class="vacio">Aún no hay préstamos</td></tr>';
}
cargadores.prestamos = cargarPrestamos;

$('#form-prestamo').addEventListener('submit', async e => {
  e.preventDefault();
  const f = e.target;
  const texto = f.libro.value;
  const libro = librosPrestamo.find(l => texto === `${l.isbn || ''} | ${l.titulo}` || texto === l.isbn || texto === l.titulo);
  if (!libro) return aviso('Elige un libro de la lista', true);
  try {
    await api('/api/prestamos', 'POST', { id_libro: libro.id_libro, id_cliente: Number(f.id_cliente.value), dias: Number(f.dias.value) });
    f.libro.value = '';
    aviso(`Préstamo registrado: ${libro.titulo}`);
    cargarPrestamos(); actualizarAlertas();
  } catch (err) { aviso(err.message, true); }
});

$('#tabla-prestamos').addEventListener('click', async e => {
  const id = e.target.dataset.devolver;
  if (id && confirm('¿Registrar la devolución?')) {
    try { await api(`/api/prestamos/${id}/devolver`, 'POST'); aviso('Libro devuelto'); cargarPrestamos(); actualizarAlertas(); }
    catch (err) { aviso(err.message, true); }
  }
});

// ---------- Catálogos ----------
async function cargarCatalogos() {
  for (const caja of $$('[data-catalogo]')) {
    const tabla = caja.dataset.catalogo;
    const filas = await api('/api/' + tabla);
    const [idCampo, nombreCampo, extra] = {
      autores: ['id_autor', 'nombre_autor', 'nacionalidad'],
      editoriales: ['id_editorial', 'nombre_editorial', 'telefono'],
      generos: ['id_genero', 'nombre_genero', null]
    }[tabla];
    caja.querySelector('.lista').innerHTML = filas.map(f => `
      <li><span>${esc(f[nombreCampo])} ${extra && f[extra] ? `<small>· ${esc(f[extra])}</small>` : ''}</span>
      <button class="peligro" data-tabla="${tabla}" data-id="${f[idCampo]}">✕</button></li>`).join('');
  }
}
cargadores.catalogos = cargarCatalogos;

$$('.form-catalogo').forEach(form => form.addEventListener('submit', async e => {
  e.preventDefault();
  const tabla = form.closest('[data-catalogo]').dataset.catalogo;
  try {
    await api('/api/' + tabla, 'POST', Object.fromEntries(new FormData(form)));
    form.reset(); aviso('Agregado'); cargarCatalogos();
  } catch (err) { aviso(err.message, true); }
}));

$('#vista-catalogos').addEventListener('click', async e => {
  const { tabla, id } = e.target.dataset;
  if (tabla && id && confirm('¿Borrar este registro?')) {
    try { await api(`/api/${tabla}/${id}`, 'DELETE'); cargarCatalogos(); }
    catch (err) { aviso(err.message, true); }
  }
});

// ---------- Clientes ----------
async function cargarClientes() {
  const filas = await api('/api/cliente');
  $('#tabla-clientes').innerHTML = filas.length ? filas.map(c => `
    <tr><td>${esc([c.nombre, c.ap_paterno, c.ap_materno].filter(Boolean).join(' '))}</td>
    <td>${esc(c.telefono)}</td><td>${esc(c.correo)}</td><td>${esc(c.rfc)}</td>
    <td class="num"><button class="peligro" data-borrar-cliente="${c.id_cliente}">Borrar</button></td></tr>`).join('')
    : '<tr><td colspan="5" class="vacio">Sin clientes</td></tr>';
}
cargadores.clientes = cargarClientes;

$('#form-cliente').addEventListener('submit', async e => {
  e.preventDefault();
  const datos = Object.fromEntries(new FormData(e.target));
  if (datos.rfc) datos.rfc = datos.rfc.toUpperCase();
  try { await api('/api/cliente', 'POST', datos); e.target.reset(); aviso('Cliente agregado'); cargarClientes(); }
  catch (err) { aviso(err.message, true); }
});

$('#tabla-clientes').addEventListener('click', async e => {
  const id = e.target.dataset.borrarCliente;
  if (id && confirm('¿Borrar este cliente?')) {
    try { await api('/api/cliente/' + id, 'DELETE'); cargarClientes(); }
    catch (err) { aviso(err.message, true); }
  }
});

// ---------- Alertas ----------
async function actualizarAlertas() {
  const filas = await api('/api/alertas');
  const globo = $('#contador-alertas');
  globo.textContent = filas.length; globo.hidden = !filas.length;
  $('#tabla-alertas').innerHTML = filas.length ? filas.map(l => `
    <tr class="bajo"><td>${esc(l.isbn)}</td><td>${esc(l.titulo)}</td><td class="num">${l.stock ?? 0}</td>
    <td class="num">${l.stock_min ?? 0}</td><td class="num">${l.stock_max ?? '—'}</td><td class="num"><strong>${l.sugerido_compra}</strong></td></tr>`).join('')
    : '<tr><td colspan="6" class="vacio">Todo el inventario está por encima del mínimo</td></tr>';
}
cargadores.alertas = actualizarAlertas;

// ---------- Reportes ----------
async function cargarReportes() {
  const r = await api('/api/reportes');
  $('#kpis').innerHTML = [
    ['Ventas de hoy', r.hoy.ventas], ['Vendido hoy', pesos(r.hoy.total)],
    ['Ejemplares en stock', r.inventario.ejemplares], ['Inventario a costo', pesos(r.inventario.valor_costo)]
  ].map(([t, v]) => `<div class="kpi"><span>${t}</span><strong>${v}</strong></div>`).join('');
  $('#tabla-top').innerHTML = r.top.length ? r.top.map(t => `
    <tr><td>${esc(t.titulo)}</td><td class="num">${t.vendidos}</td><td class="num">${pesos(t.importe)}</td></tr>`).join('')
    : '<tr><td colspan="3" class="vacio">Sin ventas este mes</td></tr>';
  const max = Math.max(1, ...r.porGenero.map(g => Number(g.vendidos)));
  $('#barras-genero').innerHTML = r.porGenero.length ? r.porGenero.map(g => `
    <div class="barra-g"><span>${esc(g.genero)}</span><div style="width:${(g.vendidos / max) * 100}%"></div><span>${g.vendidos}</span></div>`).join('')
    : '<p class="vacio">Sin datos</p>';
}
cargadores.reportes = cargarReportes;

// ---------- Inicio ----------
// Permite abrir una sección directo, p. ej. http://127.0.0.1:3000/#reportes
const inicial = location.hash.slice(1);
const botonInicial = document.querySelector(`#menu button[data-vista="${inicial}"]`);
if (botonInicial) botonInicial.click();
else cargarLibros().catch(err => aviso('No hay conexión con el servidor: ' + err.message, true));
actualizarAlertas().catch(() => {});

$('#salir').addEventListener('click', async () => {
  await fetch('/auth/logout', { method: 'POST' });
  location.href = '/login.html';
});
