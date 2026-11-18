// Autenticación sencilla: un usuario/contraseña desde .env y una cookie firmada (sin dependencias extra)
const crypto = require('crypto');

const USER = process.env.AUTH_USER || 'admin';
const PASS = process.env.AUTH_PASSWORD || 'admin123';
const SECRET = process.env.AUTH_SECRET || crypto.randomBytes(32).toString('hex');
const DURACION = 8 * 60 * 60 * 1000; // 8 horas

const firmar = t => crypto.createHmac('sha256', SECRET).update(t).digest('hex');
const igual = (a, b) => {
  const x = crypto.createHash('sha256').update(String(a)).digest();
  const y = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(x, y);
};

function leerCookie(req) {
  const m = /(?:^|;\s*)sesion=([^;]+)/.exec(req.headers.cookie || '');
  if (!m) return null;
  const [usuario, exp, firma] = decodeURIComponent(m[1]).split('|');
  if (!firma || Date.now() > Number(exp) || !igual(firma, firmar(`${usuario}|${exp}`))) return null;
  return usuario;
}

function instalar(app) {
  app.post('/auth/login', (req, res) => {
    const { usuario, password } = req.body || {};
    if (!igual(usuario, USER) | !igual(password, PASS)) {
      return res.status(401).json({ error: 'Usuario o contraseña incorrectos.' });
    }
    const exp = Date.now() + DURACION;
    const valor = encodeURIComponent(`${usuario}|${exp}|${firmar(`${usuario}|${exp}`)}`);
    res.setHeader('Set-Cookie', `sesion=${valor}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${DURACION / 1000}`);
    res.json({ ok: true });
  });

  app.post('/auth/logout', (req, res) => {
    res.setHeader('Set-Cookie', 'sesion=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
    res.json({ ok: true });
  });

  // Todo lo que siga a este middleware exige sesión (salvo la pantalla de login y su CSS)
  app.use((req, res, next) => {
    if (['/login.html', '/css/estilos.css'].includes(req.path)) return next();
    if (leerCookie(req)) return next();
    if (req.path.startsWith('/api/')) return res.status(401).json({ error: 'Sesión requerida.' });
    res.redirect('/login.html');
  });
}

module.exports = { instalar, usandoClaveDefault: !process.env.AUTH_PASSWORD };
