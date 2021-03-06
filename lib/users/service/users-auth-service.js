"use strict";
const authService = require('../../../lib/auth/authService');
const authValidator = require('../../../lib/auth/validators');
const { BadRequestError, JoiBadRequestError } = require('../../../lib/api/errors');
const eosJsEcc = require('../../../lib/crypto/eosjs-ecc');
const eosApi = require('../../../lib/eos/eosApi');
const usersService = require('../../../lib/users/users-service');
const usersRepository = require('../repository').Main;
const db = require('../../../models').sequelize;
class UsersAuthService {
    /**
     *
     * @param {Object} body
     * @return {Promise<*>}
     */
    static async processNewUserRegistration(body) {
        const requestData = await this.checkRegistrationRequest(body);
        const newUserData = {
            account_name: requestData.account_name,
            nickname: requestData.account_name,
            created_at: new Date(),
            updated_at: new Date(),
            public_key: requestData.public_key,
            private_key: eosApi.getActivePrivateKeyByBrainkey(requestData.brainkey),
            owner_public_key: eosApi.getOwnerPublicKeyByBrainKey(requestData.brainkey),
            is_tracking_allowed: !!requestData.is_tracking_allowed || false,
        };
        const newUser = await db
            .transaction(async (transaction) => {
            const user = await usersRepository.createNewUser(newUserData, transaction);
            await eosApi.transactionToCreateNewAccount(user.account_name, user.owner_public_key, user.public_key);
            await usersService.setBlockchainRegistrationIsSent(user, transaction);
            return user;
        });
        const token = authService.getNewJwtToken(newUser);
        return {
            token,
            user: newUser,
        };
    }
    /**
     *
     * @param {Object} body
     * @return {Promise<Object>}
     * @private
     */
    static async checkRegistrationRequest(body) {
        const { error, value: requestData } = authValidator.validateRegistration(body);
        if (error) {
            throw new JoiBadRequestError(error);
        }
        await authValidator.validateNewAccountName(requestData.account_name);
        if (!eosJsEcc.isValidPublic(requestData.public_key)) {
            throw new BadRequestError({
                public_key: 'Public key is not valid',
            });
        }
        // #task check is public key unique
        if (!eosJsEcc.verify(requestData.sign, requestData.account_name, requestData.public_key)) {
            throw new BadRequestError({
                account_name: 'sign is not valid',
            });
        }
        return requestData;
    }
}
module.exports = UsersAuthService;
