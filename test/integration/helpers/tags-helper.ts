const delay = require('delay');

const request = require('supertest');
const server = require('../../../app');
const requestHelper = require('./request-helper');
const responseHelper = require('./response-helper');

const postsRepository = require('../../../lib/posts/posts-repository');
const tagsRepository = require('../../../lib/tags/repository/tags-repository.js');
const entityTagsRepository = require('../../../lib/tags/repository/entity-tags-repository.js');
const entityStateLogRepository =
  require('../../../lib/entities/repository/entity-state-log-repository.js');

const postsModelProvider = require('../../../lib/posts/service/posts-model-provider.js');

require('jest-expect-message');

class TagsHelper {

  /**
   * [Legacy]
   * @param {int} tagId
   * @param {number} expectedResponseStatus
   * @returns {Promise<*>}
   */
  static async requestToGetOneTagPageByIdAsGuest(tagId, expectedResponseStatus = 200) {
    const url = `${requestHelper.getTagsRootUrl()}/${tagId}`;

    const res = await request(server)
      .get(url)
    ;

    responseHelper.expectStatusToBe(res, expectedResponseStatus);

    return res.body;
  }

  /**
   * @param {string} tagTitle
   * @param {Object} myself
   * @param {number} expectedResponseStatus
   * @returns {Promise<*>}
   */
  static async requestToGetOneTagPageByTitleAsMyself(
    tagTitle: string,
    myself: Object,
    expectedResponseStatus: number = 200,
  ) {
    const url = requestHelper.getOneTagUrl(tagTitle);
    const req = request(server)
      .get(url)
    ;

    requestHelper.addAuthToken(req, myself);

    const res = await req;

    responseHelper.expectStatusToBe(res, expectedResponseStatus);

    return res.body;
  }

  /**
   *
   * @param {string} tagTitle
   * @param {number} expectedResponseStatus
   * @returns {Promise<Object>}
   */
  static async requestToGetOneTagPageByTitleAsGuest(
    tagTitle: string,
    expectedResponseStatus: number = 200,
  ): Promise<Object> {
    const url = `${requestHelper.getTagsRootUrl()}/${tagTitle}`;

    const res = await request(server)
      .get(url)
    ;

    responseHelper.expectStatusToBe(res, expectedResponseStatus);

    return res.body;
  }

  /**
   *
   * @param {number} modelId
   * @returns {Promise<Object>}
   */
  static async getPostWhenTagsAreProcessed(modelId) {
    let model;

    while (true) {
      model = await postsRepository.findOnlyPostItselfById(modelId);

      if (model.entity_tags !== null) {
        break;
      }

      delay(100);
    }

    return model;
  }

  /**
   *
   * @param {string[]} expectedTags
   * @param {Object} model
   * @returns {Promise<Object>}
   */
  static async checkRelatedPostModels(expectedTags, model) {
    const entityName = postsModelProvider.getEntityName();

    return this.checkRelatedModels(expectedTags, model, entityName);
  }

  /**
   *
   * @param {string[]} expectedTags
   * @param {Object} model
   * @param {string} entityName
   * @returns {Promise<Object>}
   */
  static async checkRelatedModels(expectedTags, model, entityName) {
    expect(model.entity_tags.sort()).toEqual(expectedTags.sort());

    const [allTags, entityTags, entityStateLog] = await Promise.all([
      tagsRepository.getAllTags(),
      entityTagsRepository.findAllWithAllFieldsByEntity(model.id, entityName),
      entityStateLogRepository.findLastEntityStateLog(model.id, entityName),
    ]);

    const dbTags: Object[] = [];

    // Expect that all tagModels are created or exists in Db
    expectedTags.forEach((tagTitle) => {
      const dbTag: any = allTags.find((tag: any) => tag.title === tagTitle);
      expect(dbTag).toBeTruthy();

      dbTags.push(dbTag);
    });

    // Check entity_tags records related to model
    dbTags.forEach((dbTag: any) => {
      const entityTag = entityTags.find((item: any) => +item.tag_id === +dbTag.id);
      expect(entityTag).toBeDefined();

      expect(entityTag.tag_title).toBe(dbTag.title);

      expect(entityTag.user_id).toBe(model.user_id);
      expect(entityTag.org_id).toBe(model.organization_id);
    });

    // Check entityStateLogRecords
    expect(entityStateLog).toBeDefined();
    expect(entityStateLog).not.toBeNull();

    expect(+entityStateLog.entity_id).toBe(+model.id);
    expect(entityStateLog.entity_name).toBe(entityName);
    expect(JSON.stringify(entityStateLog.state_json).length).toBeGreaterThan(0);

    return {
      allTags,
      dbTags,
      entityTags,
      entityStateLog,
    };
  }
}

export = TagsHelper;
