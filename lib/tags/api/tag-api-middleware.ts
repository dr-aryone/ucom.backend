import { Request, Response } from 'express';
const { BadRequestError } = require('../../../lib/api/errors');

const tagsRepository = require('../repository/tags-repository');

class TagApiMiddleware {
  // noinspection JSUnusedGlobalSymbols
  /**
   *
   * @param {Request} req
   * @param {Response} res
   * @param {Function} next
   * @param {string} incomingValue
   */
  public static async tagIdentityParam(
    req: Request,
    // @ts-ignore
    res: Response,
    next: Function,
    incomingValue: string,
  ) {
    try {
      if (!incomingValue) {
        throw new BadRequestError({
          tag_title: `Tag title must be a valid string. Provided value: ${incomingValue}`,
        });
      }

      const dbTag = await tagsRepository.findOneByTitle(incomingValue);

      if (dbTag === null) {
        throw new BadRequestError({
          tag_title: `There is no tag with title: ${incomingValue}`,
        },                        404);
      }

      req.tag_identity  = incomingValue;
      req.db_tag        = dbTag;

      next();
    } catch (err) {
      next(err);
    }
  }
}

export = TagApiMiddleware;