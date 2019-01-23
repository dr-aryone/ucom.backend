/* tslint:disable:max-line-length */
import { DbParamsDto, RequestQueryDto } from '../../api/filters/interfaces/query-filter-interfaces';

const queryFilterService  = require('../../api/filters/query-filter-service');
const apiPostProcessor    = require('../../common/service').PostProcessor;
const usersFeedRepository = require('../../common/repository').UsersFeed;

const usersActivityRepository    = require('../../users/repository/users-activity-repository');
const commentsFetchService = require('../../comments/service/comments-fetch-service');

class PostsFetchService {
  /**
   *
   * @param {number} userId
   * @param {number|null} currentUserId
   * @param {Object} query
   * @return {Promise<any>}
   */
  static async findAndProcessAllForUserWallFeed(
    userId: number,
    currentUserId: number | null,
    query: RequestQueryDto | null = null,
  ) {
    const params: DbParamsDto = queryFilterService.getQueryParameters(query);

    const includeProcessor = usersFeedRepository.getIncludeProcessor();
    includeProcessor(query, params);

    const findCountPromises: Promise<any>[] = [
      usersFeedRepository.findAllForUserWallFeed(userId, params),
      usersFeedRepository.countAllForUserWallFeed(userId),
    ];

    return this.findAndProcessAllForWallFeed(query, params, currentUserId, findCountPromises);
  }

  /**
   *
   * @param {Object} query
   * @param {number} currentUserId
   * @return {Promise<any>}
   */
  static async findAndProcessAllForMyselfNewsFeed(
    query: RequestQueryDto,
    currentUserId: number,
  ) {
    const params: DbParamsDto = queryFilterService.getQueryParameters(query);

    const includeProcessor = usersFeedRepository.getIncludeProcessor();
    includeProcessor(query, params);

    const { orgIds, usersIds }: { orgIds: number[], usersIds: number[] } =
      await usersActivityRepository.findOneUserFollowActivity(currentUserId);

    const findCountPromises = [
      usersFeedRepository.findAllForUserNewsFeed(currentUserId, usersIds, orgIds, params),
      usersFeedRepository.countAllForUserNewsFeed(currentUserId, usersIds, orgIds),
    ];

    return this.findAndProcessAllForWallFeed(query, params, currentUserId, findCountPromises);
  }

  /**
   *
   * @param {number} orgId
   * @param {Object} query
   * @param {number} currentUserId
   * @return {Promise<any>}
   */
  static async findAndProcessAllForOrgWallFeed(orgId, query, currentUserId) {
    const params = queryFilterService.getQueryParameters(query);

    const findCountPromises = [
      usersFeedRepository.findAllForOrgWallFeed(orgId, params),
      usersFeedRepository.countAllForOrgWallFeed(orgId),
    ];

    return this.findAndProcessAllForWallFeed(query, params, currentUserId, findCountPromises);
  }

  /**
   *
   * @param tagTitle
   * @param currentUserId
   * @param query
   * @returns {Promise<any>}
   */
  static async findAndProcessAllForTagWallFeed(tagTitle, currentUserId, query) {
    const params = queryFilterService.getQueryParameters(query, {}, []);

    const findCountPromises = [
      usersFeedRepository.findAllPostsForWallFeedByTag(tagTitle, params),
      usersFeedRepository.countAllPostsForWallFeedByTag(tagTitle),
    ];

    return this.findAndProcessAllForWallFeed(query, params, currentUserId, findCountPromises);
  }

  /**
   *
   * @param {Object} query
   * @param {Object} params
   * @param {number} currentUserId
   * @param {Promise[]} findCountPromises
   * @return {Promise<any>}
   * @private
   */
  private static async findAndProcessAllForWallFeed(
    query,
    params,
    currentUserId,
    findCountPromises,
  ) {
    const [posts, totalAmount] = await Promise.all(findCountPromises);

    const idToPost = {};
    const postsIds: number[] = [];
    // @ts-ignore
    for (const post of posts) {
      idToPost[post.id] = post;
      postsIds.push(+post.id);
    }

    let userActivity;
    if (currentUserId) {
      const postsActivity = await usersActivityRepository.findOneUserToPostsVotingAndRepostActivity(
        currentUserId,
        postsIds,
      );

      userActivity = {
        posts: postsActivity,
      };
    }

    // #task - use included query
    if (query && query.included_query && query.included_query.comments) {
      // #task - prototype realization for demo, N+1 issue
      for (const id of postsIds) {
        // #task - should be defined as default parameters for comments pagination
        const commentsQuery = {
          depth: 0,
          ...query.included_query.comments,
        };

        idToPost[id].comments = await commentsFetchService.findAndProcessCommentsByPostId(
          id,
          currentUserId,
          commentsQuery,
        );
      }
    }

    const data      = apiPostProcessor.processManyPosts(posts, currentUserId, userActivity);
    const metadata  = queryFilterService.getMetadata(totalAmount, query, params);

    return {
      data,
      metadata,
    };
  }
}

export = PostsFetchService;