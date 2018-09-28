import Joi from 'joi';
import { AttributeValue as ddbAttVals } from 'dynamodb-data-types';

import createS3Client from './lib/s3';
import { INDEXES_KEY } from './lib/constants';
import logger from './lib/logger';
import { getSchema, putSchema } from './joi/stream';
import { success, failure } from './lib/responses';

import { safeLength } from './create';
import { getZeroCount } from './indexes';

let s3;

export function getS3Params() {
  const data = {
    Bucket: process.env.S3_BUCKET,
    Key: INDEXES_KEY,
  };
  const result = Joi.validate(data, getSchema);
  if (result.error !== null) {
    throw result.error;
  } else {
    return data;
  }
}

export function getS3PutParams(indexData) {
  const data = {
    Body: JSON.stringify(indexData),
    Bucket: process.env.S3_BUCKET,
    ContentType: 'application/json',
    Key: INDEXES_KEY,
  };
  const result = Joi.validate(data, putSchema);
  if (result.error !== null) {
    throw result.error;
  } else {
    return data;
  }
}

export function getExistingIndex() {
  const s3Params = getS3Params();
  return s3.getObject(s3Params).promise()
    .then(s3Object => JSON.parse(s3Object.Body.toString()))
    .catch(error => ({ error, tags: {}, people: {} }));
}

export function normaliseArrayFields(record) {
  const arrayFields = {
    tags: {
      new: [],
      old: [],
    },
    people: {
      new: [],
      old: [],
    },
  };
  if (record && record.dynamodb) {
    if (record.dynamodb.NewImage) {
      const newImg = ddbAttVals.unwrap(record.dynamodb.NewImage);
      arrayFields.tags.new = Array.isArray(newImg.tags) ? [...newImg.tags] : [];
      arrayFields.people.new = Array.isArray(newImg.people) ? [...newImg.people] : [];
    }
    if (record.dynamodb.OldImage) {
      const oldImg = ddbAttVals.unwrap(record.dynamodb.OldImage);
      arrayFields.tags.old = Array.isArray(oldImg.tags) ? [...oldImg.tags] : [];
      arrayFields.people.old = Array.isArray(oldImg.people) ? [...oldImg.people] : [];
    }
  }
  return arrayFields;
}

export function parseIndexes(records) {
  return records.reduce((indexes, record) => {
    const updatedIndexes = { ...indexes };
    const arrayFields = normaliseArrayFields(record);
    ['tags', 'people'].forEach((field) => {
      arrayFields[field].new.forEach((item) => {
        if (!arrayFields[field].old.includes(item)) {
          updatedIndexes[field][item] = updatedIndexes[field][item] ?
            updatedIndexes[field][item] + 1 :
            1;
        }
      });
      arrayFields[field].old.forEach((item) => {
        if (!arrayFields[field].new.includes(item)) {
          updatedIndexes[field][item] = updatedIndexes[field][item] ?
            updatedIndexes[field][item] - 1 :
            -1;
        }
      });
    });
    return updatedIndexes;
  }, { tags: {}, people: {} });
}

export function updateCounts(existing, newUpdates) {
  const updated = {};
  ['tags', 'people'].forEach((key) => {
    updated[key] = { ...existing[key] };
    Object.keys(newUpdates[key]).forEach((item) => {
      updated[key][item] = updated[key][item] ?
        Math.max(0, updated[key][item] + newUpdates[key][item]) :
        Math.max(0, newUpdates[key][item]);
    });
  });
  return updated;
}

export function getUpdatedIndexes(existing, newRecords) {
  const updates = parseIndexes(newRecords);
  return updateCounts(existing, updates);
}

export function putIndex(index) {
  const s3PutParams = getS3PutParams(index);
  return s3.putObject(s3PutParams).promise();
}

export function getLogFields(records, existingIndex, updatedIndexes) {
  const firstRecord = ddbAttVals.unwrap(records[0].dynamodb.NewImage);
  return {
    imageId: firstRecord.id,
    imageUsername: firstRecord.username,
    imageFamilyGroup: firstRecord.group,
    imageUserIdentityId: firstRecord.userIdentityId,
    imagePeopleCount: safeLength(firstRecord.people),
    imageFaceMatchCount: safeLength(firstRecord.faceMatches),
    imageFacesCount: safeLength(firstRecord.faces),
    imageTagCount: safeLength(firstRecord.tags),
    imageKey: firstRecord.img_key,
    imageWidth: firstRecord.meta && firstRecord.meta.width,
    imageHeight: firstRecord.meta && firstRecord.meta.height,
    imageBirthtime: firstRecord.birthtime,
    imageCreatedAt: firstRecord.createdAt,
    imageUpdatedAt: firstRecord.updatedAt,
    indexesTagCount: existingIndex && Object.keys(existingIndex.tags).length,
    indexesPeopleCount: existingIndex && Object.keys(existingIndex.people).length,
    indexesZeroTagCount: existingIndex && getZeroCount(existingIndex.tags),
    indexesZeroPeopleCount: existingIndex && getZeroCount(existingIndex.people),
    indexesUpdatedTagCount: updatedIndexes && Object.keys(updatedIndexes.tags).length,
    indexesUpdatedPeopleCount: updatedIndexes && Object.keys(updatedIndexes.people).length,
    indexesUpdatedZeroTagCount: updatedIndexes && getZeroCount(updatedIndexes.tags),
    indexesUpdatedZeroPeopleCount: updatedIndexes && getZeroCount(updatedIndexes.people),
    ddbEventRecordsRaw: records,
    ddbEventRecordsCount: safeLength(records),
  };
}

export async function indexRecords(event, context, callback) {
  const startTime = Date.now();
  s3 = createS3Client();
  try {
    const existingIndex = await getExistingIndex();
    const updatedIndexes = getUpdatedIndexes(existingIndex, event.Records);
    const response = await putIndex(updatedIndexes);
    logger(context, startTime, getLogFields(event.Records, existingIndex, updatedIndexes));
    return callback(null, success(response));
  } catch (err) {
    logger(context, startTime, { err, ...getLogFields(event.Records) });
    return callback(null, failure(err));
  }
}
