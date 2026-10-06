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