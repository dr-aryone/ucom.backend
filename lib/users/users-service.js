"use strict";
/* eslint-disable max-len,you-dont-need-lodash-underscore/filter */
/* tslint:disable:max-line-length */
const errors_1 = require("../api/errors");
const UsersFetchService = require("./service/users-fetch-service");
const UsersRepository = require("./users-repository");
const UserPostProcessor = require("./user-post-processor");
const UsersInputProcessor = require("./validator/users-input-processor");
const EosBlockchainStatusDictionary = require("../eos/eos-blockchain-status-dictionary");
const UsersModelProvider = require("./users-model-provider");
const UpdateManyToManyHelper = require("../api/helpers/UpdateManyToManyHelper");
const UserInputSanitizer = require("../api/sanitizers/user-input-sanitizer");
const _ = require('lodash');
const models = require('../../models');
class UsersService {
    constructor(currentUser) {
        this.currentUser = currentUser;
    }
    /**
     *
     * @param {string} query
     * @returns {Promise<Array<Object>>}
     */
    static async findByNameFields(query) {
        return UsersRepository.findByNameFields(query);
    }
    /**
     *
     * @param {Object} req
     * @return {Promise<void>}
     */
    async processUserUpdating(req) {
        const { body } = req;
        const { files } = req;
        const requestData = UsersInputProcessor.processWithValidation(body);
        // #task #refactor
        for (const field in requestData) {
            if (requestData[field] === '') {
                requestData[field] = null;
            }
        }
        const userId = this.currentUser.id;
        const user = await UsersRepository.getUserById(userId);
        await UsersService.checkUniqueFields(requestData, userId);
        // #task #refactor
        // noinspection OverlyComplexBooleanExpressionJS
        if (files && files.avatar_filename && files.avatar_filename[0] && files.avatar_filename[0].filename) {
            requestData.avatar_filename = files.avatar_filename[0].filename;
        }
        // noinspection OverlyComplexBooleanExpressionJS
        if (files && files.achievements_filename && files.achievements_filename[0] && files.achievements_filename[0].filename) {
            requestData.achievements_filename = files.achievements_filename[0].filename;
        }
        await models.sequelize
            .transaction(async (transaction) => {
            await UsersService.processArrayFields(user, requestData, transaction);
            await UsersRepository.updateUserById(userId, requestData, transaction);
        });
        const userModel = await UsersRepository.getUserById(userId);
        const userJson = userModel.toJSON();
        UserPostProcessor.processUosAccountsProperties(userJson);
        return userJson;
    }
    /**
     * @param {number} userId
     * @returns {Promise<Object>}
     */
    async getUserByIdAndProcess(userId) {
        const currentUserId = this.currentUser.id;
        return UsersFetchService.findOneAndProcessFully(userId, currentUserId);
    }
    static async findOneByAccountName(accountName) {
        const user = await models.Users.findOne({ where: { account_name: accountName } });
        UserPostProcessor.processUser(user);
        return user;
    }
    /**
     * @param {Object} query
     * @return {Promise<Object[]>}
     */
    async findAllAndProcessForList(query) {
        const currentUserId = this.currentUser.id;
        return UsersFetchService.findAllAndProcessForList(query, currentUserId);
    }
    /**
     * @param {string} tagTitle
     * @param {Object} query
     * @return {Promise<Object[]>}
     */
    async findAllAndProcessForListByTagTitle(tagTitle, query) {
        const currentUserId = this.currentUser.id;
        return UsersFetchService.findAllAndProcessForListByTagTitle(tagTitle, query, currentUserId);
    }
    /**
     *
     * @param {Object} user
     * @param {Object} transaction
     * @return {Promise<void>}
     */
    static async setBlockchainRegistrationIsSent(user, transaction) {
        await user.update({
            blockchain_registration_status: EosBlockchainStatusDictionary.getStatusIsSent(),
        }, {
            transaction,
        });
    }
    /**
     *
     * @param {Object} user
     * @param {Object} requestData
     * @param {Object} transaction
     * @return {Promise<void>}
     * @private
     */
    static async processArrayFields(user, requestData, transaction) {
        if (requestData.users_sources) {
            requestData.users_sources = _.filter(requestData.users_sources);
            requestData.users_sources.forEach((source) => {
                source.source_type_id = source.source_type_id ? source.source_type_id : null;
            });
        }
        const arrayFields = [
            'users_education',
            'users_jobs',
            'users_sources',
        ];
        for (const field of arrayFields) {
            if (!requestData[field]) {
                continue;
            }
            const set = _.filter(requestData[field]);
            if (_.isEmpty(set)) {
                continue;
            }
            UserInputSanitizer.sanitizeInputWithModelProvider(set, UsersModelProvider.getFieldsSetByFieldName(field));
            const deltaData = UpdateManyToManyHelper.getCreateUpdateDeleteDelta(user[field], set);
            await UsersService.updateRelations(user, deltaData, field, transaction);
        }
    }
    /**
     *
     * @param {Object} user
     * @param {Object} deltaData
     * @param {string} modelName
     * @param {Object} transaction
     * @return {Promise<boolean>}
     */
    static async updateRelations(user, deltaData, modelName, transaction) {
        // Update addresses
        await Promise.all([
            deltaData.deleted.map(async (data) => {
                await data.destroy({ transaction });
            }),
            deltaData.added.map(async (data) => {
                data.user_id = user.id;
                data.is_official = !!data.is_official;
                const newModel = models[modelName].build(data);
                await newModel.save(); // #task check is transaction work
            }),
            deltaData.changed.map(async (data) => {
                const toUpdate = user[modelName].find(innerData => +innerData.id === +data.id);
                data.is_official = !!data.is_official;
                await toUpdate.update(data, { transaction });
            }),
        ]);
        return true;
    }
    /**
     *
     * @param   {Object} values
     * @param   {number} currentUserId
     * @return  {Promise<void>}
     * @private
     */
    static async checkUniqueFields(values, currentUserId) {
        const uniqueFields = UsersModelProvider.getUsersModel().getUsersUniqueFields();
        const toFind = {};
        uniqueFields.forEach((field) => {
            if (values[field]) {
                toFind[field] = values[field];
            }
        });
        const existed = await UsersRepository.findWithUniqueFields(toFind);
        const errors = [];
        for (const current of existed) {
            if (current.id === currentUserId) {
                // this is model itself
                continue;
            }
            uniqueFields.forEach((field) => {
                if (current[field] && current[field] === toFind[field]) {
                    errors.push({
                        field,
                        message: 'This value is already occupied. You should try another one.',
                    });
                }
            });
        }
        if (errors.length > 0) {
            throw new errors_1.BadRequestError(errors);
        }
    }
}
module.exports = UsersService;
