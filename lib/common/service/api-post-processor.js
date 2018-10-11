const CommentsPostProcessor = require('../../comments/service/comments-post-processor');
const UsersPostProcessor    = require('../../users/user-post-processor');
const OrgPostProcessor      = require('../../organizations/service/organization-post-processor');
const PostsPostProcessor    = require('../../posts/service').PostProcessor;
const InteractionTypeDictionary   = require('uos-app-transaction').InteractionTypeDictionary;

const EosImportance = require('../../eos/eos-importance');

class ApiPostProcessor {

  /**
   *
   * @param {Object[]} posts
   * @param {number} currentUserId
   * @param {Object} currentUserActivity
   * @return {Array}
   */
  static processManyPosts(posts, currentUserId, currentUserActivity) {
    let result = [];

    for (let i = 0; i < posts.length; i++) {
      const post = posts[i];
      const data = this.processOnePostForList(post, currentUserId, currentUserActivity);

      result.push(data);
    }

    return result;
  }

  /**
   *
   * @param {Object} post
   * @param {number} currentUserId
   * @param {Object} currentUserActivity
   * @return {*}
   */
  static processOnePostForList(post, currentUserId, currentUserActivity) {
    this._normalizeMultiplier(post);

    UsersPostProcessor.processModelAuthorForListEntity(post.User);

    if (currentUserId) {
      const userPostActivity = currentUserActivity ? currentUserActivity.posts[post.id] : null;
      this._addMyselfDataForPost(post, currentUserId, userPostActivity);
    }

    if (post.organization) {
      OrgPostProcessor.processOneOrgWithoutActivity(post.organization);
    }
    PostsPostProcessor.processPostInCommon(post);

    // TOD return is not required here
    return post;
  }

  /**
   *
   * @param {Object} post
   * @param {number} currentUserId
   * @param {Object} currentUserPostActivity
   * @param {Object} activityData
   * @param {number[]} orgTeamMembers
   * @return {*}
   */
  static processOnePostFully(post, currentUserId, currentUserPostActivity, activityData, orgTeamMembers) {
    this._normalizeMultiplier(post);

    this.processManyCommentsOfEntity(post, currentUserId);

    UsersPostProcessor.processModelAuthor(post, currentUserId, activityData);

    if (currentUserId) {
      const userPostActivity = currentUserPostActivity ? currentUserPostActivity.posts[post.id] : null;
      this._addMyselfDataForPost(post, currentUserId, userPostActivity, orgTeamMembers);
    }

    OrgPostProcessor.processOneOrg(post.organization);
    PostsPostProcessor.processPostInCommon(post);

    this._processPostTeam(post);

    return post;
  }

  /**
   *
   * @param {Object} entity
   * @param {number} currentUserId
   */
  static processManyCommentsOfEntity(entity, currentUserId) {
    if (entity.comments) {
      this.processManyComments(entity.comments, currentUserId);
    }
  }

  /**
   *
   * @param {Object} users
   * @param {number | null} currentUserId
   */
  static processUsersAfterQuery(users, currentUserId = null) {
    users.forEach(user => {
      UsersPostProcessor.processUser(user, currentUserId)
    });
  }

  /**
   *
   * @param {Object[]} comments
   * @param {number} currentUserId
   */
  static processManyComments(comments, currentUserId) {
    const processedComments = CommentsPostProcessor.processManyComments(comments, currentUserId);

    processedComments.forEach(comment => {
      UsersPostProcessor.processModelAuthorForListEntity(comment.User);

      if (comment.organization) {
        OrgPostProcessor.processOneOrgWithoutActivity(comment.organization);
      }
    });

    return processedComments;
  }

  /**
   *
   * @param {Object} comment
   * @param {number} currentUserId
   * @return {Object}
   */
  static processOneComment(comment, currentUserId) {
    const processed = this.processManyComments([comment], currentUserId);

    return processed[0];
  }

  /**
   *
   * @param {Object} model
   * @private
   */
  static _normalizeMultiplier(model) {
    if (typeof model.current_rate === 'undefined') {
      return;
    }

    const multiplier = EosImportance.getImportanceMultiplier();

    model.current_rate = (model.current_rate * multiplier);

    model.current_rate = +model.current_rate.toFixed();
  }


  /**
   *
   * @param {Object} model
   * @param {number} currentUserId
   * @param {Object[]|null}userPostActivity
   * @param {number[]} orgTeamMembers
   */
  static _addMyselfDataForPost(model, currentUserId, userPostActivity, orgTeamMembers = []) {
    if (!currentUserId) {
      return;
    }

    let myselfVote = 'no_vote';
    let join = false;
    let organization_member = false;

    if (model.organization) {
      if (currentUserId === model.organization.user_id) {
        organization_member = true;
      } else {
        organization_member = orgTeamMembers.indexOf(currentUserId) !== -1;
      }
    }

    if (userPostActivity) {
      for (let i = 0; i < userPostActivity.length; i++) {
        const current = userPostActivity[i];

        if (InteractionTypeDictionary.isJoinActivity(current)) {
          join = true;
          continue;
        }

        if (InteractionTypeDictionary.isUpvoteActivity(current)) {
          myselfVote = 'upvote';
        } else if (InteractionTypeDictionary.getDownvoteId() === current.activity_type_id) {
          myselfVote = 'downvote';
        }
      }
    }

    model.myselfData = {
      myselfVote,
      join,
      organization_member
    };
  }

  /**
   *
   * @param {Object} post
   * @private
   */
  static _processPostTeam(post) {
    let teamMembers = [];
    const postUsersTeam = post.post_users_team;

    if (postUsersTeam) {
      postUsersTeam.forEach(teamMember => {
        UsersPostProcessor.processUser(teamMember.User);
        teamMembers.push(teamMember.User);
      });
    }

    post.post_users_team = teamMembers;
  }

}

module.exports = ApiPostProcessor;