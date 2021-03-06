"use strict";
/* tslint:disable:max-line-length */
const ApiPostProcessor = require("../../lib/common/service/api-post-processor");
const PostsInputProcessor = require("../../lib/posts/validators/posts-input-processor");
const DiServiceLocator = require("../../lib/api/services/di-service-locator");
const express = require('express');
require('express-async-errors');
const orgRouter = express.Router();
const authTokenMiddleWare = require('../../lib/auth/auth-token-middleware');
const { cpUpload: cpPostUpload } = require('../../lib/posts/post-edit-middleware');
const orgIdParamMiddleware = require('../../lib/organizations/middleware/organization-id-param-middleware');
/* Create post for this organization */
orgRouter.post('/:organization_id/posts', [authTokenMiddleWare, cpPostUpload], async (req, res) => {
    PostsInputProcessor.process(req.body);
    const response = await DiServiceLocator.getPostsService(req).processNewDirectPostCreationForOrg(req);
    // backward compatibility injection
    ApiPostProcessor.setEmptyCommentsForOnePost(response, true);
    res.send(response);
});
orgRouter.param('organization_id', orgIdParamMiddleware);
module.exports = orgRouter;
