// POST /api/auth — autenticação no servidor (conta compartilhada web ↔ mobile)
// Body: { action: "login"|"register"|"google"|"requestCode"|"verifyCode", email, password, name, code, googleUser }
// GET /api/auth + Authorization: Bearer <token> → { user }
// DELETE /api/auth + Bearer → logout
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { kvGet, kvSet, kvDel } from "../kv.js";
import { handleOptions, sendJSON, setCors } from "../innertube.js";

const TOKEN_TTL = 30 * 24 * 60 * 60; // 30 dias
const CODE_TTL = 5 * 60;

const isValidEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(String(v || "").trim());
const hashEmail = (email) => String(email || "").trim().toLowerCase();
const initialsFor = (name) =>
  String(name || "U").trim().split(/\s+/).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "U";

function hashPw(password, salt = randomBytes(16).toString("hex")) {
  return { salt, hash: scryptSync(password, salt, 64).toString("hex") };
}
function verifyPw(password, salt, hash) {
  try {
    const h = scryptSync(password, salt, 64);
    return timingSafeEqual(h, Buffer.from(hash, "hex"));
  } catch { return false; }
}
function publicUser(u) {
  if (!u) return null;
  return {
    id: u.id, name: u.name, email: u.email, photo: u.photo || null,
    initials: u.initials, plan: u.plan || "Premium", provider: u.provider || "email",
    passwordSet: !!u.passwordHash, createdAt: u.createdAt,
  };
}
async function getUserByEmail(email) {
  return kvGet(`user:email:${hashEmail(email)}`);
}
async function saveUser(u) {
  await kvSet(`user:email:${u.email}`, u);
  await kvSet(`user:id:${u.id}`, u.id);
  return u;
}
async function issueToken(userId) {
  const token = randomBytes(32).toString("hex");
  await kvSet(`session:${token}`, { userId, createdAt: Date.now() }, { ex: TOKEN_TTL });
  return token;
}
export async function userIdFromToken(req) {
  const raw = req.headers?.authorization || req.headers?.Authorization || "";
  const token = String(raw).replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;
  const s = await kvGet(`session:${token}`);
  return s?.userId || null;
}
async function getUserById(id) {
  const email = await kvGet(`user:id:${id}`);
  if (!email) return null;
  // email aqui é o email normalizado salvo em saveUser (usamos email como chave id->email)
  return getUserByEmail(email);
}

export default async function handler(req, res) {
  if (handleOptions(req, res)) return;
  setCors(res);

  if (req.method === "GET") {
    const uid = await userIdFromToken(req);
    if (!uid) return sendJSON(res, 401, { error: "Não autenticado." });
    const user = await getUserById(uid);
    if (!user) return sendJSON(res, 401, { error: "Sessão inválida." });
    return sendJSON(res, 200, { user: publicUser(user) });
  }

  if (req.method === "DELETE") {
    const raw = req.headers?.authorization || "";
    const token = String(raw).replace(/^Bearer\s+/i, "").trim();
    if (token) await kvDel(`session:${token}`);
    return sendJSON(res, 200, { ok: true });
  }

  if (req.method !== "POST") return sendJSON(res, 405, { error: "Method Not Allowed" });

  const body = req.body && typeof req.body === "object" ? req.body : {};
  const action = String(body.action || "login");
  const email = hashEmail(body.email);

  try {
    if (action === "google") {
      const g = body.googleUser || {};
      if (!isValidEmail(g.email)) return sendJSON(res, 400, { error: "E-mail do Google inválido." });
      const safeEmail = hashEmail(g.email);
      let existing = await getUserByEmail(safeEmail);
      if (!existing) {
        const name = String(g.name || safeEmail.split("@")[0] || "Usuário").trim();
        existing = {
          id: `u_${Date.now()}`, name, email: safeEmail,
          passwordHash: null, passwordSalt: null, photo: g.photo || null,
          initials: initialsFor(name), plan: "Premium", provider: "google", createdAt: Date.now(),
        };
        await saveUser(existing);
      } else {
        existing = { ...existing, name: existing.name || g.name || existing.name, photo: g.photo || existing.photo };
        await saveUser(existing);
      }
      const token = await issueToken(existing.id);
      return sendJSON(res, 200, { user: publicUser(existing), token });
    }

    if (action === "requestCode") {
      if (!isValidEmail(email)) return sendJSON(res, 400, { error: "Insira um e-mail válido." });
      const code = String(Math.floor(100000 + Math.random() * 900000));
      await kvSet(`code:${email}`, { code, attempts: 0, userExists: !!(await getUserByEmail(email)) }, { ex: CODE_TTL });
      // Em produção, enviar por e-mail. Retornamos demoCode para fluxo local/dev.
      return sendJSON(res, 200, { demoCode: code, userExists: !!(await getUserByEmail(email)) });
    }

    if (action === "verifyCode") {
      const rec = await kvGet(`code:${email}`);
      if (!rec) return sendJSON(res, 400, { error: "Solicite um código primeiro." });
      if (rec.attempts >= 5) return sendJSON(res, 400, { error: "Muitas tentativas — solicite um novo código." });
      if (String(body.code || "").trim() !== rec.code) {
        await kvSet(`code:${email}`, { ...rec, attempts: rec.attempts + 1 }, { ex: CODE_TTL });
        return sendJSON(res, 400, { error: "Código incorreto." });
      }
      const user = await getUserByEmail(email);
      if (!user) return sendJSON(res, 400, { error: "Conta não encontrada. Cadastre-se primeiro." });
      await kvDel(`code:${email}`);
      const token = await issueToken(user.id);
      return sendJSON(res, 200, { user: publicUser(user), token });
    }

    // login / register (mesmo comportamento do web: conta nova cria se senha >= 6)
    if (!isValidEmail(email)) return sendJSON(res, 400, { error: "Insira um e-mail válido." });
    if (!body.password) return sendJSON(res, 400, { error: "Informe sua senha." });
    if (String(body.password).length < 6) return sendJSON(res, 400, { error: "A senha precisa de pelo menos 6 caracteres." });

    const existing = await getUserByEmail(email);
    if (existing) {
      if (!existing.passwordHash) {
        return sendJSON(res, 400, { error: "Esta conta usa login com Google ou código — use \"Continuar com o Google\" ou \"Login por código\"." });
      }
      if (!verifyPw(String(body.password), existing.passwordSalt, existing.passwordHash)) {
        return sendJSON(res, 401, { error: "E-mail ou senha incorretos." });
      }
      const token = await issueToken(existing.id);
      return sendJSON(res, 200, { user: publicUser(existing), token });
    }

    const name = String(body.name || email.split("@")[0] || "Usuário").trim();
    const { salt, hash } = hashPw(String(body.password));
    const record = {
      id: `u_${Date.now()}`, name, email,
      passwordHash: hash, passwordSalt: salt, photo: null,
      initials: initialsFor(name), plan: "Premium", provider: "email", createdAt: Date.now(),
    };
    await saveUser(record);
    const token = await issueToken(record.id);
    return sendJSON(res, 201, { user: publicUser(record), token });
  } catch (e) {
    return sendJSON(res, 500, { error: "Erro interno de autenticação.", details: String(e?.message || e) });
  }
}
