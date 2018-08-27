module.exports = (sequelize, DataTypes) => {
  const Posts = sequelize.define('posts', {
    post_type_id: {
      type: DataTypes.STRING,
    },
    title: {
      type: DataTypes.STRING
    },
    description: {
      type: DataTypes.TEXT,
    },
    main_image_filename: {
      type: DataTypes.STRING
    },
    current_vote: {
      type: DataTypes.STRING
    },
    current_rate: {
      type: DataTypes.STRING
    },
    user_id: {
      type: DataTypes.INTEGER
    },
    leading_text: {
      type: DataTypes.TEXT
    },
  }, {
    underscored: true,
    freezeTableName: true,
    tableName: 'posts',
  });
  Posts.associate = function(models) {
  };

  return Posts;
};