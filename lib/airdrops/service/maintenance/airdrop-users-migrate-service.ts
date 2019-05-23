import { IAirdrop } from '../../interfaces/model-interfaces';
import { CurrentUserDataDto } from '../../../auth/interfaces/auth-interfaces-dto';
import { AppError } from '../../../api/errors';

import AirdropsUsersExternalDataRepository = require('../../repository/airdrops-users-external-data-repository');
import EnvHelper = require('../../../common/helper/env-helper');
import AirdropUsersService = require('../airdrop-users-service');
import AirdropsFetchRepository = require('../../repository/airdrops-fetch-repository');

class AirdropUsersMigrateService {
  public static async migrateFromFirstRoundToSecond(
    firstRoundAirdropId: number,
    secondRoundAirdropId: number,
  ) {
    const airdropsUsersIds: number[] =
      await AirdropsUsersExternalDataRepository.getAllAirdropUsersByAirdropId(
        firstRoundAirdropId,
        this.getUsersExternalDataBlacklistedIds(),
      );

    if (airdropsUsersIds.length === 0) {
      throw new AppError('AirdropsUsers array for migrate must be filled');
    }

    const airdrop: IAirdrop = await AirdropsFetchRepository.getAirdropByPk(secondRoundAirdropId);

    for (const userId of airdropsUsersIds) {
      const currentUserDto: CurrentUserDataDto = {
        currentUser: {
          id: userId,
        },
        userExternal: null,
      };

      // @ts-ignore
      const userData = await AirdropUsersService.getUserAirdropData(currentUserDto, airdrop);
      const externalDataUser = await AirdropsUsersExternalDataRepository.getOneByUserId(userId);

      await AirdropsUsersExternalDataRepository.makeAreConditionsFulfilledTruthy(externalDataUser.users_external_id);



      // @ts-ignore
      const dsdas= 0;
      /*
      // TODO
      * make are conditions fulfilled truthy
      * process personal_statuses
          * IF score is zero THEN {10, 11, 20, 30}
          * ELSE {10, 11, 30}
      Note: in the future a pending worker will process them appropriately
       */
    }
  }

  private static getUsersExternalDataBlacklistedIds(): number[] {
    if (EnvHelper.isStagingEnv()) {
      return [1, 2, 25, 3, 4, 12, 13, 20, 22, 23, 27, 28, 29, 32, 33, 36, 39, 45, 42, 49, 43, 46, 44, 47, 53, 52, 51, 54, 56, 57, 66, 59, 60, 61, 68, 64, 65, 69, 70, 76, 75, 78, 80];
    }

    return [];
  }
}

export = AirdropUsersMigrateService;
