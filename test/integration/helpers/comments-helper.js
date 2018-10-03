const request = require('supertest');
const server = require('../../../app');

const RequestHelper = require('./request-helper');
const ResponseHelper = require('./response-helper');
const models = require('../../../models');

class CommentsHelper {

  /**
   *
   * @param {number} post_id
   * @param {number} comment_id
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  static async requestToUpvoteComment(post_id, comment_id, user) {
    const res = await request(server)
      .post(`/api/v1/posts/${post_id}/comments/${comment_id}/upvote`)
      .set('Authorization', `Bearer ${user.token}`)
    ;

    ResponseHelper.expectStatusCreated(res);

    return res.body;
  }

  /**
   *
   * @param {number} post_id
   * @param {number} comment_id
   * @param {Object} user
   * @returns {Promise<Object>}
   */
  static async requestToDownvoteComment(post_id, comment_id, user) {
    const res = await request(server)
      .post(`/api/v1/posts/${post_id}/comments/${comment_id}/downvote`)
      .set('Authorization', `Bearer ${user.token}`)
    ;

    ResponseHelper.expectStatusCreated(res);

    return res.body;
  }

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
    const res = await request(server)
      .post(RequestHelper.getCommentsUrl(postId))
      .set('Authorization', `Bearer ${user.token}`)
      .field('description', 'comment description')
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
    const res = await request(server)
      .post(RequestHelper.getCommentOnCommentUrl(postId, parentCommentId))
      .set('Authorization', `Bearer ${user.token}`)
      .field('description', 'comment description')
    ;

    ResponseHelper.expectStatusCreated(res);

    return res.body;
  }

}

module.exports = CommentsHelper;