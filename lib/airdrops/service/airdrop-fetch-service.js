"use strict";
const AirdropsFetchRepository = require("../repository/airdrops-fetch-repository");
const moment = require("moment");
const UsersFetchService = require("../../users/service/users-fetch-service");
const AirdropsModelProvider = require("./airdrops-model-provider");
class AirdropFetchService {
    static async addDataForGithubAirdropOffer(post, currentUserId, usersRequestQuery) {
        const state = await AirdropsFetchRepository.getAirdropStateByPostId(post.id);
        const usersTeam = await UsersFetchService.findAllAirdropParticipants(usersRequestQuery, currentUserId);
        const tokens = [];
        state.tokens.forEach((item) => {
            tokens.push({
                amount_claim: item.amount_claim / (10 ** item.precision),
                amount_left: item.amount_left / (10 ** item.precision),
                symbol: item.symbol,
            });
        });
        post.started_at = moment(state.startedAt).utc().format();
        post.finished_at = moment(state.finishedAt).utc().format();
        post.post_offer_type_id = 1; // #task - reserved for future uses
        post.users_team = usersTeam;
        const conditions = {};
        for (const condition in state.conditions) {
            if (condition !== 'source_table_name') {
                conditions[condition] = state.conditions[condition];
            }
        }
        state.conditions.zero_score_incentive_tokens_amount /= AirdropsModelProvider.getHardcodedCurrencyPrecision();
        post.offer_data = {
            airdrop_id: state.airdropId,
            conditions,
            tokens,
        };
    }
}
module.exports = AirdropFetchService;
