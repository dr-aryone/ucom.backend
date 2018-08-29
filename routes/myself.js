const express = require('express');
const router = express.Router();
const UsersValidator = require('../lib/validator/users-validator');
const _ = require('lodash');
const UsersRepository = require('../lib/users/users-repository');
const UserService = require('../lib/users/users-service');
const models = require('../models');
const authTokenMiddleWare = require('../lib/auth/auth-token-middleware');
const { cpUpload } = require('../lib/users/avatar-upload-middleware');

router.get('/', [authTokenMiddleWare], async function(req, res) {
  const user = await UserService.getUserById(req['user'].id);

  res.send(user)
});

router.patch('/', [authTokenMiddleWare, cpUpload], async function(req, res) {
  const parameters = _.pick(req.body, UsersValidator.getFields());


  // TODO #refactor
  for (const param in parameters) {
    if (parameters[param] === '') {
      parameters[param] = null;
    }
  }

  const files = req['files'];

  // TODO #refactor
  if (files && files['avatar_filename'] && files['avatar_filename'][0] && files['avatar_filename'][0].filename) {
    parameters['avatar_filename'] = files['avatar_filename'][0].filename;
  }

  if (files && files['achievements_filename'] && files['achievements_filename'][0] && files['achievements_filename'][0].filename) {
    parameters['achievements_filename'] = files['achievements_filename'][0].filename;
  }

  const usersEducation = req.body['users_education'];
  const usersJobs = req.body['users_jobs'];
  const usersSources = req.body['users_sources'];

  let user = await UsersRepository.getUserById(req['user'].id);

  if (usersEducation) {
    const educationDelta = getDelta(user.users_education, usersEducation);
    await updateRelations(user, educationDelta, 'users_education')
  }

  if (usersJobs) {
    const delta = getDelta(user.users_jobs, usersJobs);
    await updateRelations(user, delta, 'users_jobs')
  }

  if (usersSources) {
    const delta = getDelta(user['users_sources'], usersSources);
    await updateRelations(user, delta, 'users_sources');
  }

  // TODO #refactor update user in one transaction not in both

  req['user'].validate()
    .then(() => {
      return req['user'].update({
        ...parameters
      });
    })
    .then(() => {
      return UsersRepository.getUserById(req['user'].id);
    })
    .then((user) => {
      res.send(user);
    })
    .catch((err) => {
      let errorResponse = [];

      err.errors.forEach((error) => {
        errorResponse.push({
          'field': error.path,
          'message': error.message,
        });
      });

      res.status(400).send({
        'errors': errorResponse
      });
    });
});

async function updateRelations(user, deltaData, modelName, userData) {
  await models.sequelize
    .transaction(async transaction => {

      // Update addresses
      await Promise.all([
        deltaData.deleted.map(async data => {
          await data.destroy({ transaction });
        }),

        deltaData.added.map(async data => {

          data['user_id'] = user.id;

          let newModel = models[modelName].build(data);
          await newModel.save(); // TODO check is transaction work
        }),

        deltaData.changed.map(async data => {
          const toUpdate = user[modelName].find(_data => _data.id === data.id);
          await toUpdate.update(data, { transaction });
        })
      ]);

      if (userData) {
        return await user.update(userData, { transaction });
      }

      return true;
    })
}


function getDelta(source, updated) {
  const added = updated.filter((updatedItem) => {

    if (!updatedItem.hasOwnProperty('id')) {
      return true;
    }

    return source.find(sourceItem => sourceItem.id === updatedItem.id) === undefined
  });

  const changed = updated.filter(
    sourceItem => source.find(updatedItem => updatedItem.id === sourceItem.id) !== undefined
  );

  const deleted = source.filter(
    sourceItem => updated.find(updatedItem => updatedItem.id === sourceItem.id) === undefined
  );

  // console.log(JSON.stringify(added, null, 2));
  // console.log(JSON.stringify(changed, null, 2));
  // console.log(JSON.stringify(deleted, null, 2));

  return {
    added,
    changed,
    deleted
  };
}

module.exports = router;