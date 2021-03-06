/* tslint:disable:max-line-length */
import OrganizationsFetchService = require('../../lib/organizations/service/organizations-fetch-service');
import OrganizationsValidateDiscussions = require('../../lib/organizations/discussions/service/organizations-validate-discussions');
import OrganizationsModifyDiscussions = require('../../lib/organizations/discussions/service/organizations-modify-discussions');
import PostsInputProcessor = require('../../lib/posts/validators/posts-input-processor');
import DiServiceLocator = require('../../lib/api/services/di-service-locator');
import UserToOrganizationActivity = require('../../lib/users/activity/user-to-organization-activity');
import { OrgModel } from '../../lib/organizations/interfaces/model-interfaces';
import ActivityApiMiddleware = require('../../lib/activity/middleware/activity-api-middleware');

const express = require('express');
const status  = require('statuses');
require('express-async-errors');

const orgRouter  = express.Router();

const authTokenMiddleWare   = require('../../lib/auth/auth-token-middleware');
const { cpUpload, cpUploadArray } =
  require('../../lib/organizations/middleware/organization-create-edit-middleware');

const { cpUpload:cpPostUpload } = require('../../lib/posts/post-edit-middleware');

const orgIdParamMiddleware  =
  require('../../lib/organizations/middleware/organization-id-param-middleware');

// @deprecated @see GraphQL
orgRouter.get('/', async (req, res) => {
  const response = await OrganizationsFetchService.findAndProcessAll(req.query);

  res.send(response);
});

const activityMiddlewareSet: any = [
  authTokenMiddleWare,
  cpUploadArray,
  ActivityApiMiddleware.redlockBeforeActivity,
];

// @deprecated @see GraphQL
orgRouter.get('/:organization_id', async (req, res) => {
  const targetId = req.organization_id;

  const service = DiServiceLocator.getOrganizationsService(req);
  const response = await service.findOneOrgByIdAndProcess(targetId);

  res.send(response);
});

// @deprecated @see GraphQL
orgRouter.get('/:organization_id/wall-feed', [cpUploadArray], async (req, res) => {
  const service = DiServiceLocator.getPostsService(req);
  const response =
    await service.findAndProcessAllForOrgWallFeed(req.organization_id, req.query);

  res.send(response);
});

/* Create post for this organization */
orgRouter.post('/:organization_id/posts', [authTokenMiddleWare, cpPostUpload], async (req, res) => {
  const service = DiServiceLocator.getPostsService(req);

  PostsInputProcessor.process(req.body);
  const response = await service.processNewDirectPostCreationForOrg(req);

  res.send(response);
});

/* Create new organization */
orgRouter.post('/', [authTokenMiddleWare, cpUpload], async (req, res) => {
  const service = DiServiceLocator.getOrganizationsService(req);
  const model = await service.processNewOrganizationCreation(req);

  return res.status(201).send({
    id: model.id,
  });
});

/* Receive new discussions state from frontend */
orgRouter.post('/:organization_id/discussions', [authTokenMiddleWare, cpUpload], async (req, res) => {
  const currentUserId: number = DiServiceLocator.getCurrentUserIdOrException(req);

  await OrganizationsModifyDiscussions.processNewDiscussionsState(
    req.organization_model,
    req.body,
    currentUserId,
  );

  return res.status(200).send({
    success: true,
  });
});

/* Validate one discussion */
orgRouter.get('/:organization_id/discussions/:post_id/validate', [authTokenMiddleWare, cpUpload], async (req, res) => {
  const currentUserId: number = DiServiceLocator.getCurrentUserIdOrException(req);

  const orgModel: OrgModel = req.organization_model;
  await OrganizationsValidateDiscussions.isItPossibleToAddOneMoreDiscussion(orgModel);
  await OrganizationsValidateDiscussions.validateOneDiscussion(orgModel, +req.params.post_id, currentUserId);

  return res.status(200).send({
    success: true,
  });
});

/* Delete all discussions */
orgRouter.delete('/:organization_id/discussions', [authTokenMiddleWare, cpUpload], async (req, res) => {
  const currentUserId: number = DiServiceLocator.getCurrentUserIdOrException(req);

  await OrganizationsModifyDiscussions.deleteAllDiscussions(req.organization_model, currentUserId);

  return res.status(204).send({});
});

/* Update organization */
orgRouter.patch('/:organization_id', [authTokenMiddleWare, cpUpload], async (req, res) => {
  const service = DiServiceLocator.getOrganizationsService(req);
  await service.updateOrganization(req);

  return res.status(200).send({
    status: 'ok',
  });
});

/* One user follows organization */
orgRouter.post('/:organization_id/follow', activityMiddlewareSet, async (req, res) => {
  const userFrom    = req.user;
  const entityIdTo  = req.organization_id;

  await UserToOrganizationActivity.userFollowsOrganization(userFrom, entityIdTo, req.body);

  res.status(status('201')).send({
    success: true,
  });
});

/* One user unfollows organization */
orgRouter.post('/:organization_id/unfollow', activityMiddlewareSet, async (req, res) => {
  const userFrom    = req.user;
  const entityIdTo  = req.organization_id;

  await UserToOrganizationActivity.userUnfollowsOrganization(userFrom, entityIdTo, req.body);

  res.status(status('201')).send({
    success: true,
  });
});

orgRouter.param('organization_id', orgIdParamMiddleware);

export = orgRouter;
