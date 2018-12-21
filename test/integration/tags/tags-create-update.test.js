const helpers = require('../helpers');
const gen     = require('../../generators');

let userVlad, userJane, userPetr, userRokky;

helpers.Mock.mockAllBlockchainPart();

const _ = require('lodash');

const UsersActivityRepository = require('../../../lib/users/repository/users-activity-repository.js');
const Processor = require('../../../lib/posts/service/post-activity-processor.js');
const TagsParser = require('../../../lib/tags/service/tags-parser-service.js');

describe('Create-update tags', () => {
  beforeAll(async () => {
    [userVlad, userJane, userPetr, userRokky] = await helpers.SeedsHelper.beforeAllRoutine();
  });

  beforeEach(async () => {
    await helpers.Seeds.destroyTables();
    await helpers.Seeds.initUsersOnly();
  });

  afterAll(async () => { await helpers.Seeds.doAfterAll(); });


  describe('Tags parser', () => {
    it('Tags parser basic checks', async () => {
      const data = {
        '#null#null## hello there! I am amazing' : ['null'],
        '#null#undefined#undefined# hello there! I am #amazing #1tool:)' : ['null', 'undefined', 'amazing'],
      };

      for (const input in data) {
        const expected = data[input];
        const actual = TagsParser.parseTags(input);

        expect(actual.length).toBe(expected.length);
        expect(actual).toMatchObject(expected);
      }
    })
  });

  it('Process post with tags without consumer', async () => {
    const user = userVlad;

    const values = {
      description: '#hello there! I am #amazing',
    };

    await gen.Posts.createMediaPostByUserHimself(user, values);
    const activity = await UsersActivityRepository.findLastByUserId(user.id);

    await Processor.processOneActivity(activity.id);

    // TODO check records exist


  });

  it.skip('If no tags - do nothing', async () => {
    // TODO
  });

  it.skip('Process only one tag', async () => {
    // TODO
  });

  it.skip('Process many tags', async () => {
    // TODO
  });
});
