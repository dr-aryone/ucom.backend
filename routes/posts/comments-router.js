const express = require('express');
const router = express.Router();
const authTokenMiddleWare = reqlib('/lib/auth/auth-token-middleware');
const {AppError, BadRequestError} = require('../../lib/api/errors');
const CommentsRepository = require('../../lib/comments/comments-repository');


/* create comment on comment */
router.post('/:post_id/comments/:comment_id', [authTokenMiddleWare], async (req, res) => {
  res.send({
    status: 'ok',
  })
});

/* Create comment directly to post*/
router.post('/:post_id/comments', [authTokenMiddleWare], async (req, res) => {
  const currentUser = req['user'];

  const newComment = await getCommentsService(req).createNewComment(req['body'], req['post_id'], currentUser);

  // TODO #refactor optimization
  const createdCommentModel = await CommentsRepository.findOneById(newComment.id);

  const createdComment = createdCommentModel.toApiResponseJson();

  res.status(201).send(createdComment)
});

router.param('comment_id', (req, res, next, comment_id) => {
  const value = parseInt(comment_id);

  if (!value) {
    throw new BadRequestError({
      'comment_id': 'comment ID must be a valid integer'
    })
  }

  CommentsRepository.getModel().count({
    where: {
      id: value
    }
  }).then(count => {

    if (count === 0) {
      throw new AppError(`There is no comment with ID ${value}`, 404);
    }
    req['comment_id'] = value;

    next();

  }).catch(next);
});

/**
 * @param {Object} req
 * @returns {CommentsService}
 */
function getCommentsService(req) {
  return req['container'].get('comments-service');
}

module.exports = router;