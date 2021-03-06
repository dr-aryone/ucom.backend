import { ListResponse } from '../../common/interfaces/lists-interfaces';
import { RequestQueryDto } from '../../api/filters/interfaces/query-filter-interfaces';
import {
  UosAccountPropertiesValuesDto,
} from '../../uos-accounts-properties/interfaces/model-interfaces';

interface UserModel {
  readonly id: number;
  readonly account_name: string;

  readonly uos_accounts_properties?: UosAccountPropertiesValuesDto

  [index: string]: any
}

interface UserModelCard {
  readonly id: number;
  readonly account_name: string;

  [index: string]: string | number,
}

interface UsersListResponse extends ListResponse {
  data: UserModelResponse[];
}

interface UserModelResponse extends UserModel {
  [index: string]: any;
}


interface UserIdToUserModelCard {
  [index: number]: UserModelCard;
}

interface UsersRequestQueryDto extends RequestQueryDto {
  readonly airdrops?: {
    readonly id: number;
  }
}

export {
  UserModelCard,
  UserModel,
  UserIdToUserModelCard,
  UsersListResponse,
  UsersRequestQueryDto,
};
