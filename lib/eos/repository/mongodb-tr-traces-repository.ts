const blockchainMongoDbClient = require('../service/blockchain-mongodb-client');

const COLLECTION__TRANSACTION_TRACES  = 'transaction_traces';
const COLLECTION__TRANSACTIONS        = 'transactions';
const COLLECTION__BLOCKS              = 'blocks';

const _ = require('lodash');

const blockchainTrTracesDictionary = require('ucom-libs-wallet').Dictionary.BlockchainTrTraces;

const accountNamesToSkip = [
  'uos.holder',
  'accregistrar',

  'eosio',
  'eosio.bpay',
  'eosio.msig',
  'eosio.names',
  'eosio.null',
  'eosio.prods',
  'eosio.ram',
  'eosio.ramfee',
  'eosio.saving',
  'eosio.stake',
  'eosio.token',
  'eosio.vpay',
];

const trTypeToWhere = {
  [blockchainTrTracesDictionary.getTypeTransfer()]: {
    $and: [
      { 'action_traces.act.account': 'eosio.token' },
      { 'action_traces.act.name': 'transfer' },
      { 'action_traces.act.data.from': { $nin: accountNamesToSkip } },
      { 'action_traces.act.data.to':   { $nin: accountNamesToSkip } },
    ],
  },
  [blockchainTrTracesDictionary.getTypeStakeResources()]: {
    $and: [
      { 'action_traces.act.account':       'eosio' },
      { 'action_traces.act.name':          'delegatebw' },
      { 'action_traces.act.name':          { $ne: 'undelegatebw' } },
      { 'action_traces.act.data.from':     { $nin: accountNamesToSkip } },
      { 'action_traces.act.data.receiver': { $nin: accountNamesToSkip } },
    ],
  },
  [blockchainTrTracesDictionary.getTypeUnstakingRequest()]: {
    $and: [
      { 'action_traces.act.account':       'eosio' },
      { 'action_traces.act.name':          'undelegatebw' },
      { 'action_traces.act.name':          { $ne: 'delegatebw' } },
      { 'action_traces.act.data.from':     { $nin: accountNamesToSkip } },
      { 'action_traces.act.data.receiver': { $nin: accountNamesToSkip } },
    ],
  },
  [blockchainTrTracesDictionary.getTypeVoteForBp()]: {
    $and: [
      { 'action_traces.act.account':   'eosio' },
      { 'action_traces.act.name':      'voteproducer' },
      { 'action_traces.act.data.voter': { $nin: accountNamesToSkip } },
    ],
  },
  [blockchainTrTracesDictionary.getTypeBuyRamBytes()]: {
    $and: [
      { 'action_traces.act.account': 'eosio' },
      { 'action_traces.act.name': 'buyrambytes' },
      { 'action_traces.act.data.payer': { $nin: accountNamesToSkip } },
      { 'action_traces.act.data.receiver': { $nin: accountNamesToSkip } },
    ],
  },
  [blockchainTrTracesDictionary.getTypeSellRam()]: {
    $and: [
      { 'action_traces.act.account': 'eosio' },
      { 'action_traces.act.name': 'sellram' },
      { 'action_traces.act.data.account': { $nin: accountNamesToSkip } },
    ],
  },
  [blockchainTrTracesDictionary.getTypeClaimEmission()]: {
    $and: [
      { 'action_traces.act.account': 'uos.calcs' },
      { 'action_traces.act.name': 'withdrawal' },
      { 'action_traces.act.data.account': { $nin: accountNamesToSkip } },
    ],
  },
  [blockchainTrTracesDictionary.getTypeStakeWithUnstake()]: {
    $and: [
      { 'action_traces.act.account':       'eosio' },
      { 'action_traces.act.name':          { $in: ['delegatebw', 'undelegatebw'] } },
      { 'action_traces.act.data.from':     { $nin: accountNamesToSkip } },
      { 'action_traces.act.data.receiver': { $nin: accountNamesToSkip } },
      { action_traces:                  { $size : 2 } },
    ],
  },
  [blockchainTrTracesDictionary.getTypeMyselfRegistration()]: {
    $and: [
      { 'action_traces.act.account':       'eosio' },
      { 'action_traces.act.name':          'newaccount' },
      { 'action_traces.act.data.from':     { $nin: accountNamesToSkip } },
      { 'action_traces.act.data.receiver': { $nin: accountNamesToSkip } },
    ],
  },
};

class MongodbTrTracesRepository {

  /**
   *
   * @returns {Promise<string|null>}
   */
  static async findLastBlockStringDatetime() {
    const collection = await blockchainMongoDbClient.useCollection(COLLECTION__BLOCKS);

    const select = {
      projection: {
        _id: false,
        'block.timestamp': true,
      },
    };

    const lastBlock = await collection.find({}, select).sort({ _id: -1 }).limit(1).toArray();

    return lastBlock ? `${lastBlock[0].block.timestamp}Z` : null;
  }

  /**
   *
   * @param {number} trType
   * @param {number} limit
   * @param {string|null} idGreaterThan
   * @param {string[]|null} transactionIds
   * @returns {Promise<*>}
   */
  static async findTransactionTraces(trType, limit, idGreaterThan = null, transactionIds) {
    const collection = await blockchainMongoDbClient.useCollection(COLLECTION__TRANSACTION_TRACES);

    // where will be changed. In order to have different state for different requests
    // const where = _.cloneDeep(whereTransferTransactions);

    if (!trTypeToWhere[trType]) {
      throw new Error(`There is no where set for mongo for tr_type: ${trType}`);
    }

    const where = _.cloneDeep(trTypeToWhere[trType]);

    if (idGreaterThan) {
      where['$and'].push({ _id: { $gt : idGreaterThan } });
    }

    let docs;
    // for autotests - MVP implementation
    if (transactionIds) {
      docs = await collection.find({
          id: {
            $in: transactionIds,
          },
        },
       ).toArray();
    } else {
      docs = await collection.find(where).sort({ _id: 1 }).limit(limit).toArray();
    }

    const trxIds: any = [];
    docs.forEach((doc) => {
      trxIds.push(doc.id);
    });

    const blockIdToTrxId  = await this.getBlockIdToTrxId(trxIds);
    const blocksData       = await this.getBlockDataByBlockId(blockIdToTrxId);

    for (let i = 0; i < docs.length; i += 1) {
      const doc = docs[i];
      const trxId = doc.id;

      // Service will recognize this situation as "there is no block info for this transaction"
      const blockData = blocksData[trxId] || {};

      doc.block_data = blockData;
    }

    return docs;
  }

  /**
   *
   * @param {Object} blockIdToTrxId
   * @returns {Promise<Object>}
   * @private
   */
  private static async getBlockDataByBlockId(blockIdToTrxId) {
    const collection = await blockchainMongoDbClient.useCollection(COLLECTION__BLOCKS);

    const select = {
      projection: {
        _id: false,

        block_id:           true,
        block_num: true,
        irreversible: true,
        validated: true,

        'block.timestamp':  true,
        'block.producer':  true,
        'block.previous':  true,
      },
    };

    const where = {
      block_id: {
        $in: Object.keys(blockIdToTrxId),
      },
    };

    const blocks = await collection.find(where, select).toArray();

    const result = {};
    for (let i = 0; i < blocks.length; i += 1) {
      const blockSet = blocks[i];

      const trxId = blockIdToTrxId[blockSet.block_id];

      if (!trxId) {
        // Service will recognize this situation as "there is no block info for this transaction"
        continue;
      }

      result[trxId] = {
        block_id:     blockSet.block_id,
        block_num:    blockSet.block_num,
        irreversible: blockSet.irreversible,
        validated:    blockSet.validated,

        executed_at:      blockSet.block.timestamp,
        producer:         blockSet.block.producer,
        previous_block_id: blockSet.block.previous,
      };
    }

    return result;
  }

  /**
   *
   * @param {string[]} trxIds
   * @returns {Promise<string[]>}
   * @private
   */
  private static async getBlockIdToTrxId(trxIds) {
    const collection = await blockchainMongoDbClient.useCollection(COLLECTION__TRANSACTIONS);

    const select = {
      projection: {
        _id: false,
        block_id: true,
        trx_id:   true,
      },
    };

    const where = {
      trx_id: {
        $in: trxIds,
      },
    };

    const data = await collection.find(where, select).toArray();

    const result = {};
    for (let i = 0; i < data.length; i += 1) {
      const current = data[i];
      result[current.block_id] = current.trx_id;
    }

    return result;
  }
}

export = MongodbTrTracesRepository;
