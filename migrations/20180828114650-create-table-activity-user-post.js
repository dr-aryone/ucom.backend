const TABLE_NAME = 'activity_user_post';

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.createTable(TABLE_NAME, {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      activity_type_id: {
        type: Sequelize.INTEGER,
        allowNull: false
      },
      created_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      },
      updated_at: {
        allowNull: false,
        type: Sequelize.DATE,
        defaultValue: Sequelize.fn('NOW')
      }
    }).then(() => {
      return queryInterface.addColumn(TABLE_NAME, 'user_id_from', {
          type: Sequelize.INTEGER,
          required: true,
          allowNull: false,
          references: { model: 'Users', key: 'id' }
        }
      );
    })
      .then(() => {
        return queryInterface.addColumn(TABLE_NAME, 'post_id_to', {
            type: Sequelize.INTEGER,
            required: true,
            allowNull: false,
            references: { model: 'posts', key: 'id' }
          }
        );
      })
      .catch((err) => {
        throw new Error(err);
      });
  },

  down: (queryInterface) => {
    return queryInterface.dropTable(TABLE_NAME);
  }
};
