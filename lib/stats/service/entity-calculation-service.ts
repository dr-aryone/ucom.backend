/* eslint-disable no-console */
/* tslint:disable:max-line-length */
import { EntityEventRepository } from '../repository/entity-event-repository';
import {
  DeltaParams, EntitiesWithDeltaFields,
  EventDbDataDto,
} from '../interfaces/dto-interfaces';

import { EntityEventParamDto } from '../interfaces/model-interfaces';

import JsonValueService = require('./json-value-service');
import PostsJobParams = require('../job-params/posts-job-params');

const moment = require('moment');

const RATE_DELTA_HOURS_INTERVAL = 2;

const profilingInfo = {};

class EntityCalculationService {
  public static async updateEntitiesDeltas() {
    const paramsSet = PostsJobParams.getParamsSet();

    for (const params of paramsSet) {
      await this.updateEntitiesImportanceDeltas(params);
    }
  }

  private static async updateEntitiesImportanceDeltas(params: DeltaParams): Promise<void> {
    const hrstart = process.hrtime();
    this.printMemoryUsage('before_start');

    const [lastData, lastOfGivenDateData]: [EventDbDataDto[], EventDbDataDto[]] =
      await this.findStatsData(params);

    const totalFetchedAmount = lastData.length + lastOfGivenDateData.length;
    console.log(`Total amount: ${totalFetchedAmount}. Last data length: ${lastData.length}. lastOfGivenDateData length: ${lastOfGivenDateData.length}`);

    const hrend = process.hrtime(hrstart);
    console.log(`Db fetch time: ${hrend[1] / 1000000} ms`);

    this.printMemoryUsage('after_db_fetching', false);
    this.printMemoryDiff('after_db_fetching', 'before_start');

    const toProcess = this.prepareDeltaDataToProcess(
      lastData,
      params.paramField,
      params.isFloat,
    );

    this.calculateDeltaValue(
      toProcess,
      lastOfGivenDateData,
      params.paramField,
      params.isFloat,
    );

    await this.createImportanceDeltaEvents(params, toProcess);

    this.printMemoryUsage('after_to_process_filling', false);
    this.printMemoryDiff('after_to_process_filling', 'after_db_fetching');
  }

  private static async findStatsData(
    params: DeltaParams,
  ): Promise<[EventDbDataDto[], EventDbDataDto[]]> {
    const newData = moment().subtract(RATE_DELTA_HOURS_INTERVAL, 'hours');
    const createdAtAsString = newData.utc().format('YYYY-MM-DD HH:mm:ss');

    return Promise.all([
      EntityEventRepository.findLastRowsGroupedByEntity(
        `event_type = ${params.initialEventType} AND entity_name = '${params.entityName}'`,
      ),
      EntityEventRepository.findLastRowsGroupedByEntity(
        `"event_type" = ${params.initialEventType} AND entity_name = '${params.entityName}' AND created_at < '${createdAtAsString}'`,
      ),
    ]);
  }

  private static prepareDeltaDataToProcess(
    lastData: EventDbDataDto[],
    paramField: string,
    isFloat: boolean,
  ) {
    if (lastData.length === 0) {
      throw new Error('LastData array is empty');
    }

    const toProcess: EntitiesWithDeltaFields = {};
    for (let i = 0; i < lastData.length; i += 1) {
      const current = lastData[i];

      if (toProcess[current.entity_id]) {
        throw new Error(`There is toProcess already for ${current.entity_id}. There are duplications in requests`);
      }

      let lastValue = current.json_value.data[paramField];
      if (isFloat) {
        lastValue = +lastValue.toFixed(10);
      }

      toProcess[current.entity_id] = {
        entity_id:            current.entity_id,
        entity_blockchain_id: current.entity_blockchain_id,
        entity_name:          current.entity_name,
        first_value:          0,
        last_value:           lastValue,
        delta_value:          lastValue,
      };
    }

    return toProcess;
  }

  private static calculateDeltaValue(
    toProcess: EntitiesWithDeltaFields,
    lastOfGivenDateData: EventDbDataDto[],
    paramField: string,
    isFloat: boolean,
  ): void {
    if (lastOfGivenDateData.length === 0) {
      throw new Error('lastOfGivenDateData is empty');
    }

    for (let i = 0; i < lastOfGivenDateData.length; i += 1) {
      const current = lastOfGivenDateData[i];

      const related = toProcess[current.entity_id];

      if (!related) {
        console.error(`There is no such ${current.entity_id} in lastData. Lets think that rate is disappeared. Skipping...`);

        continue;
      }

      if (current.json_value.data.importance < 0) {
        throw new Error(`Importance value is negative for entity ${JSON.stringify(current)}`);
      }

      related.first_value = current.json_value.data[paramField];
      if (isFloat) {
        related.first_value = +related.first_value.toFixed(10);
      }

      related.delta_value = +related.last_value - related.first_value;

      if (isFloat) {
        related.delta_value = +related.delta_value.toFixed(10);
      }
    }
  }

  public static async createImportanceDeltaEvents(
    params: DeltaParams,
    toProcess: EntitiesWithDeltaFields,
  ): Promise<void> {
    const events: EntityEventParamDto[] = [];

    for (const postId in toProcess) {
      if (!toProcess.hasOwnProperty(postId)) {
        continue;
      }
      const stats = toProcess[postId];

      const resultValue = stats.delta_value;
      const payload = {
        [params.paramFieldDelta]: stats.delta_value,
      };

      const description = `${params.entityName} ${params.resultEventType} with window of ${RATE_DELTA_HOURS_INTERVAL} hours`;

      events.push({
        entity_id:            +postId,
        entity_name:          params.entityName,
        entity_blockchain_id: stats.entity_blockchain_id,
        event_type:           params.resultEventType,
        event_group:          params.eventGroup,
        event_super_group:    params.eventSuperGroup,
        json_value:           JsonValueService.getJsonValueParameter(description, payload),
        result_value:         resultValue,
      });
    }

    await EntityEventRepository.insertManyEvents(events);
  }

  private static printMemoryDiff(toLabel, fromLabel) {
    const memoryTo    = profilingInfo[toLabel];
    const memoryFrom  = profilingInfo[fromLabel];

    const res = {};
    for (const key in memoryTo) {
      if (!memoryTo.hasOwnProperty(key)) {
        continue;
      }

      res[key] = `${+memoryTo[key].replace(' MB', '') - +memoryFrom[key].replace(' MB', '')} MB`;
    }

    console.log(`${toLabel} minus ${fromLabel} is: ${JSON.stringify(res, null, 2)}`);
  }

  private static printMemoryUsage(label, toPrint = true) {
    const usedFormatted = {};

    const used = process.memoryUsage();
    for (const key in used) {
      if (!used.hasOwnProperty(key)) {
        continue;
      }

      usedFormatted[key] = `${Math.round(used[key] / 1024 / 1024 * 100) / 100} MB`;
    }

    profilingInfo[label] = usedFormatted;

    if (toPrint) {
      console.log(`${label}: ${JSON.stringify(usedFormatted, null, 2)}`);
    }
  }
}

export = EntityCalculationService;
