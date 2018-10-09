const TABLE_NAME = 'comments';

module.exports = (db, Sequelize) => {
  const Model = db.define(TABLE_NAME, {
    description: {
      type: Sequelize.TEXT,
      allowNull: false,
      required: true,
    },
    current_vote: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    path: {
      type: Sequelize.JSONB,
      allowNull: true,
    },
    commentable_id: {
      type: Sequelize.INTEGER,
      allowNull: false
    },
    blockchain_status: {
      type: Sequelize.INTEGER,
      allowNull: false,
      defaultValue: 0
    },
    blockchain_id: {
      type: Sequelize.STRING,
      allowNull: true,
    },
    parent_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    user_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    depth: {
      type: Sequelize.INTEGER,
      allowNull: true,
    },
    organization_id: {
      type: Sequelize.INTEGER,
      allowNull: true,
      required: false
    }
  }, {
    underscored: true,
    freezeTableName: true,
    tableName: TABLE_NAME,
  });

  Model.associate = function(models) {
    models[TABLE_NAME].belongsTo(models['organizations'], {foreignKey: 'organization_id'});

    models[TABLE_NAME].belongsTo(models.Users, {foreignKey: 'user_id'});
    models[TABLE_NAME].belongsTo(models['posts'], {foreignKey: 'commentable_id'});
    models[TABLE_NAME].hasMany(models['activity_user_comment'], {
      foreignKey: 'comment_id_to',
      as: {
        singular: 'activity_user_comment',
        plural: 'activity_user_comment',
      }
    });
  };


  Model.prototype.getPathAsJson = function() {
    return JSON.parse(this.path);
  };

  Model.getFieldsForPreview = function () {
    return [
      'id',
      'description',
      'current_vote',
      'path',
      'parent_id',
      'depth',
      'created_at',
      'updated_at',
      'organization_id',
      'user_id'
    ];
  };

  Model.apiResponseFields = function() {
    return [
      'id',
      'description',
      'current_vote',
      'path',
      'parent_id',
      'depth',
      'created_at',
      'updated_at',
      'User',
      'organization',
      'organization_id'
    ];
  };

  /**
   *
   * @param {number} maxDepth
   * @returns {number}
   */
  Model.prototype.getPathAsNumber = function(maxDepth) {
    let expectedPathAsArray = JSON.parse(this.path);

    const zerosToAdd = (maxDepth + 1) - expectedPathAsArray.length;

    for (let i = 0; i < zerosToAdd; i++) {
      expectedPathAsArray.push(0);
    }

    return +expectedPathAsArray.join('');
  };

  /**
   *
   * @param {number} maxDepth
   * @returns {Object}
   */
  Model.prototype.toApiResponseJson = function(maxDepth) {
    let result = {};
    Model.apiResponseFields().forEach(attribute => {
      result[attribute] = this[attribute];
    });

    result['User'] = result['User'].toJSON();

    result['path'] = JSON.parse(result['path']);

    return result;
  };

  return Model;
};