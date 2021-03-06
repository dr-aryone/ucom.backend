import { CheckManyObjectsOptionsDto, ObjectInterfaceRulesDto } from '../../interfaces/options-interfaces';
import { ListResponse } from '../../../lib/common/interfaces/lists-interfaces';

const _ = require('lodash');

require('jest-expect-message');

class CommonChecker {
  public static expectNotEmpty(object: any) {
    expect(_.isEmpty(object)).toBeFalsy();
  }

  public static expectOnlyOneArrayItemForTheList(object: ListResponse) {
    expect(object.data.length).toBe(1);
    expect(object.metadata.total_amount).toBe(1);
    expect(object.metadata.has_more).toBe(false);
  }

  public static expectOnlyTwoArrayItemForTheList(object: ListResponse) {
    expect(object.data.length).toBe(2);
    expect(object.metadata.total_amount).toBe(2);
    expect(object.metadata.has_more).toBe(false);
  }

  public static checkArrayOfObjectsInterface(
    manyActualObjects: any[],
    objectInterfaceRules: ObjectInterfaceRulesDto,
    options: CheckManyObjectsOptionsDto,
  ): void {
    expect(Array.isArray(manyActualObjects)).toBeTruthy();

    this.expectNotEmpty(manyActualObjects);

    for (const oneObject of manyActualObjects) {
      this.checkOneObjectInterface(oneObject, objectInterfaceRules, options);
    }
  }

  public static checkOneObjectInterface(
    oneObject: any,
    objectInterfaceRules: ObjectInterfaceRulesDto,
    options: CheckManyObjectsOptionsDto,
  ) {
    this.expectNotEmpty(oneObject);

    if (options.exactKeysAmount) {
      expect(Object.keys(oneObject).sort()).toEqual(Object.keys(objectInterfaceRules).sort());
    }

    for (const key in objectInterfaceRules) {
      if (!objectInterfaceRules.hasOwnProperty(key)) {
        continue;
      }

      switch (objectInterfaceRules[key].type) {
        case 'number':
          expect(oneObject[key]).toBeGreaterThanOrEqual(objectInterfaceRules[key].length);
          expect(Number.isFinite(oneObject[key])).toBeTruthy();
          // @ts-ignore
          expect(typeof oneObject[key], `Wrong type of key ${key}. Object: ${JSON.stringify(oneObject)}`)
            .toBe(objectInterfaceRules[key].type);
          break;
        case 'string':
          expect(oneObject[key].length).toBeGreaterThanOrEqual(objectInterfaceRules[key].length);
          // @ts-ignore
          expect(typeof oneObject[key], `Wrong type of key ${key}. Object: ${JSON.stringify(oneObject)}`)
            .toBe(objectInterfaceRules[key].type);
          break;
        case 'string_array':
          expect(oneObject[key].length).toBeGreaterThanOrEqual(objectInterfaceRules[key].length);
          expect(Array.isArray(oneObject[key])).toBeTruthy();
          break;
        default:
          throw new TypeError(`Unsupported expected type: ${objectInterfaceRules[key].type}`);
      }

      if (typeof objectInterfaceRules[key].value !== 'undefined') {
        expect(oneObject[key]).toBe(objectInterfaceRules[key].value);
      }
    }
  }

  // eslint-disable-next-line sonarjs/cognitive-complexity
  public static checkManyObjectsInterface(
    manyActualObjects: any,
    objectInterfaceRules: ObjectInterfaceRulesDto,
    options: CheckManyObjectsOptionsDto,
  ): void {
    expect(typeof manyActualObjects).toBe('object');
    expect(Array.isArray(manyActualObjects)).toBeFalsy();

    this.expectNotEmpty(manyActualObjects);

    for (const actualKey in manyActualObjects) {
      if (!manyActualObjects.hasOwnProperty(actualKey)) {
        continue;
      }

      const oneObject = manyActualObjects[actualKey];

      this.checkOneObjectInterface(oneObject, objectInterfaceRules, options);
    }
  }
}

export = CommonChecker;
