/* tslint:disable:max-line-length */

import { IdOnlyDto } from '../../common/interfaces/common-types';
import { UserModel } from '../../users/interfaces/model-interfaces';

import OrganizationsRepository = require('../../organizations/repository/organizations-repository');
import PostSanitizer = require('../post-sanitizer');
import BlockchainUniqId = require('../../eos/eos-blockchain-uniqid');
import OrganizationsModelProvider = require('../../organizations/service/organizations-model-provider');
import PostOfferRepository = require('../repository/post-offer-repository');
import UsersTeamRepository = require('../../users/repository/users-team-repository');
import PostsFetchService = require('./posts-fetch-service');
import PostsCurrentParamsRepository = require('../repository/posts-current-params-repository');
import EntityImageInputService = require('../../entity-images/service/entity-image-input-service');
import { PostModelInput } from '../interfaces/model-interfaces';

const _ = require('lodash');
const config = require('config');

const { TransactionFactory, ContentTypeDictionary } = require('ucom-libs-social-transactions');
const { AppError } = require('../../../lib/api/errors');

const db = require('../../../models').sequelize;

const { BadRequestError } = require('../../../lib/api/errors');

const backendConfig = config.host;

const httpImagesFolder = `${backendConfig.root_url}${backendConfig.profile_files_upload_dir}`;
const eosTransactionService = require('../../eos/eos-transaction-service');

const usersActivityService  = require('../../users/user-activity-service');

const usersModelProvider = require('../../users/service').ModelProvider;
const eventIdDictionary         = require('../../entities/dictionary').EventId;

const usersActivityRepository = require('../../users/repository/users-activity-repository');
const postsRepository         = require('../posts-repository');

const models = require('../../../models');

/**
 * beginning of refactoring
 */
class PostCreatorService {
  public static async processNewPostCreation(req, eventId = null, currentUser: UserModel) {
    // #task - wrap in database transaction

    const { files } = req;
    const { body }  = req;

    // #task - provide Joi validation
    if (body && body.title && body.title.length > 255) {
      throw new BadRequestError({ title: 'Title is too long. Size must be up to 255 symbols.' });
    }
    // #task - provide Joi validation
    if (body && body.leading_text && body.leading_text.length > 255) {
      throw new BadRequestError({ leading_text: 'Leading_text is too long. Size must be up to 255 symbols.' });
    }

    const postTypeId = +req.body.post_type_id;
    if (!postTypeId) {
      throw new BadRequestError({
        post_type_id: 'Post Type ID must be a valid natural number',
      });
    }

    let orgBlockchainId = null;
    if (!body.organization_id) {
      body.organization_id = null;
    } else {
      orgBlockchainId = await OrganizationsRepository.findBlockchainIdById(+body.organization_id);
      if (!orgBlockchainId) {
        throw new BadRequestError({ general: `There is no orgBlockchainId for org with ID ${+body.organization_id}` }, 404);
      }
    }

    await this.addSignedTransactionDetailsToBody(body, currentUser, postTypeId, orgBlockchainId);

    await this.makeOrganizationRelatedChecks(body, currentUser);
    await this.addAttributesOfEntityFor(body, currentUser);
    // noinspection JSDeprecatedSymbols
    PostSanitizer.sanitisePost(body);

    // noinspection OverlyComplexBooleanExpressionJS
    // #legacy backward compatibility - should be changed to entity_images
    if (files && files.main_image_filename && files.main_image_filename[0] && files.main_image_filename[0].filename) {
      body.main_image_filename = files.main_image_filename[0].filename;
    }

    this.legacyProcessEntityImagesWhileCreation(body);

    const { newPost, newActivity } = await models.sequelize
      .transaction(async (transaction) => {
        const model     = await this.createPostByPostType(postTypeId, body, transaction, currentUser.id);
        const activity = await this.createNewActivity(
          model,
          body.signed_transaction,
          currentUser.id,
          eventId,
          transaction,
        );

        return {
          newPost: model,
          newActivity: activity,
        };
      });

    // #task - create new post via knex only and provide related transaction
    await PostsCurrentParamsRepository.insertRowForNewEntity(newPost.id);
    await usersActivityService.sendContentCreationPayloadToRabbit(newActivity);

    if (PostsFetchService.isDirectPost(newPost)) {
      // Direct Post creation = full post content, not only ID
      return PostsFetchService.findOnePostByIdAndProcess(newPost.id, currentUser.id);
    }

    return newPost;
  }

  /**
   * In future - make private
   *
   * @param {Object} model
   */
  public static legacyProcessEntityImagesWhileUpdating(model) {
    // legacy compatibility. Main image filename rewrites entity_images if set
    if (model.main_image_filename) {
      model.entity_images = {
        article_title: [
          {
            url: `${httpImagesFolder}/${model.main_image_filename}`,
          },
        ],
      };
    }
  }

  /**
   *
   * @param {Object} givenBody
   * @param {number} postId
   * @param {Object} user
   * @return {Promise<{id: *}>}
   */
  public static async processRepostCreation(givenBody, postId, user): Promise<IdOnlyDto> {
    const parentPost = await this.checkParentPostOfRepost(postId, user.id);

    const body = _.pick(givenBody, ['signed_transaction', 'blockchain_id']);
    body.post_type_id = ContentTypeDictionary.getTypeRepost();
    body.parent_id = postId;

    body.entity_id_for    = user.id;
    body.entity_name_for  = usersModelProvider.getEntityName();

    await eosTransactionService.appendSignedUserCreatesRepost(body, user, parentPost.blockchain_id);
    const eventId = eventIdDictionary.getRepostEventId(parentPost.organization_id);

    const { newPost, newActivity } = await db
      .transaction(async (transaction) => {
        const model = await postsRepository.createNewPost(body, user.id, transaction);

        const activity = await PostCreatorService.createNewActivityForRepost(
          model,
          body.signed_transaction,
          user.id,
          eventId,
          transaction,
        );

        // noinspection JSUnusedGlobalSymbols
        return {
          newPost: model,
          newActivity: activity,
        };
      });

    // #task - create new post via knex only and provide related transaction
    await PostsCurrentParamsRepository.insertRowForNewEntity(newPost.id);
    await usersActivityService.sendContentCreationPayloadToRabbit(newActivity);

    return {
      id: newPost.id,
    };
  }

  // #legacy compatibility
  private static legacyProcessEntityImagesWhileCreation(body) {
    if (body.main_image_filename && body.entity_images) {
      throw new BadRequestError('It is not possible to create post using both main_image_filename and entity_images');
    }

    if (body.main_image_filename) {
      body.entity_images = {
        article_title: [
          {
            url: `${httpImagesFolder}/${body.main_image_filename}`,
          },
        ],
      };

      return;
    }
  }

  /**
   *
   * @param {Object} body
   * @param {Object} user
   * @param {number} postTypeId
   * @param {string|null} organizationBlockchainId
   * @return {Promise<void>}
   * @private
   */
  private static async addSignedTransactionDetailsToBody(body, user, postTypeId, organizationBlockchainId = null) {
    if (postTypeId === ContentTypeDictionary.getTypeDirectPost()) {
      return;
    }

    // noinspection IfStatementWithTooManyBranchesJS
    if (postTypeId === ContentTypeDictionary.getTypeMediaPost()) {
      body.blockchain_id = BlockchainUniqId.getUniqidForMediaPost();
    } else if (postTypeId === ContentTypeDictionary.getTypeOffer()) {
      body.blockchain_id = BlockchainUniqId.getUniqidForPostOffer();
    } else {
      throw new BadRequestError({ post_type_id: `Unsupported post type id: ${postTypeId}` });
    }

    if (organizationBlockchainId) {
      // eslint-disable-next-line no-underscore-dangle
      body.signed_transaction = await TransactionFactory._getSignedOrganizationCreatesContent(
        user.account_name,
        user.private_key,
        organizationBlockchainId,
        body.blockchain_id,
        postTypeId,
      );
    } else {
      // eslint-disable-next-line no-underscore-dangle
      body.signed_transaction = await TransactionFactory._userHimselfCreatesPost(
        user.account_name,
        user.private_key,
        body.blockchain_id,
        postTypeId,
      );
    }
  }

  /**
   *
   * @param {number} postId
   * @param {number} userId
   * @return {Promise<Object>}
   */
  private static async checkParentPostOfRepost(postId, userId) {
    const post = await postsRepository.findOneOnlyWithOrganization(postId);

    if (post.post_type_id === ContentTypeDictionary.getTypeRepost()) {
      throw new BadRequestError({
        general: 'It is not possible to create repost on repost',
      });
    }

    if (post.post_type_id === ContentTypeDictionary.getTypeDirectPost()
      && post.entity_id_for === userId
      && post.entity_name_for === usersModelProvider.getEntityName()
    ) {
      throw new BadRequestError({
        general: 'It is not possible to create repost on direct post of yours',
      });
    }

    if (post.user_id === userId) {
      throw new BadRequestError({
        general: 'It is not possible to create repost on your own post',
      });
    }

    const isRepost = await usersActivityRepository.doesUserHaveRepost(userId, postId);

    if (isRepost) {
      throw new BadRequestError({
        general: 'It is not possible to repost the same post twice by one user',
      });
    }

    return post;
  }

  /**
   *
   * @param {Object} newPost
   * @param {string} signedTransaction
   * @param {number} currentUserId
   * @param {number} eventId
   * @param {Object} transaction
   * @return {Promise<Object>}
   * @private
   */
  private static async createNewActivityForRepost(newPost, signedTransaction, currentUserId, eventId = null, transaction = null) {
    let newActivity;

    if (newPost.organization_id) {
      newActivity = await usersActivityService.processOrganizationCreatesRepost(
        newPost,
        eventId,
        signedTransaction,
        currentUserId,
        transaction,
      );
    } else {
      newActivity = await usersActivityService.processUserHimselfCreatesRepost(
        newPost,
        eventId,
        signedTransaction,
        currentUserId,
        transaction,
      );
    }

    return newActivity;
  }

  /**
   *
   * @param {Object} body
   * @param {Object} user
   * @return {Promise<void>}
   * @private
   */
  private static async makeOrganizationRelatedChecks(body, user) {
    if (!body.organization_id) {
      return;
    }

    const doesExist = await OrganizationsRepository.doesExistById(body.organization_id);

    if (!doesExist) {
      throw new AppError(`There is no organization with ID ${body.organization_id}.`, 404);
    }

    await this.checkCreationBehalfPermissions(user.id, body.organization_id);
  }

  /**
   *
   * @param {Object} body
   * @param {Object} user
   * @return {Promise<void>}
   * @private
   */
  private static async addAttributesOfEntityFor(body, user) {
    if (+body.post_type_id === ContentTypeDictionary.getTypeDirectPost()) {
      // direct post entity_id_for is set beforehand. Refactor this in future
      return;
    }

    // Repost is created only for user, not for organization

    if (!body.organization_id) {
      body.entity_id_for = user.id;
      body.entity_name_for = usersModelProvider.getEntityName();

      return;
    }

    body.entity_id_for    = body.organization_id;
    body.entity_name_for  = OrganizationsModelProvider.getEntityName();
  }

  private static async createPostByPostType(postTypeId, body, transaction, currentUserId: number) {
    // #task - provide body validation form via Joi
    let newPost: PostModelInput = {
      entity_images: {},
    };

    EntityImageInputService.addEntityImageFieldFromBodyOrException(newPost, body);

    switch (postTypeId) {
      case ContentTypeDictionary.getTypeMediaPost():
        newPost = await postsRepository.createNewPost(body, currentUserId, transaction);
        break;
      case ContentTypeDictionary.getTypeOffer():
        newPost = await PostOfferRepository.createNewOffer(body, currentUserId, transaction);
        break;
      case ContentTypeDictionary.getTypeDirectPost():
        newPost = await postsRepository.createNewPost(body, currentUserId, transaction);
        break;
      case ContentTypeDictionary.getTypeRepost():
        newPost = await postsRepository.createNewPost(body, currentUserId, transaction);
        break;
      default:
        throw new BadRequestError({
          post_type_id: `Provided post type ID is not supported: ${postTypeId}`,
        });
    }

    return newPost;
  }

  /**
   *
   * @param {Object} newPost
   * @param {string} signedTransaction
   * @param {number} currentUserId
   * @param {number|null} eventId
   * @param {Object} transaction
   * @return {Promise<Object>}
   * @private
   */
  private static async createNewActivity(newPost, signedTransaction, currentUserId, eventId = null, transaction = null) {
    let newActivity;

    if (newPost.organization_id) {
      newActivity = await usersActivityService.processOrganizationCreatesPost(
        newPost,
        eventId,
        signedTransaction,
        currentUserId,
        transaction,
      );
    } else {
      newActivity = await usersActivityService.processUserHimselfCreatesPost(
        newPost,
        eventId,
        signedTransaction,
        currentUserId,
        transaction,
      );
    }

    return newActivity;
  }

  /**
   *
   * @param {number} userId
   * @param {number|null} organizationId
   * @return {Promise<void>}
   * @private
   */
  private static async checkCreationBehalfPermissions(userId, organizationId = null) {
    if (organizationId === null) {
      return;
    }

    // Check if user is an author of the organization
    const isOrgAuthor = await OrganizationsRepository.isUserAuthor(organizationId, userId);

    const isTeamMember = await UsersTeamRepository.isTeamMember(
      OrganizationsModelProvider.getEntityName(),
      organizationId,
      userId,
    );

    if (!isOrgAuthor && !isTeamMember) {
      throw new AppError('It is not permitted to create post on behalf of this organization', 403);
    }
  }
}

export = PostCreatorService;
