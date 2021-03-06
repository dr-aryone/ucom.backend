import { UserIdToUserModelCard, UserModel } from './interfaces/model-interfaces';
import { OrgModel, OrgModelResponse } from '../organizations/interfaces/model-interfaces';
import { DbParamsDto } from '../api/filters/interfaces/query-filter-interfaces';
import { AppError } from '../api/errors';
import { StringToAnyCollection } from '../common/interfaces/common-types';

import knex = require('../../config/knex');
import PostsModelProvider = require('../posts/service/posts-model-provider');
import PostsRepository = require('../posts/posts-repository');
import UsersModelProvider = require('./users-model-provider');
import RepositoryHelper = require('../common/repository/repository-helper');
import UsersExternalModelProvider = require('../users-external/service/users-external-model-provider');
import AirdropsModelProvider = require('../airdrops/service/airdrops-model-provider');
import ExternalTypeIdDictionary = require('../users-external/dictionary/external-type-id-dictionary');
import UosAccountsModelProvider = require('../uos-accounts-properties/service/uos-accounts-model-provider');
import AirdropsUsersRepository = require('../airdrops/repository/airdrops-users-repository');

const _ = require('lodash');

const models = require('../../models');
const userModelProvider = require('./users-model-provider');

const { Op } = models.Sequelize;
const db = models.sequelize;

const model = userModelProvider.getUsersModel();

const TABLE_NAME = 'Users';
const usersExternal = UsersExternalModelProvider.usersExternalTableName();
const airdropsUsersExternalData = AirdropsModelProvider.airdropsUsersExternalDataTableName();

const taggableRepository = require('../common/repository/taggable-repository');

class UsersRepository {
  public static async findAllAirdropParticipants(
    airdropId: number,
    params: DbParamsDto,
  ) {
    const previewFields = UsersModelProvider.getUserFieldsForPreview();
    const toSelect = RepositoryHelper.getPrefixedAttributes(previewFields, TABLE_NAME);

    toSelect.push(`${airdropsUsersExternalData}.score AS score`);
    toSelect.push(`${usersExternal}.external_login AS external_login`);

    return knex(TABLE_NAME)
      .select(toSelect)
      .innerJoin(usersExternal, `${usersExternal}.user_id`, `${TABLE_NAME}.id`)
      .innerJoin(airdropsUsersExternalData, function () {
        // @ts-ignore
        this.on(`${airdropsUsersExternalData}.users_external_id`, '=', `${usersExternal}.id`)
      })
      .andWhere(`${usersExternal}.external_type_id`, ExternalTypeIdDictionary.github())
      .andWhere(`${airdropsUsersExternalData}.airdrop_id`, airdropId)
      .andWhere(`${airdropsUsersExternalData}.are_conditions_fulfilled`, true)
      .whereNotIn(`${TABLE_NAME}.id`, AirdropsUsersRepository.getAirdropParticipantsIdsToHide())
      .orderByRaw(params.orderByRaw)
      .limit(params.limit)
      .offset(params.offset)
    ;
  }

  public static async findManyAsRelatedToEntity(
    params: DbParamsDto,
    statsFieldName: string,
    relEntityField: string,
    overviewType: string,
    entityName: string,
  ): Promise<OrgModelResponse[]> {
    if (entityName !== PostsModelProvider.getEntityName()) {
      throw new AppError(`Unsupported entity: ${entityName}`, 500);
    }

    const relEntityNotNull = false;
    const { postSubQuery, extraFieldsToSelect } =
      PostsRepository.prepareRelatedEntitySqlParts(overviewType, params, statsFieldName, relEntityField, relEntityNotNull);

    const sql = `
      select "Users"."id"               as "id",
             "Users"."account_name"     as "account_name",
             "Users"."first_name"       as "first_name",
             "Users"."last_name"        as "last_name",
             "Users"."nickname"         as "nickname",
             "Users"."avatar_filename"  as "avatar_filename",
             "Users"."current_rate"     as "current_rate"
             ${extraFieldsToSelect}
      from "Users" INNER JOIN
            ${postSubQuery}
           ON t.${relEntityField} = "Users".id
      ORDER BY t.${statsFieldName} DESC
    `;

    const data = await knex.raw(sql);

    return data.rows;
  }

  public static async countManyUsersAsRelatedToEntity(
    params: DbParamsDto,
    statsFieldName: string,
    relatedEntityField: string,
    overviewType: string,
  ): Promise<number> {
    const relEntityNotNull = false;
    const subQuery = PostsRepository.prepareSubQueryForCounting(
      overviewType,
      relatedEntityField,
      statsFieldName,
      params,
      relEntityNotNull,
    );

    const sql = `
    SELECT COUNT(1) as amount FROM
      (
        ${subQuery}
      ) AS t
    `;

    const res = await knex.raw(sql);

    return +res.rows[0].amount;
  }

  public static async findUserIdsByAccountNames(
    accountNames: string[],
    key: string = 'account_name',
    value: string = 'id',
  ): Promise<any> {
    const data = await knex(TABLE_NAME)
      .select(['id', 'account_name'])
      .whereIn('account_name', accountNames);

    const result = {};
    data.forEach((user) => {
      result[user[key]] = user[value];
    });

    return result;
  }

  public static async findUserIdsByObjectIndexedByAccountNames(
    indexedObject: StringToAnyCollection,
    key: string = 'account_name',
    value: string = 'id',
  ): Promise<any> {
    return this.findUserIdsByAccountNames(
      Object.keys(indexedObject),
      key,
      value,
    );
  }

  /**
   *
   * @param {Object} data
   * @param {Object} transaction
   * @return {Promise<data>}
   */
  static async createNewUser(data, transaction) {
    return model.create(data, {
      transaction,
    });
  }

  /**
   *
   * @param {Object} fieldsValues
   * @return {Promise<Object>}
   */
  static async findWithUniqueFields(fieldsValues) {
    const opOrConditions: any = [];

    for (const property in fieldsValues) {
      if (fieldsValues.hasOwnProperty(property)) {
        opOrConditions.push({
          [property]: fieldsValues[property],
        });
      }
    }

    const attributes = Array.prototype.concat(Object.keys(fieldsValues), ['id']);

    return model.findAll({
      attributes,
      where: {
        [Op.or]: opOrConditions,
      },
      raw: true,
    });
  }

  /**
   *
   * @param {number} id
   * @param {Object} data
   * @param {Object} transaction
   * @return {Promise<*>}
   */
  static async updateUserById(id, data, transaction) {
    return model.update(data, {
      transaction,
      where: {
        id,
      },
    });
  }

  /**
   *
   * @param {number} id
   * @returns {Promise<string>}
   */
  static async findAccountNameById(id) {
    const result = await this.getModel().findOne({
      attributes: ['account_name'],
      where: { id },
      raw: true,
    });

    return result ? result.account_name : null;
  }

  /**
   *
   * @param {number} userId
   * @return {Promise<Object>}
   */
  static async getUserWithPreviewFields(userId) {
    const attributes = model.getFieldsForPreview();

    const sql = `SELECT ${attributes.join(', ')} FROM "${TABLE_NAME}" WHERE id = ${+userId}`;

    const res = await db.query(sql, { type: db.QueryTypes.SELECT });

    return res[0];
  }

  /**
   *
   * @param {number} userId
   * @returns {Promise<any>}
   */
  static async getUserById(userId) {
    // const followerAttributes = this.getModel().getFieldsForPreview();

    // Get user himself
    // Get user following data with related users

    const include = [
      {
        model: models[UosAccountsModelProvider.uosAccountsPropertiesTableNameWithoutSchema()],
        attributes: UosAccountsModelProvider.getFieldsToSelect(),
        required: false,
        as: 'uos_accounts_properties',
      },
      {
        model: models.users_education,
        as: 'users_education',
      },
      {
        model: models.users_jobs,
        as: 'users_jobs',
      },
      {
        model: models.users_sources,
        as: 'users_sources',
      },
    ];

    return models.Users.findOne({
      include,
      where: {
        id: userId,
      },
      order: [
        ['users_education', 'id', 'ASC'],
        ['users_jobs', 'id', 'ASC'],
        ['users_sources', 'source_type_id', 'ASC'],
      ],
    });
  }

  /**
   *
   * @param {number} id
   * @return {Promise<Object>}
   */
  static async findOnlyItselfById(id) {
    return userModelProvider.getUsersModel().findOne({
      where: { id },
      raw: true,
    });
  }

  /**
   *
   * @param {Object} where
   * @return {Promise<Object>}
   */
  static async findOneBy(where) {
    // #task custom include based on parameter as in OrganizationRepository
    const result = await this.getModel().findOne({
      where,
    });

    return result ? result.toJSON() : null;
  }

  /**
   *
   * @param {string} query
   * @returns {Promise<Array<Object>>}
   */
  public static async findByNameFields(query) {
    const where = this.getSearchUserQueryWhere(query);

    // noinspection JSUnusedGlobalSymbols
    return this.getModel().findAll({
      attributes: this.getModel().getFieldsForPreview(),
      where,
      raw: true,
    });
  }

  static async findOneById(userId) {
    return this.getModel().findOne({
      where: {
        id: userId,
      },
    });
  }

  static async findManyUsersByIdForCard(ids: number[]): Promise<UserIdToUserModelCard> {
    // noinspection TypeScriptValidateJSTypes
    const data: OrgModel[] = await this.getModel().findAll({
      attributes: this.getModel().getFieldsForPreview(),
      where: {
        id: {
          [Op.in]: ids,
        },
      },
      raw: true,
    });

    const res: UserIdToUserModelCard = {};

    data.forEach((item) => {
      // @ts-ignore
      res[item.id] = item;
    });

    return res;
  }

  static async findOneByIdForPreview(id: number): Promise<UserModel | null> {
    return this.getModel().findOne({
      attributes: this.getModel().getFieldsForPreview(),
      where: { id },
      raw: true,
    });
  }

  static async findOneByIdAsObject(
    userId: number,
  ): Promise<any> {
    return this.getModel().findOne({
      where: {
        id: userId,
      },
      raw: true,
    });
  }

  static async findOneByAccountNameAsObject(
    accountName: string,
  ): Promise<any> {
    return this.getModel().findOne({
      where: {
        account_name: accountName,
      },
      raw: true,
    });
  }

  /**
   *
   * @param {number} id
   * @returns {Promise<boolean>}
   */
  static async doesUserExistWithId(
    id: number,
  ): Promise<boolean> {
    const count = await this.getModel().count({
      where: {
        id,
      },
    });

    return !!count;
  }

  static async doesUserExistWithAccountName(
    accountName: string,
  ): Promise<boolean> {
    const count = await this.getModel().count({
      where: {
        account_name: accountName,
      },
    });

    return !!count;
  }

  public static async findAllWhoTrustsUser(
    userId: number,
    params: DbParamsDto,
  ) {
    const previewFields = UsersModelProvider.getUserFieldsForPreview();
    const toSelect = RepositoryHelper.getPrefixedAttributes(previewFields, TABLE_NAME);

    const usersActivityTrust = UsersModelProvider.getUsersActivityTrustTableName();

    return knex(TABLE_NAME)
      .select(toSelect)
      .where({
        [`${usersActivityTrust}.entity_id`]: userId,
        [`${usersActivityTrust}.entity_name`]: UsersModelProvider.getEntityName(),
      })
      .innerJoin(`${usersActivityTrust}`, `${usersActivityTrust}.user_id`, `${TABLE_NAME}.id`)
      .orderByRaw(params.orderByRaw)
      .limit(params.limit)
      .offset(params.offset);
  }

  /**
   *
   * @param {Object} queryParameters
   * @returns {Promise}
   */
  static async findAllForList(queryParameters) {
    const params = _.defaults(queryParameters, this.getDefaultListParams());
    params.attributes = this.getModel().getFieldsForPreview();

    return model.findAll(params);
  }

  /**
   *
   * @param {string} tagTitle
   * @param {Object} givenParams
   * @returns {Promise<Knex.QueryBuilder>}
   */
  static async findAllByTagTitle(tagTitle, givenParams) {
    const params = _.defaults(givenParams, this.getDefaultListParams());

    params.attributes = this.getModel().getFieldsForPreview();
    params.main_table_alias = 't';
    const tagsJoinColumn = 'user_id';

    return taggableRepository.findAllByTagTitle(TABLE_NAME, tagTitle, tagsJoinColumn, params);
  }

  /**
   *
   * @param {string} tagTitle
   * @returns {Promise<Knex.QueryBuilder>}
   */
  static async countAllByTagTitle(tagTitle) {
    const tagsJoinColumn = 'user_id';

    return taggableRepository.countAllByTagTitle(TABLE_NAME, tagTitle, tagsJoinColumn);
  }

  /**
   *
   * @returns {{}}
   */
  static getOrderByRelationMap() {
    return {};
  }

  /**
   *
   * @returns {string[]}
   */
  static getAllowedOrderBy() {
    return [
      'id',
      'current_rate',
      'created_at',
      'account_name',
      'score',
      'external_login',
    ];
  }

  static getWhereProcessor(): Function {
    return (query, params) => {
      params.where = {};

      if (query.user_name) {
        params.where = this.getSearchUserQueryWhere(query.user_name);
      }
    };
  }

  public static async countAll(params): Promise<number> {
    const where = params ? params.where : {};

    return UsersRepository.getModel().count({
      where,
    });
  }

  /**
   * @param {boolean} isRaw
   * @return {Promise<*>}
   */
  static async findAll(isRaw = false) {
    const attributes = this.getModel().getFieldsForPreview();
    const modelResult = await models.Users.findAll({
      attributes,
      order: [
        ['current_rate', 'DESC'],
      ],
    });

    if (isRaw) {
      return modelResult.map(data => data.toJSON());
    }

    return modelResult;
  }

  static async getUserByAccountName(accountName) {
    return models.Users.findOne({
      where: {
        account_name: accountName,
      },
      include: [{
        model: models.users_education,
        as: 'users_education',
      }, {
        model: models.users_jobs,
        as: 'users_jobs',
      }, {
        model: models.users_sources,
        as: 'users_sources',
      }],
      order: [
        ['users_education', 'id', 'ASC'],
        ['users_jobs', 'id', 'ASC'],
        ['users_sources', 'source_type_id', 'ASC'],
      ],
    });
  }

  static async findAllWithRates() {
    const rows = await models.Users.findAll({
      where: {
        current_rate: {
          [Op.gt]: 0,
        },
      },
      order: [
        ['current_rate', 'DESC'],
        ['id', 'DESC'],
      ],
    });

    return rows.map(row => row.toJSON());
  }

  public static getDefaultListParams() {
    return {
      where: {},
      offset: 0,
      limit: 200,
      order: this.getDefaultOrderBy(),
      raw: true,
    };
  }

  static getDefaultOrderBy() {
    return [
      ['current_rate', 'DESC'],
      ['id', 'DESC'],
    ];
  }

  /**
   *
   * @return {string}
   */
  static getUsersModelName() {
    return TABLE_NAME;
  }

  static getModel() {
    return models.Users;
  }

  private static getSearchUserQueryWhere(query: string) {
    return {
      [Op.or]: {
        account_name: {
          [Op.iLike]: `%${query}%`,
        },
        first_name: {
          [Op.iLike]: `%${query}%`,
        },
        last_name: {
          [Op.iLike]: `%${query}%`,
        },
      },
    };
  }
}

export = UsersRepository;
