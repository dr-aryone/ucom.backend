const TABLE_NAME = 'organizations';
const moment = require('moment');

const _ = require('lodash');

module.exports = (db, Sequelize) => {
  const Model = db.define(TABLE_NAME, {
    avatar_filename: {
      type: Sequelize.STRING,
    },
    title: {
      type: Sequelize.STRING,
    },
    currency_to_show: {
      type: Sequelize.STRING,
    },
    powered_by: {
      type: Sequelize.STRING,
    },
    about: {
      type: Sequelize.TEXT,
    },
    nickname: {
      type: Sequelize.STRING,
    },
    email: {
      type: Sequelize.STRING,
    },
    phone_number: {
      type: Sequelize.STRING,
    },
    country: {
      type: Sequelize.STRING,
    },
    city: {
      type: Sequelize.STRING,
    },
    address: {
      type: Sequelize.STRING,
    },
    personal_website_url: {
      type: Sequelize.STRING,
    },
    created_at: {
      type: Sequelize.DATE,
    },
    updated_at: {
      type: Sequelize.DATE,
    }
  }, {
    underscored: true,
    freezeTableName: true,
    tableName: TABLE_NAME,
  });

  /**
   *
   * @returns {string[]}
   */
  Model.getFieldsForPreview = function () {
    return [
      'id',
      'title',
      'avatar_filename',
      'nickname'
    ];
  };

  Model.getHtmlFields = function () {
    return [];
  };

  Model.getSimpleTextFields = function () {
    return [
      'title',
      'currency_to_show',
      'powered_by',
      'about',
      'nickname',
      'email',
      'phone_number',
      'country',
      'city',
      'address',
      'personal_website_url',
      ''
    ];
  };

  Model.associate = function(models) {
    models[TABLE_NAME].belongsTo(models['Users'], {foreignKey: 'user_id'});

    // models[TABLE_NAME].hasMany(models['activity_user_post'], {foreignKey: 'post_id_to'});
    // models[TABLE_NAME].hasMany(models['post_users_team'], {
    //   foreignKey: 'post_id',
    //   as: {
    //     singular: "post_users_team",
    //     plural: "post_users_team"
    //   }
    // });
  };

  return Model;
};