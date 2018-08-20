const express = require('express');
const router = express.Router();
const passport = require('passport');
const UsersValidator = require('../lib/validator/users-validator');
const _ = require('lodash');

router.get('/', passport.authenticate('jwt', {session: false}), async function(req, res, next) {
  res.send(req.user)
});


router.patch('/', passport.authenticate('jwt', {session: false}), async function(req, res, next) {
  const parameters = _.pick(req.body, UsersValidator.getFields());

  req.user.validate()
    .then((res) => {
      return req.user.update({
        ...parameters
      });
    })
    .then((user) => {
      res.send(req.user);
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

module.exports = router;