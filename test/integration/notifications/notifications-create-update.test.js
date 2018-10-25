const _ = require('lodash');
const gen = require('../../generators');
const orgGen = gen.Org;

const delay = require('delay');

const UsersTeamStatusDictionary = require('../../../lib/users/dictionary').UsersTeamStatus;

const RabbitMqService = require('../../../lib/jobs/rabbitmq-service');

const UsersActivityRepository = require('../../../lib/users/repository').Activity;

const helpers = require('../helpers');

let userVlad;
let userJane;
let userPetr;
let userRokky;

helpers.Mock.mockAllTransactionSigning();
helpers.Mock.mockAllBlockchainJobProducers();

describe('Notifications create-update', () => {
  beforeAll(async () => {
    [userVlad, userJane, userPetr, userRokky] = await helpers.SeedsHelper.beforeAllRoutine();
  });
  afterAll(async () => {
    await helpers.SeedsHelper.sequelizeAfterAll();
  });
  beforeEach(async () => {
    await helpers.SeedsHelper.truncateTable('entity_notifications');
    await RabbitMqService.purgeNotificationsQueue();
    await helpers.SeedsHelper.initUsersOnly();
  });

  describe('Comments related notification', () => {
    describe('Positive', () => {
      it('User creates comment on your comment', async () => {
        const postAuthor = userVlad;
        const commentAuthor = userJane;

        const commentOnCommentAuthor = userVlad;

        const postId      = await gen.Posts.createMediaPostByUserHimself(postAuthor);
        const newComment  = await gen.Comments.createCommentForPost(postId, commentAuthor);

        await gen.Comments.createCommentOnComment(postId, newComment.id, commentOnCommentAuthor);
        delay(50);

        const notification = await helpers.Notifications.requestToGetOnlyOneNotification(userJane);

        const options = {
          postProcessing: 'notification',
        };

        helpers.Common.checkOneNotificationsFromList(notification, options);
      });

      it('User comments your post', async () => {
        const postAuthor = userVlad;
        const commentAuthor = userJane;

        const postId = await gen.Posts.createMediaPostByUserHimself(postAuthor);
        await gen.Comments.createCommentForPost(postId, commentAuthor);
        delay(200);

        const notification = await helpers.Notifications.requestToGetOnlyOneNotification(userVlad);

        const options = {
          postProcessing: 'notification',
        };

        helpers.Common.checkOneNotificationsFromList(notification, options);
      });

      it.skip('Check exact user comments your post notification content', async () => {
        // TODO
      });
    });
  });

  describe('Organizations. Follow', () => {
    describe('Positive', () => {
      it('should create notification - somebody follows your organization', async () => {

        const orgId = await orgGen.createOrgWithoutTeam(userVlad);
        await helpers.Org.requestToFollowOrganization(orgId, userJane);
        delay(200);

        // Check jane notification about org following and also check its structure
        const models = await helpers.Notifications.requestToGetNotificationsList(userVlad);

        const notification = models[0];

        expect(notification).toBeDefined();

        helpers.Common.checkOneNotificationsFromList(notification);
      }, 50000);
    });
    describe('Negative', () => {
      it.skip('No notification for unfollow', async () => {
        // TODO
      });
    });

  });


  describe('Users. Follow', () => {
    describe('Negative', () => {
      it.skip('No notification for unfollow', async () => {
        // TODO
      });
    });
  });

  describe('Organizations. Users team. Team invitation', () => {
    describe('Positive', () => {
      it('Create valid prompt notification when org is created.', async () => {
        const author = userVlad;

        const teamMembers = [
          userJane,
          userPetr
        ];

        const newOrgId = await orgGen.createOrgWithTeam(author, teamMembers);
        await delay(500);

        // assert that all related notifications are created

        const janeNotifications = await helpers.Notifications.requestToGetNotificationsList(userJane);
        // One notification for Jane - join invitation
        expect (janeNotifications.length).toBe(1);

        helpers.Notifications.checkUsersTeamInvitationPromptFromDb(janeNotifications[0], userJane.id, newOrgId, true);

        const petrNotifications = await helpers.Notifications.requestToGetNotificationsList(userPetr);
        // One notification for Petr - join invitation
        expect(petrNotifications.length).toBe(1);

        helpers.Notifications.checkUsersTeamInvitationPromptFromDb(petrNotifications[0], userPetr.id, newOrgId, true);

        const rokkyNotifications = await helpers.Notifications.requestToGetNotificationsList(userRokky);
        // Rokky is not a team member so no notifications
        expect(_.isEmpty(rokkyNotifications)).toBeTruthy();

        const vladNotifications = await helpers.Notifications.requestToGetNotificationsList(userVlad);
        // Vlad himself should not to receive any notifications
        expect(_.isEmpty(vladNotifications)).toBeTruthy();


      }, 10000);

      it.skip('should create valid users activity record related to board invitation', async () => {
        // TODO
      });

      it('should receive notification if board is updated - new members are added', async () => {
        // create notification if user is added to the board after updating

        const author = userVlad;
        const teamMembers = [
          userJane,
          userPetr
        ];

        const newOrgId = await orgGen.createOrgWithTeam(author, teamMembers);

        const newTeamMembers = _.concat(teamMembers, userRokky);

        await orgGen.updateOrgUsersTeam(newOrgId, author, newTeamMembers);

        delay(500);

        const rokkyNotifications = await helpers.Notifications.requestToGetNotificationsList(userRokky);

        expect(rokkyNotifications.length).toBe(1);

        helpers.Notifications.checkUsersTeamInvitationPromptFromDb(rokkyNotifications[0], userRokky.id, newOrgId, true);
      }, 10000);

      it('should properly CONFIRM users team invitation prompt', async () => {
        const author = userVlad;

        const teamMembers = [
          userJane,
          userPetr
        ];

        const newOrgId = await orgGen.createOrgWithTeam(author, teamMembers);
        delay(300); // wait a bit until consumer process the request and creates db record

        const janeNotifications = await helpers.Notifications.requestToGetNotificationsList(userJane);
        const confirmed = await helpers.Notifications.requestToConfirmPrompt(userJane, janeNotifications[0].id);

        const options = {
          myselfData: true
        };

        helpers.Common.checkOneNotificationsFromList(confirmed, options);

        helpers.Notifications.checkUsersTeamInvitationPromptFromDb(
          confirmed,
          userJane.id,
          newOrgId,
          false,
          'confirmed'
        );

        // get organizations board and see that status is confirmed

        const org = await helpers.Org.requestToGetOneOrganizationAsGuest(newOrgId);

        const usersTeam = org.users_team;

        const userJaneMember = usersTeam.find(data => data.id === userJane.id);
        expect(userJaneMember.users_team_status).toBe(UsersTeamStatusDictionary.getStatusConfirmed());
      }, 10000);

      it('should properly DECLINE users team invitation prompt', async () => {
        const author = userVlad;

        const teamMembers = [
          userJane,
          userPetr
        ];

        const newOrgId = await orgGen.createOrgWithTeam(author, teamMembers);
        const petrNotifications = await helpers.Notifications.requestToGetNotificationsList(userPetr);
        const declined = await helpers.Notifications.requestToDeclinePrompt(userPetr, petrNotifications[0].id);

        const options = {
          myselfData: true
        };

        helpers.Common.checkOneNotificationsFromList(declined, options);

        helpers.Notifications.checkUsersTeamInvitationPromptFromDb(
          declined,
          userPetr.id,
          newOrgId,
          false,
          'declined'
        );

        // get organizations board and see that status is confirmed

        const org = await helpers.Org.requestToGetOneOrganizationAsGuest(newOrgId);

        const usersTeam = org.users_team;

        const userPetrMember = usersTeam.find(data => data.id === userPetr.id);
        expect(userPetrMember.users_team_status).toBe(UsersTeamStatusDictionary.getStatusDeclined());
      });

      it.skip('should delete pending notifications if user is deleted from the board', async () => {
        // TODO
      });

      it('should provide users team status of organization', async () => {
        const author = userVlad;
        const teamMembers = [
          userJane,
          userPetr,
          userRokky
        ];

        const newOrgId = await orgGen.createOrgWithTeam(author, teamMembers);

        const org = await helpers.Org.requestToGetOneOrganizationAsGuest(newOrgId);

        const usersTeam = org.users_team;

        usersTeam.forEach(member => {
          expect(member.users_team_status).toBeDefined();
          expect(member.users_team_status).toBe(UsersTeamStatusDictionary.getStatusPending());
        });
      });
    });

    describe('Negative', () => {
      it.skip('not possible to interact with notification does not belong to you', async () => {
        // TODO
      });
    });
  });

  describe('Seen API', () => {

    it('mark prompt notification as seen. Should NOT be finished', async () => {
      const author = userVlad;
      const teamMembers = [userJane, userPetr];

      await orgGen.createOrgWithTeam(author, teamMembers);

      delay(100); // wait a bit until consumer process the request and creates db record
      const janeNotifications = await helpers.Notifications.requestToGetNotificationsList(userJane);

      const seen = await helpers.Notifications.requestToMarkNotificationSeen(userJane, janeNotifications[0].id);

      const options = {
        myselfData: true
      };

      helpers.Common.checkOneNotificationsFromList(seen, options);

      await helpers.Notifications.checkPromptNotificationIsSeenButNotFinished(seen);
    });

    it('mark alert notification as seen. Should be finished', async () => {
      await helpers.Activity.requestToCreateFollow(userVlad, userJane);
      delay(200);

      const janeNotifications = await helpers.Notifications.requestToGetNotificationsList(userJane);

      const seen = await helpers.Notifications.requestToMarkNotificationSeen(userJane, janeNotifications[0].id);

      const options = {
        myselfData: true
      };

      helpers.Common.checkOneNotificationsFromList(seen, options);

      await helpers.Notifications.checkAlertNotificationIsSeen(seen);
    });
  });

  it.skip('should properly count unread_messages_count after seen or prompt answer actions', async () => {
    // TODO
  });

});