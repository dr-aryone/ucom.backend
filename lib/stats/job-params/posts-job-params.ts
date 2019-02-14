import { DeltaParams } from '../interfaces/dto-interfaces';

import PostsModelProvider = require('../../posts/service/posts-model-provider');
import EventParamTypeDictionary = require('../dictionary/event-param/event-param-type-dictionary');
import EventParamGroupDictionary = require('../dictionary/event-param/event-param-group-dictionary');
import EventParamSuperGroupDictionary = require('../dictionary/event-param/event-param-super-group-dictionary');

const paramsSet: DeltaParams[] = [
  {
    entityName:       PostsModelProvider.getEntityName(),

    initialEventType: EventParamTypeDictionary.getCurrentBlockchainImportance(),
    resultEventType:  EventParamTypeDictionary.getBlockchainImportanceDelta(),
    eventGroup:       EventParamGroupDictionary.getNotDetermined(),
    eventSuperGroup:  EventParamSuperGroupDictionary.getNotDetermined(),

    paramField:       'importance',
    paramFieldDelta:  'importance_delta',
    isFloat:          true,
  },
  {
    entityName:       PostsModelProvider.getEntityName(),

    initialEventType: EventParamTypeDictionary.getPostVotesCurrentAmount(),
    resultEventType:  EventParamTypeDictionary.getPostUpvotesDelta(),
    eventGroup:       EventParamGroupDictionary.getNotDetermined(),
    eventSuperGroup:  EventParamSuperGroupDictionary.getNotDetermined(),

    paramField:       'upvotes',
    paramFieldDelta:  'upvotes_delta',
    isFloat:          false,
  },
  {
    entityName:       PostsModelProvider.getEntityName(),

    initialEventType: EventParamTypeDictionary.getPostCurrentActivityIndex(),
    resultEventType:  EventParamTypeDictionary.getPostActivityIndexDelta(),
    eventGroup:       EventParamGroupDictionary.getNotDetermined(),
    eventSuperGroup:  EventParamSuperGroupDictionary.getNotDetermined(),

    paramField:       'activity_index',
    paramFieldDelta:  'activity_index_delta',
    isFloat:          false,
  },
];

class PostsJobParams {
  public static getParamsSet(): DeltaParams[] {
    return paramsSet;
  }
}

export = PostsJobParams;
