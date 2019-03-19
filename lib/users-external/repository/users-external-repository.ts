import { UserExternalModel } from '../interfaces/model-interfaces';

import knex = require('../../../config/knex');
import UsersExternalModelProvider = require('../service/users-external-model-provider');
import RepositoryHelper = require('../../common/repository/repository-helper');

const TABLE_NAME = UsersExternalModelProvider.usersExternalTableName();

class UsersExternalRepository {
  public static async setUserId(id: number, userId: number): Promise<void> {
    await knex(TABLE_NAME)
      .where('id', '=', id)
      .update({ user_id: userId })
    ;
  }

  public static async upsertExternalUser(
    externalTypeId: number,
    externalId: number,
    externalLogin: string,
    jsonValue: any,
    user_id: number | null,
  ): Promise<number> {
    const sql = `
      INSERT INTO ${TABLE_NAME} (external_type_id, external_id, external_login, json_value, user_id) VALUES
      (${+externalTypeId}, ${+externalId}, '${externalLogin}', '${JSON.stringify(jsonValue)}', ${user_id})
      ON CONFLICT (external_type_id, external_id) DO
      UPDATE
          SET json_value        = EXCLUDED.json_value,
              updated_at        = EXCLUDED.updated_at,
              external_login    = EXCLUDED.external_login
              
      RETURNING id;
    ;
    `;

    const res = await knex.raw(sql);

    return +res.rows[0].id;
  }

  public static async findExternalUserByExternalId(
    id: number,
  ): Promise<UserExternalModel | null> {
    const where = {
      external_id: id,
    };

    const res = await  knex(TABLE_NAME)
      .where(where)
      .first()
    ;

    if (!res) {
      return null;
    }

    RepositoryHelper.convertStringFieldsToNumbers(res, this.getNumericalFields());

    return res;
  }

  public static async findExternalUserByPkId(
    id: number,
  ): Promise<UserExternalModel | null> {
    const where = {
      id,
    };

    const res = await knex(TABLE_NAME)
      .where(where)
      .first()
    ;

    if (!res) {
      return null;
    }

    RepositoryHelper.convertStringFieldsToNumbers(res, this.getNumericalFields());

    return res;
  }

  private static getNumericalFields(): string[] {
    return [
      'id',
    ];
  }
}

export = UsersExternalRepository;
