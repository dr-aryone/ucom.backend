const request = require('supertest');
const server = require('../../../app');

const RequestHelper = require('./request-helper');
const ResponseHelper = require('./response-helper');
const models = require('../../../models');

class CommentsHelper {
  /**
   *
   * @param {Object} actual
   */
  static checkCommentResponseBody(actual) {
    models['comments'].apiResponseFields().forEach(field => {
      expect(actual[field]).toBeDefined();
    });
  }

  /**
   *
   * @param {number} postId
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  static async requestToCreateComment(postId, user) {
    const fieldsToSet = {
      'description': 'comment description',
    };

    const res = await request(server)
      .post(RequestHelper.getCommentsUrl(postId))
      .set('Authorization', `Bearer ${user.token}`)
      .send(fieldsToSet)
    ;

    ResponseHelper.expectStatusCreated(res);

    return res.body;
  }

  /**
   *
   * @param {number} postId
   * @param {number} parentCommentId
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  static async requestToCreateCommentOnComment(postId, parentCommentId, user) {
    const fieldsToSet = {
      'description': 'comment description',
    };

    const res = await request(server)
      .post(RequestHelper.getCommentOnCommentUrl(postId, parentCommentId))
      .set('Authorization', `Bearer ${user.token}`)
      .send(fieldsToSet)
    ;

    ResponseHelper.expectStatusCreated(res);

    return res.body;
  }

}

module.exports = CommentsHelper;