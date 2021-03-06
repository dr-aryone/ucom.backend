import { UserModel } from '../../lib/users/interfaces/model-interfaces';

import RequestHelper = require('../integration/helpers/request-helper');
import ResponseHelper = require('../integration/helpers/response-helper');

const request = require('supertest');
const faker   = require('faker');

const server          = RequestHelper.getApiApplication();

class OrganizationsGenerator {
  public static async changeDiscussionsState(
    myself: UserModel,
    orgId: number,
    postsIds: number[],
    expectedStatus: number = 200,
  ): Promise<void> {
    const url = RequestHelper.getOrganizationsDiscussionUrl(orgId);

    const req = request(server)
      .post(url)
    ;

    for (let i = 0; i < postsIds.length; i += 1) {
      const field = `discussions[${i}][id]`;
      req.field(field, postsIds[i]);
    }

    RequestHelper.addAuthToken(req, myself);

    const res = await req;

    ResponseHelper.expectStatusToBe(res, expectedStatus);

    return res;
  }

  public static async deleteAllDiscussions(
    myself: UserModel,
    orgId: number,
  ): Promise<void> {
    const url = RequestHelper.getOrganizationsDiscussionUrl(orgId);

    const req = request(server)
      .delete(url)
    ;

    RequestHelper.addAuthToken(req, myself);

    const res = await req;

    ResponseHelper.expectStatusToBe(res, 204);
  }

  /**
   *
   * @param {Object} author
   * @param {Object[]} teamMembers
   * @param {number} mul
   * @return {Promise<void>}
   */
  public static async createManyOrgWithSameTeam(author, teamMembers, mul = 1) {
    for (let i = 0; i < mul; i += 1) {
      await this.createOrgWithTeam(author, teamMembers);
    }
  }

  public static async createManyOrgWithoutTeam(
    author: UserModel,
    amount: number,
  ): Promise<number[]> {
    const promises: Promise<any>[] = [];
    for (let i = 0; i < amount; i += 1) {
      promises.push(this.createOrgWithoutTeam(author));
    }

    return Promise.all(promises);
  }

  /**
   *
   * @param {Object} author
   * @return {Promise<Object>}
   */
  static async createOrgWithoutTeam(author: UserModel): Promise<number> {
    return this.createOrgWithTeam(author);
  }

  /**
   *
   * @param {Object} author
   * @param {Object[]} teamMembers
   * @return {Promise<Object>}
   */
  static async createOrgWithTeam(
    author: UserModel,
    teamMembers: UserModel[] = [],
  ): Promise<number> {
    // noinspection JSUnresolvedFunction
    const title = faker.company.companyName();
    const about = faker.company.companyName();
    const poweredBy = faker.company.companyName();
    // noinspection JSCheckFunctionSignatures
    const nickname = `${faker.name.firstName()}_${RequestHelper.generateRandomNumber(0, 10, 0)}`;

    const req = request(server)
      .post(RequestHelper.getOrganizationsUrl())
      .set('Authorization', `Bearer ${author.token}`)
      .field('title',             title)
      .field('nickname',          nickname)
      .field('about',          about)
      .field('powered_by',          poweredBy)
      .field('email',          faker.internet.email())
    ;

    for (let i = 0; i < teamMembers.length; i += 1) {
      const field = `users_team[${i}][id]`;
      const user = teamMembers[i];
      req.field(field, user.id);
    }

    const res = await req;
    ResponseHelper.expectStatusCreated(res);

    return +res.body.id;
  }

  /**
   *
   * @param {number} orgId
   * @param {Object} user
   * @param {Object[]} usersTeam
   * @return {Promise<Object>}
   */
  static async updateOrgUsersTeam(orgId, user, usersTeam: any[] = []) {
    // noinspection JSUnresolvedFunction
    const title = faker.company.companyName();
    // noinspection JSCheckFunctionSignatures
    const nickname = faker.name.firstName();

    const req = request(server)
      .patch(RequestHelper.getOneOrganizationUrl(orgId))
      .set('Authorization', `Bearer ${user.token}`)
      .field('title', title)
      .field('nickname', nickname)
    ;

    this.addUsersTeamToRequest(req, usersTeam);

    const res = await req;
    ResponseHelper.expectStatusOk(res);

    return res.body;
  }

  static addUsersTeamToRequest(req, usersTeam) {
    for (let i = 0; i < usersTeam.length; i += 1) {
      const field = `users_team[${i}][id]`;
      const user = usersTeam[i];
      req.field(field, user.id);
    }
  }
}

export = OrganizationsGenerator;
