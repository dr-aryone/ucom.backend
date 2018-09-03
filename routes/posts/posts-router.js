const express = require('express');
const router = express.Router();
const {AppError, BadRequestError} = require('../../lib/api/errors');
const authTokenMiddleWare = require('../../lib/auth/auth-token-middleware');
const { cpUpload } = require('../../lib/posts/post-edit-middleware');
const { descriptionParser } = require('../../lib/posts/post-description-image-middleware');
const config = require('config');
const PostService = require('../../lib/posts/post-service');
const ActivityService = require('../../lib/activity/activity-service');

const models = require('../../models');
const AuthService = require('../../lib/auth/authService');
require('express-async-errors');

/* Get all posts */
router.get('/', async (req, res) => {
  const posts = await getPostService(req).findAll();

  res.send(posts);
});

/* Get post by ID */
router.get('/:post_id', async (req, res) => {
  const post = await getPostService(req).findOneById(req['post_id']);

  res.send(post);
});


router.post('/:post_id/join', [authTokenMiddleWare], async (req, res) => {
  const userFrom = req['user'];
  const post_id = req['post_id'];

  await ActivityService.userJoinsPost(userFrom, post_id);

  res.send({
    post_id,
    'user_id': userFrom.id,
  });
});

router.post('/:post_id/upvote', [authTokenMiddleWare], async (req, res) => {
  const postService = getPostService(req);

  const postIdTo = req['post_id'];

  // TODO check does exists only
  const postTo = await postService.findOneById(postIdTo);

  const userFrom = req['user'];

  if (!postTo) {
    return res.status(404).send({
      'errors': {
        'post_id': `There is post with ID ${postIdTo}`
      }
    });
  }

  const doesExists = await ActivityService.doesUserVotePost(userFrom.id, postIdTo);

  if (doesExists) {
    return res.status(400).send({
      'errors': {
        'upvote': 'Vote duplication is not allowed'
      }
    });
  }

  if (postTo.user_id === userFrom.id) {
    return res.status(400).send({
      'errors': {
        'upvote': 'It is not allowed to vote for your own post'
      }
    });
  }

  await ActivityService.userUpvotesPost(userFrom, postTo);

  const changedPost = await postService.findOneById(postIdTo);

  res.send({
    'current_vote': changedPost.current_vote,
  });
});

/* Upload post picture (for description) */
router.post('/image', [descriptionParser], async (req, res) => {
  const filename = req['files']['image'][0].filename;
  const rootUrl = config.get('host')['root_url'];

  res.send({
    'files': [
      {
        "url": `${rootUrl}/upload/${filename}`
      }
    ]
  });
});

/* Create new post */
router.post('/', [authTokenMiddleWare, cpUpload], async (req, res) => {
  const newPost = await PostService.createNewPost(req);

  res.send({
    'id': newPost.id
  });
});

router.patch('/:post_id', [authTokenMiddleWare, cpUpload], async (req, res) => {
  const user_id = req['user'].id;
  const post_id = req['post_id'];

  // Lets change file
  const files = req['files'];
  if (files && files['main_image_filename'] && files['main_image_filename'][0] && files['main_image_filename'][0].filename) {
    req.body['main_image_filename'] = files['main_image_filename'][0].filename;
  }

  const params = req.body;

  const updatedPost = await PostService.updateAuthorPost(post_id, user_id, params);

  res.send({
    'post_id': updatedPost.id
  });
});

router.param('post_id', (req, res, next, post_id) => {
  const value = parseInt(post_id);

  if (!value) {
    throw new BadRequestError({
      'post_id': 'Post ID must be a valid integer'
    })
  }

  models['posts'].count({
    where: {
      id: value
    }
  }).then(count => {

    if (count === 0) {
      throw new AppError(`There is no post with ID ${value}`, 404);
    }
    req['post_id'] = value;

    next();

  }).catch(next);
});

/**
 *
 * @param {Object} req
 * @returns {PostService}
 */
function getPostService(req) {
  return req['container'].get('post-service');
}

module.exports = router;