import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';
import { PrismaService } from '../src/prisma/prisma.service.js';

describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  const email = `user-${Date.now()}@e2e.test`;
  const password = 'password123';

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: '@e2e.test' } } });
    await app.close();
  });

  it('registers a user and returns a token', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({ email, password });
    expect(res.status).toBe(201);
    expect(res.body.accessToken).toBeDefined();
  });

  it('rejects a duplicate email', async () => {
    const res = await request(app.getHttpServer()).post('/auth/register').send({ email, password });
    expect(res.status).toBe(409);
  });

  it('rejects an invalid email or short password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/register')
      .send({ email: 'nope', password: '123' });
    expect(res.status).toBe(400);
  });

  it('rejects a wrong password', async () => {
    const res = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email, password: 'wrong-password' });
    expect(res.status).toBe(401);
  });

  it('logs in and accesses /auth/me with the token', async () => {
    const login = await request(app.getHttpServer()).post('/auth/login').send({ email, password });
    expect(login.status).toBe(200);
    const me = await request(app.getHttpServer())
      .get('/auth/me')
      .set('Authorization', `Bearer ${login.body.accessToken}`);
    expect(me.status).toBe(200);
    expect(me.body.email).toBe(email);
  });

  it('blocks /auth/me without a token', async () => {
    const res = await request(app.getHttpServer()).get('/auth/me');
    expect(res.status).toBe(401);
  });
});

describe('Boards & Columns (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tokenA: string;
  let tokenB: string;
  let boardId: string;
  let columnId: string;
  const stamp = Date.now();
  const password = 'password123';

  const http = () => request(app.getHttpServer());
  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const register = async (name: string) => {
    const res = await http()
      .post('/auth/register')
      .send({ email: `${name}-${stamp}@boards.e2e.test`, password });
    return res.body.accessToken as string;
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
    );
    await app.init();
    prisma = app.get(PrismaService);
    tokenA = await register('a');
    tokenB = await register('b');
  });

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { endsWith: '@boards.e2e.test' } } });
    await app.close();
  });

  it('requires authentication', async () => {
    expect((await http().get('/boards')).status).toBe(401);
  });

  it('creates a board with 3 default columns', async () => {
    const res = await http().post('/boards').set(auth(tokenA)).send({ title: 'Sprint' });
    expect(res.status).toBe(201);
    expect(res.body.columns.map((c: { title: string }) => c.title)).toEqual([
      'To Do', 'Doing', 'Done',
    ]);
    boardId = res.body.id;
  });

  it('rejects an empty board title', async () => {
    const res = await http().post('/boards').set(auth(tokenA)).send({ title: '   ' });
    expect(res.status).toBe(400);
  });

  it('lists only the current user boards', async () => {
    const a = await http().get('/boards').set(auth(tokenA));
    const b = await http().get('/boards').set(auth(tokenB));
    expect(a.body).toHaveLength(1);
    expect(a.body[0].id).toBe(boardId);
    expect(b.body).toHaveLength(0);
  });

  it('returns a board with its columns and tasks', async () => {
    const res = await http().get(`/boards/${boardId}`).set(auth(tokenA));
    expect(res.status).toBe(200);
    expect(res.body.columns).toHaveLength(3);
    expect(res.body.columns[0].tasks).toEqual([]);
  });

  it("hides another user's board (404 on get, patch, delete)", async () => {
    expect((await http().get(`/boards/${boardId}`).set(auth(tokenB))).status).toBe(404);
    expect(
      (await http().patch(`/boards/${boardId}`).set(auth(tokenB)).send({ title: 'x' })).status,
    ).toBe(404);
    expect((await http().delete(`/boards/${boardId}`).set(auth(tokenB))).status).toBe(404);
  });

  it('returns 400 for a malformed id', async () => {
    expect((await http().get('/boards/not-a-uuid').set(auth(tokenA))).status).toBe(400);
  });

  it('renames a board', async () => {
    const res = await http().patch(`/boards/${boardId}`).set(auth(tokenA)).send({ title: 'Renamed' });
    expect(res.status).toBe(200);
    expect(res.body.title).toBe('Renamed');
  });

  it('adds a column at the end', async () => {
    const res = await http()
      .post(`/boards/${boardId}/columns`)
      .set(auth(tokenA))
      .send({ title: 'Review' });
    expect(res.status).toBe(201);
    expect(res.body.position).toBe(3);
    columnId = res.body.id;
  });

  it("blocks another user from changing the column", async () => {
    const patch = await http().patch(`/columns/${columnId}`).set(auth(tokenB)).send({ title: 'x' });
    expect(patch.status).toBe(404);
    expect((await http().delete(`/columns/${columnId}`).set(auth(tokenB))).status).toBe(404);
    expect(
      (await http().post(`/boards/${boardId}/columns`).set(auth(tokenB)).send({ title: 'x' })).status,
    ).toBe(404);
  });

  it('lets the owner update and delete a column', async () => {
    const patch = await http().patch(`/columns/${columnId}`).set(auth(tokenA)).send({ title: 'QA' });
    expect(patch.status).toBe(200);
    expect(patch.body.title).toBe('QA');
    expect((await http().delete(`/columns/${columnId}`).set(auth(tokenA))).status).toBe(204);
  });

  it('deletes a board and then returns 404', async () => {
    expect((await http().delete(`/boards/${boardId}`).set(auth(tokenA))).status).toBe(204);
    expect((await http().get(`/boards/${boardId}`).set(auth(tokenA))).status).toBe(404);
  });
});