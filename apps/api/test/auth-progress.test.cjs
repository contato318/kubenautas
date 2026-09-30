const { before, after, test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, createHash } = require('node:crypto');
const { Pool } = require('pg');
const supertest = require('supertest');
require('reflect-metadata');

const database = process.env.TEST_DATABASE_URL;
const integration = database ? test : test.skip;
const schema = `test_${randomUUID().replaceAll('-', '')}`;
const origin = 'http://localhost:5173';
let app, admin, db, oauth, store;
const originalFetch = global.fetch;
let tokenRequests = 0;
const expectedChallenges = new Map();

async function start() {
  const { NestFactory } = require('@nestjs/core');
  const { AppModule } = require('../dist/app.module');
  const { setup } = require('../dist/setup');
  const { DatabaseService } = require('../dist/database/database.service');
  const { OAuthService } = require('../dist/auth/oauth.service');
  app = await NestFactory.create(AppModule, { bodyParser: false, logger: false });
  store = setup(app);
  await app.listen(0, '127.0.0.1');
  db = app.get(DatabaseService);
  oauth = app.get(OAuthService);
  // Mock only provider HTTP boundaries. Real Passport state, PKCE, session,
  // controller, guards, validation, SQL and cookies run unchanged.
  for (const provider of ['google', 'github']) {
    oauth.passport._strategy(provider)._oauth2.getOAuthAccessToken = (code, params, callback) => {
      tokenRequests++;
      assert.equal(createHash('sha256').update(params.code_verifier).digest('base64url'), expectedChallenges.get(code));
      callback(null, code, 'never-persist-this-refresh-token', {});
    };
  }
}

before(async () => {
  if (!database) return;
  admin = new Pool({ connectionString: database });
  await admin.query(`CREATE SCHEMA "${schema}"`);
  const url = new URL(database);
  url.searchParams.set('options', `-c search_path=${schema}`);
  Object.assign(process.env, {
    NODE_ENV: 'test', DATABASE_URL: url.href,
    SESSION_SECRET: 'integration-test-secret-is-at-least-32-characters',
    FRONTEND_URL: origin, API_PUBLIC_URL: `${origin}/api`,
    SESSION_COOKIE_SECURE: 'false', SESSION_COOKIE_SAME_SITE: 'lax', TRUST_PROXY: '0',
    GOOGLE_CLIENT_ID: 'test-google', GOOGLE_CLIENT_SECRET: 'test-google-secret',
    GITHUB_CLIENT_ID: 'test-github', GITHUB_CLIENT_SECRET: 'test-github-secret',
    ADMIN_EMAILS: ' ADMIN@example.test ',
  });
  global.fetch = async (url, options) => {
    const subject = options.headers.Authorization.slice('Bearer '.length);
    if (url === 'https://api.github.com/user/emails') return Response.json([{ email: 'same@example.test', primary: true, verified: true }]);
    assert.ok(['https://openidconnect.googleapis.com/v1/userinfo', 'https://api.github.com/user'].includes(url));
    return Response.json({ sub: subject, id: subject, name: `Student ${subject}`, email: subject.startsWith('admin-') ? 'admin@example.test' : 'same@example.test', email_verified: subject !== 'admin-unverified' });
  };
  await start();
});

after(async () => {
  global.fetch = originalFetch;
  if (store) await store.close();
  if (app) await app.close();
  if (admin) {
    await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
    await admin.end();
  }
});

async function login(provider = 'google', subject = randomUUID(), returnTo) {
  const agent = supertest.agent(app.getHttpServer());
  const begin = await agent.get(`/api/auth/${provider}`).query({ returnTo }).expect(302);
  const redirect = new URL(begin.headers.location);
  assert.equal(redirect.searchParams.get('code_challenge_method'), 'S256');
  assert.equal(redirect.searchParams.get('redirect_uri'), `${origin}/api/auth/${provider}/callback`);
  expectedChallenges.set(subject, redirect.searchParams.get('code_challenge'));
  const callback = await agent.get(`/api/auth/${provider}/callback`).query({ code: subject, state: redirect.searchParams.get('state') }).expect(302);
  assert.notEqual(callback.headers['set-cookie'][0].split(';')[0], begin.headers['set-cookie'][0].split(';')[0]);
  assert.match(callback.headers['set-cookie'][0], /HttpOnly/);
  assert.match(callback.headers['set-cookie'][0], /SameSite=Lax/);
  const { body: { user } } = await agent.get('/api/auth/me').expect(200);
  assert.ok(user?.id);
  return { agent, user, redirect: callback.headers.location, cookie: callback.headers['set-cookie'][0].split(';')[0] };
}
function write(account, path, body, method = 'post') {
  return account.agent[method](`/api/${path}`).set('Origin', origin).set('X-CSRF-Protection', '1').set('X-Account-Id', account.user.id).send(body);
}
function read(account) { return account.agent.get('/api/progress').set('X-Account-Id', account.user.id); }

integration('anonymous users cannot read, modify, or reset progress', async () => {
  const agent = supertest(app.getHttpServer());
  const me = await agent.get('/api/auth/me').expect(200);
  assert.equal(me.body.user, null);
  assert.deepEqual(me.body.providers, { google: true, github: true });
  assert.equal(me.headers['set-cookie'], undefined);
  await agent.get('/api/progress').expect(401);
  await agent.post('/api/auth/welcome').set('Origin', origin).set('X-CSRF-Protection', '1').send({}).expect(401);
  for (const method of ['post', 'delete']) await agent[method](`/api/progress${method === 'post' ? '/exam' : ''}`).set('Origin', origin).set('X-CSRF-Protection', '1').send({ score: 1 }).expect(401);
});

integration('OAuth rejects missing, forged, replayed and expired state without a token exchange', async () => {
  const before = tokenRequests;
  const agent = supertest.agent(app.getHttpServer());
  await agent.get('/api/auth/google/callback?code=forged').expect(302).expect('Location', `${origin}/entrar?error=oauth_failed`);
  const start = await agent.get('/api/auth/google').expect(302);
  const state = new URL(start.headers.location).searchParams.get('state');
  await agent.get('/api/auth/google/callback').query({ code: 'forged', state: 'wrong' }).expect(302).expect('Location', `${origin}/entrar?error=oauth_failed`);
  await agent.get('/api/auth/google/callback').query({ code: 'forged', state }).expect(302).expect('Location', `${origin}/entrar?error=oauth_failed`);
  const expired = supertest.agent(app.getHttpServer());
  const old = await expired.get('/api/auth/github').expect(302);
  await db.pool.query(`UPDATE sessions SET sess = jsonb_set(sess::jsonb, '{oauthStartedAt}', '1')::json WHERE sess::jsonb ? 'oauthStartedAt'`);
  await expired.get('/api/auth/github/callback').query({ code: 'expired', state: new URL(old.headers.location).searchParams.get('state') }).expect(302).expect('Location', `${origin}/entrar?error=oauth_failed`);
  assert.equal(tokenRequests, before);
});

integration('Google and GitHub create separate accounts even with the same verified email; repeat login preserves identity', async () => {
  const a = await login('google', 'stable-google');
  const again = await login('google', 'stable-google');
  const b = await login('github', 'stable-github');
  assert.equal(a.user.id, again.user.id);
  assert.notEqual(a.user.id, b.user.id);
  assert.equal(a.user.email, b.user.email);
  const rows = await db.pool.query('SELECT sess FROM sessions');
  assert.ok(!JSON.stringify(rows.rows).includes('never-persist-this-refresh-token'));
  assert.ok(!JSON.stringify(rows.rows).includes('accessToken'));
});

integration('first and returning logins honor their destination for both providers; optional welcome completion stays durable and isolated', async () => {
  for (const provider of ['google', 'github']) {
    const subject = randomUUID();
    const first = await login(provider, subject, '/aprender/containers/dockerfile');
    assert.equal(first.redirect, `${origin}/aprender/containers/dockerfile`);
    assert.equal(first.user.welcomeCompleted, false);
    const interrupted = await login(provider, subject);
    assert.equal(interrupted.redirect, `${origin}/trilha`);
    const another = await login(provider);
    await first.agent.post('/api/auth/welcome').set('Origin', origin).set('X-CSRF-Protection', '1').set('X-Account-Id', another.user.id).send({}).expect(409);
    const completed = await write(first, 'auth/welcome', {}).expect(200);
    assert.equal(completed.body.welcomeCompleted, true);
    assert.equal(completed.body.id, first.user.id);
    assert.equal((await another.agent.get('/api/auth/me')).body.user.welcomeCompleted, false);
    const timestamp = (await db.pool.query('SELECT welcome_completed_at FROM users WHERE id = $1', [first.user.id])).rows[0].welcome_completed_at;
    await write(first, 'auth/welcome', {}).expect(200);
    assert.deepEqual((await db.pool.query('SELECT welcome_completed_at FROM users WHERE id = $1', [first.user.id])).rows[0].welcome_completed_at, timestamp);
    const returning = await login(provider, subject, '/trilha');
    assert.equal(returning.redirect, `${origin}/trilha`);
    assert.equal(returning.user.welcomeCompleted, true);
    await write(first, 'progress', undefined, 'delete').expect(200);
    assert.equal((await first.agent.get('/api/auth/me')).body.user.welcomeCompleted, true);
  }
});

integration('OAuth preserves the requested page, query and fragment for new and returning users', async () => {
  for (const provider of ['google', 'github']) {
    for (const target of ['/', '/prova?modo=treino#iniciar', '/aprender/containers/dockerfile?tab=quiz#perguntas', '/casos/crashloop-config#diagnostico', '/admin/usuarios?page=2&q=Ana%20Silva', '/boas-vindas']) {
      const subject = randomUUID();
      const first = await login(provider, subject, target);
      assert.equal(first.redirect, `${origin}${target}`);
      const next = await login(provider, subject, target);
      assert.equal(next.redirect, `${origin}${target}`);
    }
  }
});

integration('missing, external and login-loop destinations fall back to the trail', async () => {
  for (const target of [undefined, '', '//evil.example', '/\\evil.example', 'https://evil.example', 'javascript:alert(1)', 'prova', '/entrar?returnTo=/prova', '/x/../entrar', '/%65ntrar', '/%2f%2fevil.example', '/%5cevil.example', '/\n/evil.example', ['//evil.example', '/prova']]) {
    const account = await login('google', randomUUID(), target);
    assert.equal(account.redirect, `${origin}/trilha`);
  }
});

integration('OAuth uses the destination stored in the session instead of callback query parameters', async () => {
  const agent = supertest.agent(app.getHttpServer());
  const target = '/prova?modo=treino#iniciar';
  const begin = await agent.get('/api/auth/google').query({ returnTo: target }).expect(302);
  const redirect = new URL(begin.headers.location);
  const subject = randomUUID();
  expectedChallenges.set(subject, redirect.searchParams.get('code_challenge'));
  await agent.get('/api/auth/google/callback').query({ code: subject, state: redirect.searchParams.get('state'), returnTo: 'https://evil.example' }).expect(302).expect('Location', `${origin}${target}`);
});

integration('a canceled OAuth login preserves its destination when the user retries', async () => {
  for (const provider of ['google', 'github']) {
    const agent = supertest.agent(app.getHttpServer());
    const target = '/aprender/containers/dockerfile?tab=quiz#perguntas';
    const begin = await agent.get(`/api/auth/${provider}`).query({ returnTo: target }).expect(302);
    const failure = await agent.get(`/api/auth/${provider}/callback`).query({ error: 'access_denied', state: new URL(begin.headers.location).searchParams.get('state') }).expect(302);
    const retry = new URL(failure.headers.location);
    assert.equal(retry.origin, origin);
    assert.equal(retry.pathname, '/entrar');
    assert.equal(retry.searchParams.get('error'), 'oauth_failed');
    assert.equal(retry.searchParams.get('returnTo'), target);
    const restart = await agent.get(`/api/auth/${provider}`).query({ returnTo: retry.searchParams.get('returnTo') }).expect(302);
    const redirect = new URL(restart.headers.location);
    const subject = randomUUID();
    expectedChallenges.set(subject, redirect.searchParams.get('code_challenge'));
    await agent.get(`/api/auth/${provider}/callback`).query({ code: subject, state: redirect.searchParams.get('state') }).expect(302).expect('Location', `${origin}${target}`);
  }
});

integration('progress belongs only to the session owner, survives login and preserves best scores and first diagnoses', async () => {
  const a = await login('google', 'progress-owner');
  const b = await login('github');
  await write(a, 'progress/quiz', { lessonKey: 'containers/dockerfile', score: 0.8 }).expect(200);
  const best = await write(a, 'progress/quiz', { lessonKey: 'containers/dockerfile', score: 0.2 }).expect(200);
  assert.equal(best.body.quizzes['containers/dockerfile'], 0.8);
  assert.ok(best.body.completed['containers/dockerfile']);
  await write(a, 'progress/exam', { score: 0.9 }).expect(200);
  assert.equal((await write(a, 'progress/exam', { score: 0.3 }).expect(200)).body.examBest, 0.9);
  await write(a, 'progress/case', { slug: 'imagepullbackoff', correct: false }).expect(200);
  const first = await write(a, 'progress/case', { slug: 'imagepullbackoff', correct: true }).expect(200);
  assert.equal(first.body.cases.imagepullbackoff.correct, false);
  assert.deepEqual((await read(b).expect(200)).body.quizzes, {});
  await a.agent.get('/api/progress').set('X-Account-Id', b.user.id).expect(409);
  await a.agent.post('/api/progress/exam').set('Origin', origin).set('X-CSRF-Protection', '1').set('X-Account-Id', b.user.id).send({ score: 1 }).expect(409);
  await write(a, 'progress/exam', { score: 1, userId: b.user.id }).expect(400);
  const again = await login('google', 'progress-owner');
  assert.equal((await read(again).expect(200)).body.examBest, 0.9);
  await write(b, 'progress/exam', { score: 0.6 }).expect(200);
  await write(a, 'progress', undefined, 'delete').expect(200);
  assert.deepEqual((await read(a).expect(200)).body, { quizzes: {}, completed: {}, cases: {} });
  assert.equal((await read(b).expect(200)).body.examBest, 0.6);
});

integration('validation and CSRF protection reject malformed and cross-origin writes', async () => {
  const a = await login();
  for (const body of [{ score: 1.1 }, { score: -1 }, { score: '1' }, {}, { score: 1, completed: {} }]) await write(a, 'progress/exam', body).expect(400);
  await write(a, 'progress/quiz', { lessonKey: '__proto__', score: 1 }).expect(400);
  await write(a, 'progress/case', { slug: 'test', correct: 'true' }).expect(400);
  await a.agent.post('/api/progress/exam').set('X-Account-Id', a.user.id).send({ score: 1 }).expect(403);
  await a.agent.post('/api/progress/exam').set('Origin', 'https://evil.example').set('X-CSRF-Protection', '1').set('X-Account-Id', a.user.id).send({ score: 1 }).expect(403);
  assert.equal((await read(a).expect(200)).body.examBest, undefined);
});

integration('concurrent writes keep all lesson results', async () => {
  const a = await login();
  await Promise.all(Array.from({ length: 12 }, (_, index) => write(a, 'progress/quiz', { lessonKey: `modulo/licao-${index}`, score: 0.8 }).expect(200)));
  assert.equal(Object.keys((await read(a).expect(200)).body.quizzes).length, 12);
});

integration('certificates require an authenticated account with a saved passing exam score', async () => {
  const anonymous = supertest(app.getHttpServer());
  await anonymous.get('/api/certificate').expect(401);
  await anonymous.post('/api/certificate').set('Origin', origin).set('X-CSRF-Protection', '1').send({ fullName: 'Ana Silva' }).expect(401);
  const a = await login();
  assert.deepEqual((await a.agent.get('/api/certificate').set('X-Account-Id', a.user.id).expect(200)).body, { certificate: null });
  await write(a, 'certificate', { fullName: 'Ana Silva' }).expect(403);
  await write(a, 'progress/exam', { score: 0.69 }).expect(200);
  await write(a, 'certificate', { fullName: 'Ana Silva' }).expect(403);
  await write(a, 'certificate', { fullName: 'Ana Silva', examScore: 1, userId: a.user.id }).expect(400);
  await write(a, 'progress/exam', { score: 0.7 }).expect(200);
  const issued = (await write(a, 'certificate', { fullName: 'Ana Silva' }).expect(200)).body;
  assert.equal(issued.examScore, 0.7);
  assert.equal(issued.fullName, 'Ana Silva');
  assert.match(issued.id, /^[a-f0-9-]{36}$/);
  assert.ok(Number.isFinite(Date.parse(issued.issuedAt)));
  const b = await login('github');
  await a.agent.get('/api/certificate').set('X-Account-Id', b.user.id).expect(409);
  await a.agent.post('/api/certificate').set('Origin', origin).set('X-CSRF-Protection', '1').set('X-Account-Id', b.user.id).send({ fullName: 'Ana Silva' }).expect(409);
  assert.equal((await b.agent.get('/api/certificate').set('X-Account-Id', b.user.id).expect(200)).body.certificate, null);
  await a.agent.post('/api/certificate').set('X-Account-Id', a.user.id).send({ fullName: 'Ana Silva' }).expect(403);
});

integration('certificate names are validated and normalized; concurrent retries issue only once', async () => {
  const a = await login();
  await write(a, 'progress/exam', { score: 0.9 }).expect(200);
  for (const fullName of ['', '  ', 'A', '1234', '<script>ana</script>', 'A'.repeat(121), 'Ana\u0000Silva', null]) {
    await write(a, 'certificate', { fullName }).expect(400);
  }
  const responses = await Promise.all(Array.from({ length: 4 }, () => write(a, 'certificate', { fullName: '  Jose\u0301   D’Ávila-Santos  ' }).expect(200)));
  const issued = responses[0].body;
  assert.equal(issued.fullName, 'José D’Ávila-Santos');
  for (const response of responses) assert.deepEqual(response.body, issued);
  assert.deepEqual((await write(a, 'certificate', { fullName: 'Outro Nome' }).expect(200)).body, issued);
  assert.equal((await db.pool.query('SELECT count(*)::int AS total FROM certificates WHERE user_id = $1', [a.user.id])).rows[0].total, 1);
});

integration('public verification confirms only issued certificate data without login', async () => {
  const owner = await login();
  await write(owner, 'progress/exam', { score: 0.8 }).expect(200);
  const issued = (await write(owner, 'certificate', { fullName: 'Ana Maria dos Santos' }).expect(200)).body;
  assert.equal(issued.verificationUrl, `${origin}/certificados/${issued.id}`);
  const anonymous = supertest(app.getHttpServer());
  const verified = await anonymous.get(`/api/certificates/${issued.id}`)
    .set('Host', 'untrusted.example').set('X-Forwarded-Host', 'untrusted.example')
    .query({ fullName: 'Forged name', examScore: 1 }).expect(200);
  assert.deepEqual(verified.body, issued);
  assert.deepEqual(Object.keys(verified.body).sort(), ['examScore', 'fullName', 'id', 'issuedAt', 'verificationUrl']);
  assert.equal(verified.headers['set-cookie'], undefined);
  assert.equal(verified.headers['cache-control'], 'no-store');
  assert.equal(verified.headers['x-robots-tag'], 'noindex, nofollow');
  await anonymous.get('/api/certificate').expect(401);
  await anonymous.post(`/api/certificates/${issued.id}`).set('Origin', origin).set('X-CSRF-Protection', '1').send({ fullName: 'Forged name' }).expect(404);
  await write(owner, 'certificate', { fullName: 'Ana Maria dos Santos', verificationUrl: 'https://untrusted.example' }).expect(400);
});

integration('verification rejects missing and malformed identifiers without listing certificates', async () => {
  const anonymous = supertest(app.getHttpServer());
  await anonymous.get('/api/certificates').expect(404);
  await anonymous.get(`/api/certificates/${randomUUID()}`).expect(404);
  await anonymous.get('/api/certificates/PREVIA-NOTA-ILUSTRATIVA').expect(400);
  await anonymous.get('/api/certificates/not-a-uuid').expect(400);
});

integration('issued certificates survive new logins and later progress resets', async () => {
  const subject = randomUUID();
  const a = await login('google', subject);
  await write(a, 'progress/exam', { score: 0.8 }).expect(200);
  const issued = (await write(a, 'certificate', { fullName: 'Leonardo dos Reis' }).expect(200)).body;
  await write(a, 'progress', undefined, 'delete').expect(200);
  const again = await login('google', subject);
  const restored = await again.agent.get('/api/certificate').set('X-Account-Id', again.user.id).expect(200);
  assert.deepEqual(restored.body.certificate, issued);
  assert.deepEqual((await supertest(app.getHttpServer()).get(`/api/certificates/${issued.id}`).expect(200)).body, issued);
  assert.deepEqual((await write(again, 'certificate', { fullName: 'Leonardo dos Reis' }).expect(200)).body, issued);
});

integration('admin endpoints require a verified allowlisted identity and matching session account', async () => {
  const staff = await login('google', 'admin-access');
  assert.equal(staff.user.isAdmin, true);
  const student = await login();
  assert.equal(student.user.isAdmin, false);
  const unverified = await login('google', 'admin-unverified');
  assert.equal(unverified.user.isAdmin, false);
  for (const path of ['admin/overview', 'admin/users', `admin/users/${student.user.id}`, `admin/users/${student.user.id}/activity`]) {
    await supertest(app.getHttpServer()).get(`/api/${path}`).expect(401);
    await student.agent.get(`/api/${path}`).set('X-Account-Id', student.user.id).set('X-Admin', 'true').expect(403);
    await unverified.agent.get(`/api/${path}`).set('X-Account-Id', unverified.user.id).expect(403);
    await staff.agent.get(`/api/${path}`).set('X-Account-Id', staff.user.id).expect(200);
  }
  await student.agent.get('/api/admin/overview').set('X-Account-Id', staff.user.id).expect(409);
  const config = app.get(require('../dist/config').AppConfig);
  config.adminEmails.clear();
  try {
    await staff.agent.get('/api/admin/overview').set('X-Account-Id', staff.user.id).expect(403);
    assert.equal((await staff.agent.get('/api/auth/me').expect(200)).body.user.isAdmin, false);
  } finally { config.adminEmails.add('admin@example.test'); }
});

integration('admin metrics count real catalog completion, include legacy results and paginate filtered users', async () => {
  const staff = await login('google', 'admin-metrics');
  const get = path => staff.agent.get(`/api/${path}`).set('X-Account-Id', staff.user.id);
  const baseline = (await get('admin/overview').expect(200)).body;
  const { learningCatalog } = require('@jack-academy/contracts');
  const keys = learningCatalog.modules.flatMap(module => module.lessons.map(lesson => lesson.key));
  const prefix = `Analytics-${randomUUID()}`;
  const accounts = [];
  for (const label of ['fresh', 'reader', 'finished', 'certified']) {
    const account = await login();
    await db.pool.query('UPDATE users SET name = $2 WHERE id = $1', [account.user.id, `${prefix}-${label}`]);
    accounts.push(account);
  }
  const [fresh, reader, finished, certified] = accounts;
  await write(fresh, 'auth/welcome', {}).expect(200);
  const eventId = randomUUID();
  for (let retry = 0; retry < 2; retry++) await write(reader, 'activity', { kind: 'lesson_opened', target: keys[0], eventId }).expect(204);
  const legacy = { quizzes: Object.fromEntries(keys.map(key => [key, .8])), completed: Object.fromEntries(keys.map(key => [key, new Date().toISOString()])), cases: {} };
  legacy.completed['unknown/lesson'] = new Date().toISOString();
  await db.pool.query('INSERT INTO user_progress (user_id, data) VALUES ($1, $2)', [finished.user.id, legacy]);
  await write(certified, 'progress/exam', { score: .8 }).expect(200);
  const certificate = (await write(certified, 'certificate', { fullName: 'Estudante Certificado' }).expect(200)).body;
  const overview = (await get('admin/overview').expect(200)).body;
  assert.equal(overview.registered, baseline.registered + 4);
  assert.equal(overview.started, baseline.started + 3);
  assert.equal(overview.completed, baseline.completed + 1);
  assert.equal(overview.certified, baseline.certified + 1);
  assert.equal(overview.examPassed, baseline.examPassed + 1);
  assert.equal(overview.totalLessons, keys.length);
  assert.equal(overview.registrations.length, 30);
  assert.ok(Number.isFinite(Date.parse(overview.trackingSince)));
  for (const [stage, total] of Object.entries({ all: 4, not_started: 1, started: 3, completed: 1, certified: 1 })) {
    const response = await get('admin/users').query({ q: prefix, stage, pageSize: 2 }).expect(200);
    assert.equal(response.body.total, total);
    assert.ok(response.body.users.length <= 2);
  }
  const first = (await get('admin/users').query({ q: prefix, pageSize: 2, page: 1 }).expect(200)).body;
  const second = (await get('admin/users').query({ q: prefix, pageSize: 2, page: 2 }).expect(200)).body;
  assert.equal(new Set([...first.users, ...second.users].map(user => user.id)).size, 4);
  const history = (await get(`admin/users/${reader.user.id}/activity`).expect(200)).body;
  assert.equal(history.total, 1);
  assert.equal(history.events[0].kind, 'lesson_opened');
  assert.equal(history.events[0].sort_id, undefined);
  const detail = (await get(`admin/users/${reader.user.id}`).expect(200)).body;
  assert.equal(detail.visits.lessons, 1);
  assert.equal(detail.user.completedLessons, 0);
  const completed = (await get(`admin/users/${finished.user.id}`).expect(200)).body;
  assert.equal(completed.user.completed, true);
  assert.equal(completed.user.completedLessons, keys.length);
  assert.equal((await get(`admin/users/${finished.user.id}/activity`).expect(200)).body.total, 0);
  const document = (await get(`admin/users/${certified.user.id}`).expect(200)).body;
  assert.equal(document.user.completed, false);
  assert.deepEqual(document.certificate, certificate);
  assert.equal((await get('admin/users').query({ q: "%' OR 1=1 --" }).expect(200)).body.total, 0);
  assert.equal((await get('admin/users').query({ q: '%' }).expect(200)).body.total, 0);
});

integration('activity records results transactionally, deduplicates retries and keeps history after reset', async () => {
  const staff = await login('google', 'admin-history');
  const student = await login();
  const { learningCatalog } = require('@jack-academy/contracts');
  const key = learningCatalog.modules[0].lessons[0].key;
  const eventId = randomUUID();
  await write(student, 'progress/quiz', { lessonKey: key, score: .4, eventId }).expect(200);
  await write(student, 'progress/quiz', { lessonKey: key, score: .4, eventId }).expect(200);
  await write(student, 'progress/quiz', { lessonKey: key, score: .9, eventId: randomUUID() }).expect(200);
  await write(student, 'progress/exam', { score: .9, eventId: randomUUID() }).expect(200);
  await write(student, 'certificate', { fullName: 'Estudante Teste' }).expect(200);
  await write(student, 'certificate', { fullName: 'Estudante Teste' }).expect(200);
  const get = path => staff.agent.get(`/api/${path}`).set('X-Account-Id', staff.user.id);
  const history = (await get(`admin/users/${student.user.id}/activity`).expect(200)).body;
  assert.equal(history.total, 4);
  assert.deepEqual(history.events.filter(event => event.kind === 'quiz_submitted').map(event => event.score), [.9, .4]);
  assert.equal(history.events.filter(event => event.kind === 'certificate_issued').length, 1);
  assert.equal((await get(`admin/users/${student.user.id}/activity`).query({ pageSize: 2, page: 2 }).expect(200)).body.events.length, 2);
  await write(student, 'progress', undefined, 'delete').expect(200);
  const detail = (await get(`admin/users/${student.user.id}`).expect(200)).body;
  assert.equal(detail.user.started, true);
  assert.equal(detail.user.completedLessons, 0);
  assert.ok(detail.certificate);
  assert.equal((await get(`admin/users/${student.user.id}/activity`).expect(200)).body.total, 5);
});

integration('admin queries and activity inputs are validated and cannot target another account', async () => {
  const staff = await login('google', 'admin-validation');
  const student = await login();
  const get = path => staff.agent.get(`/api/${path}`).set('X-Account-Id', staff.user.id);
  for (const query of [{ page: 0 }, { page: 'abc' }, { pageSize: 101 }, { stage: 'root' }, { q: 'a'.repeat(121) }]) await get('admin/users').query(query).expect(400);
  await get('admin/users/not-a-uuid').expect(400);
  await get(`admin/users/${randomUUID()}`).expect(404);
  await get(`admin/users/${randomUUID()}/activity`).expect(404);
  const { learningCatalog } = require('@jack-academy/contracts');
  const visit = { kind: 'lesson_opened', target: learningCatalog.modules[0].lessons[0].key, eventId: randomUUID() };
  await write(student, 'activity', { ...visit, userId: staff.user.id }).expect(400);
  await write(student, 'activity', { ...visit, kind: 'certificate_issued' }).expect(400);
  await write(student, 'activity', { ...visit, target: 'fake/content' }).expect(400);
  await write(student, 'activity', { ...visit, eventId: 'fake' }).expect(400);
  await student.agent.post('/api/activity').set('X-Account-Id', student.user.id).send(visit).expect(403);
  await student.agent.post('/api/activity').set('Origin', origin).set('X-CSRF-Protection', '1').set('X-Account-Id', staff.user.id).send(visit).expect(409);
  await supertest(app.getHttpServer()).post('/api/activity').set('Origin', origin).set('X-CSRF-Protection', '1').send(visit).expect(401);
});

integration('account deletion requires the owner session, CSRF protection and explicit confirmation', async () => {
  const owner = await login();
  const other = await login();
  const body = { confirmation: 'EXCLUIR' };
  await supertest(app.getHttpServer()).delete('/api/auth/account').set('Origin', origin).set('X-CSRF-Protection', '1').send(body).expect(401);
  await owner.agent.delete('/api/auth/account').set('X-Account-Id', owner.user.id).send(body).expect(403);
  await owner.agent.delete('/api/auth/account').set('Origin', 'https://untrusted.example').set('X-CSRF-Protection', '1').set('X-Account-Id', owner.user.id).send(body).expect(403);
  await owner.agent.delete('/api/auth/account').set('Origin', origin).set('X-CSRF-Protection', '1').set('X-Account-Id', other.user.id).send(body).expect(409);
  for (const invalid of [{}, { confirmation: 'excluir' }, { confirmation: true }, { ...body, userId: other.user.id }]) {
    await write(owner, 'auth/account', invalid, 'delete').expect(400);
  }
  assert.equal((await owner.agent.get('/api/auth/me').expect(200)).body.user.id, owner.user.id);
  assert.equal((await other.agent.get('/api/auth/me').expect(200)).body.user.id, other.user.id);
});

integration('account deletion erases owned data and all sessions without affecting another provider account', async () => {
  const subject = randomUUID();
  const owner = await login('google', subject);
  const secondSession = await login('google', subject);
  const other = await login('github', subject);
  const staff = await login('google', 'admin-account-deletion');
  await write(owner, 'progress/exam', { score: .9 }).expect(200);
  await write(owner, 'progress/quiz', { lessonKey: 'containers/o-que-sao-containers', score: .8 }).expect(200);
  const certificate = (await write(owner, 'certificate', { fullName: 'Pessoa de Teste' }).expect(200)).body;
  await write(other, 'progress/exam', { score: .75 }).expect(200);
  const preservedCertificate = (await write(other, 'certificate', { fullName: 'Outra Pessoa' }).expect(200)).body;
  assert.equal(Number((await db.pool.query("SELECT count(*) FROM sessions WHERE sess->>'userId' = $1", [owner.user.id])).rows[0].count), 2);
  const before = (await staff.agent.get('/api/admin/overview').set('X-Account-Id', staff.user.id).expect(200)).body;
  const removed = await write(owner, 'auth/account', { confirmation: 'EXCLUIR' }, 'delete').expect(204);
  assert.match(removed.headers['set-cookie'].join(';'), /kubenautas\.sid=;/);
  for (const [table,column] of [['users','id'],['user_progress','user_id'],['user_activity','user_id'],['certificates','user_id']]) {
    assert.equal((await db.pool.query(`SELECT 1 FROM ${table} WHERE ${column} = $1`, [owner.user.id])).rowCount, 0, table);
  }
  assert.equal((await db.pool.query("SELECT 1 FROM sessions WHERE sess->>'userId' = $1", [owner.user.id])).rowCount, 0);
  for (const cookie of [owner.cookie, secondSession.cookie]) {
    const api = supertest(app.getHttpServer());
    assert.equal((await api.get('/api/auth/me').set('Cookie', cookie).expect(200)).body.user, null);
    await api.get('/api/progress').set('Cookie', cookie).set('X-Account-Id', owner.user.id).expect(401);
    await api.post('/api/progress/exam').set('Cookie', cookie).set('X-Account-Id', owner.user.id).set('Origin', origin).set('X-CSRF-Protection', '1').send({ score: 1 }).expect(401);
  }
  await supertest(app.getHttpServer()).get(`/api/certificates/${certificate.id}`).expect(404);
  await staff.agent.get(`/api/admin/users/${owner.user.id}`).set('X-Account-Id', staff.user.id).expect(404);
  const after = (await staff.agent.get('/api/admin/overview').set('X-Account-Id', staff.user.id).expect(200)).body;
  assert.equal(after.registered, before.registered - 1);
  assert.equal(after.certified, before.certified - 1);
  assert.equal((await read(other).expect(200)).body.examBest, .75);
  assert.deepEqual((await supertest(app.getHttpServer()).get(`/api/certificates/${preservedCertificate.id}`).expect(200)).body, preservedCertificate);
  const recreated = await login('google', subject);
  assert.notEqual(recreated.user.id, owner.user.id);
  assert.equal(recreated.user.welcomeCompleted, false);
  assert.deepEqual((await read(recreated).expect(200)).body, { quizzes: {}, completed: {}, cases: {} });
  assert.equal((await recreated.agent.get('/api/certificate').set('X-Account-Id', recreated.user.id).expect(200)).body.certificate, null);
});

integration('a failed account deletion rolls back profile, learning data, certificates and sessions together', async () => {
  const owner = await login();
  await write(owner, 'progress/exam', { score: .85 }).expect(200);
  const certificate = (await write(owner, 'certificate', { fullName: 'Pessoa de Teste' }).expect(200)).body;
  const eventsBefore = (await db.pool.query('SELECT count(*) FROM user_activity WHERE user_id = $1', [owner.user.id])).rows[0].count;
  await db.pool.query(`CREATE FUNCTION reject_test_session_delete() RETURNS trigger LANGUAGE plpgsql AS $$
    BEGIN IF OLD.sess->>'userId' = '${owner.user.id}' THEN RAISE EXCEPTION 'Simulated session removal failure'; END IF; RETURN OLD; END $$;
    CREATE TRIGGER reject_test_session_delete BEFORE DELETE ON sessions FOR EACH ROW EXECUTE FUNCTION reject_test_session_delete()`);
  try {
    await write(owner, 'auth/account', { confirmation: 'EXCLUIR' }, 'delete').expect(500);
    assert.equal((await owner.agent.get('/api/auth/me').expect(200)).body.user.id, owner.user.id);
    assert.equal((await read(owner).expect(200)).body.examBest, .85);
    assert.equal((await db.pool.query('SELECT count(*) FROM user_activity WHERE user_id = $1', [owner.user.id])).rows[0].count, eventsBefore);
    assert.deepEqual((await supertest(app.getHttpServer()).get(`/api/certificates/${certificate.id}`).expect(200)).body, certificate);
  } finally {
    await db.pool.query('DROP TRIGGER reject_test_session_delete ON sessions; DROP FUNCTION reject_test_session_delete()');
  }
  await write(owner, 'auth/account', { confirmation: 'EXCLUIR' }, 'delete').expect(204);
});

integration('sessions, progress and certificates survive API restart; logout revokes the old cookie', async () => {
  const a = await login();
  await write(a, 'progress/exam', { score: 0.75 }).expect(200);
  const certificate = (await write(a, 'certificate', { fullName: 'Alice dos Santos' }).expect(200)).body;
  await write(a, 'auth/welcome', {}).expect(200);
  await store.close();
  await app.close();
  await start();
  const api = supertest(app.getHttpServer());
  const restored = (await api.get('/api/auth/me').set('Cookie', a.cookie).expect(200)).body.user;
  assert.equal(restored.id, a.user.id);
  assert.equal(restored.welcomeCompleted, true);
  assert.equal((await api.get('/api/progress').set('Cookie', a.cookie).set('X-Account-Id', a.user.id).expect(200)).body.examBest, 0.75);
  assert.deepEqual((await api.get('/api/certificate').set('Cookie', a.cookie).set('X-Account-Id', a.user.id).expect(200)).body.certificate, certificate);
  assert.deepEqual((await api.get(`/api/certificates/${certificate.id}`).expect(200)).body, certificate);
  await api.post('/api/auth/logout').set('Cookie', a.cookie).set('Origin', origin).set('X-CSRF-Protection', '1').set('X-Account-Id', a.user.id).expect(204);
  assert.equal((await api.get('/api/auth/me').set('Cookie', a.cookie).expect(200)).body.user, null);
  await api.get('/api/progress').set('Cookie', a.cookie).set('X-Account-Id', a.user.id).expect(401);
});

if (!database) test('integration setup', (t) => { t.diagnostic('Set TEST_DATABASE_URL to run OAuth, sessions and PostgreSQL isolation tests.'); });
