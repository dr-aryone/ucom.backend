const request = require('supertest');
const server = require('../../../app');
const UsersHelper = require('./../helpers/users-helper');
const SeedsHelper = require('./../helpers/seeds-helper');
const UsersRepository = require('../../../lib/users/users-repository');
const RequestHelper = require('../helpers/request-helper');
const ResponseHelper = require('../helpers/response-helper');

const userVlad = UsersHelper.getUserVladSeed();
const userJane = UsersHelper.getUserJaneSeed();

describe('Users API', () => {
  beforeEach(async () => {
    await SeedsHelper.initSeeds();
  });

  afterAll(async () => {
    await SeedsHelper.sequelizeAfterAll();
  });

  describe('User stats', () => {
    it('User rate must be normalized', async () => {
      const expectedRate = await UsersHelper.setSampleRateToUserVlad();

      const user = await UsersHelper.requestUserById(userVlad.id);

      expect(user.current_rate).toBe(expectedRate);
    });
  });

  it('GET user by ID without auth', async () => {

    const res = await request(server)
      .get(`/api/v1/users/${userVlad.id}`)
    ;

    const body = res.body;

    expect(res.status).toBe(200);

    expect(typeof body).toBe('object');

    const user = await UsersRepository.getUserById(userVlad.id);

    UsersHelper.validateUserJson(body, userVlad, user);
  });

  it('GET 404 if there is no user with ID', async () => {
    const res = await request(server)
      .get(`/api/v1/users/1000`)
    ;

    expect(res.status).toBe(404);
  });
});