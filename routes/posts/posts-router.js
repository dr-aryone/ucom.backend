"use strict";
const PostsFetchService = require("../../lib/posts/service/posts-fetch-service");
const _ = require("lodash");
const PostsInputProcessor = require("../../lib/posts/validators/posts-input-processor");
const postsRouter = require('./comments-router');
const { AppError, BadRequestError } = require('../../lib/api/errors');
const authTokenMiddleWare = require('../../lib/auth/auth-token-middleware');
const { cpUpload } = require('../../lib/posts/post-edit-middleware');
const { descriptionParser } = require('../../lib/posts/post-description-image-middleware');
const postService = require('../../lib/posts/post-service');
const postRepository = require('../../lib/posts/posts-repository');
const activityApiMiddleware = require('../../lib/activity/middleware/activity-api-middleware');
require('express-async-errors');
/**
 * @param {Object} req
 * @returns {postService}
 */
function getPostService(req) {
    return req.container.get('post-service');
}
function getUserService(req) {
    return req.container.get('current-user');
}
function getCurrentUserId(req) {
    const CurrentUserService = getUserService(req);
    return CurrentUserService.getCurrentUserId();
}
const activityMiddlewareSet = [
    authTokenMiddleWare,
    cpUpload,
    activityApiMiddleware.redlockBeforeActivity,
];
/* Get all posts */
postsRouter.get('/', async (req, res) => {
    const currentUserId = getCurrentUserId(req);
    const result = await PostsFetchService.findManyPosts(req.query, currentUserId);
    res.send(result);
});
/* Get one post by ID */
postsRouter.get('/:post_id', async (req, res) => {
    const service = getPostService(req);
    const postId = req.post_id;
    const post = await service.findOnePostByIdAndProcess(postId);
    res.send(post);
});
postsRouter.post('/:post_id/join', [authTokenMiddleWare, cpUpload], async (
// @ts-ignore
req, res) => {
    res.status(404).send('Action is disabled');
});
postsRouter.post('/:post_id/upvote', activityMiddlewareSet, async (req, res) => {
    const result = await getPostService(req).userUpvotesPost(req.post_id, req.body);
    return res.status(201).send(result);
});
postsRouter.post('/:post_id/downvote', activityMiddlewareSet, async (req, res) => {
    const result = await getPostService(req).userDownvotesPost(req.post_id, req.body);
    return res.status(201).send(result);
});
postsRouter.post('/:post_id/repost', [authTokenMiddleWare, cpUpload], async (req, res) => {
    PostsInputProcessor.process(req.body);
    const service = getPostService(req);
    const response = await service.processRepostCreation(req.body, req.post_id);
    res.status(201).send(response);
});
postsRouter.post('/image', [descriptionParser], async (
// @ts-ignore
req, 
// @ts-ignore
res) => {
    throw new BadRequestError('Legacy uploader is switched off. Consider to use a new uploader');
});
/* Create new post */
postsRouter.post('/', [authTokenMiddleWare, cpUpload], async (req, res) => {
    PostsInputProcessor.process(req.body);
    const newPost = await getPostService(req).processNewPostCreation(req);
    const response = postService.isDirectPost(newPost) ? newPost : {
        id: newPost.id,
    };
    res.send(response);
});
/* Update Post */
// noinspection TypeScriptValidateJSTypes
postsRouter.patch('/:post_id', [authTokenMiddleWare, cpUpload], async (req, res) => {
    const userId = req.user.id;
    const postId = req.post_id;
    if (!_.isEmpty(req.files)) {
        throw new BadRequestError('It is not allowed to upload files. Please consider to use a entity_images');
    }
    const params = req.body;
    PostsInputProcessor.process(req.body);
    const updatedPost = await getPostService(req).updateAuthorPost(postId, userId, params);
    if (postService.isDirectPost(updatedPost)) {
        res.send(updatedPost);
    }
    else {
        res.send({
            post_id: updatedPost.id,
        });
    }
});
postsRouter.param('post_id', (req, 
// @ts-ignore
res, next, postId) => {
    const value = +postId;
    if (!value) {
        throw new BadRequestError({
            post_id: 'Post ID must be a valid integer',
        });
    }
    postRepository.getModel().count({
        where: {
            id: value,
        },
    }).then((count) => {
        // eslint-disable-next-line promise/always-return
        if (count === 0) {
            throw new AppError(`There is no post with ID ${value}`, 404);
        }
        req.post_id = value;
        // eslint-disable-next-line promise/no-callback-in-promise
        next();
        // eslint-disable-next-line promise/no-callback-in-promise
    }).catch(next);
});
module.exports = postsRouter;
