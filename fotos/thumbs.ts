
import * as Sharp from "sharp";
import * as uuid from "uuid";

import { PutObjectRequest } from "aws-sdk/clients/s3";
import getS3Bucket from "./common/getS3Bucket";
import getS3BucketGenerated from "./common/getS3BucketGenerated";
import { failure, success } from "./common/responses";
import { safeLength } from "./create";
import logger from "./lib/logger";
import createS3Client from "./lib/s3";
import {
  ILoggerBaseParams, IPutObjectParams,
} from "./types";

let s3;

export const THUMB_WIDTH = 200;
export const THUMB_HEIGHT = 200;

export function getPutObjectParams({
  buffer, key,
}: IPutObjectParams): PutObjectRequest {
  return {
    Body: buffer,
    Bucket: getS3BucketGenerated(),
    ContentType: "image/jpg",
    Key: key,
  };
}

export function getObject(Key) {
  return s3.getObject({
    Bucket: getS3Bucket(),
    Key,
  }).promise();
}

export function putObject(params: IPutObjectParams) {
  const data = getPutObjectParams(params);
  return s3.putObject(data).promise();
}

export function resize({ data }) {
  const options: Sharp.ResizeOptions = {
    fit: Sharp.fit.cover,
    position: Sharp.strategy.entropy,
  };
  return Sharp(data.Body)
    .rotate()
    .resize(THUMB_WIDTH, THUMB_HEIGHT, options)
    .toFormat("png")
    .toBuffer();
}

export function resizeAndUpload({
  data, key,
}) {
  return resize({ data })
    .then((buffer) => putObject({
      buffer, key,
    }));
}

export function getLogFields(data) {
  return {
    imageBirthtime: data.birthtime,
    imageCreatedAt: data.createdAt,
    imageFaceMatchCount: safeLength(data.faceMatches),
    imageFacesCount: safeLength(data.faces),
    imageFamilyGroup: data.group,
    imageHeight: data.meta && data.meta.height,
    imageId: data.id,
    imageKey: data.img_key,
    imagePeopleCount: safeLength(data.people),
    imageTagCount: safeLength(data.tags),
    imageUpdatedAt: data.updatedAt,
    imageUserIdentityId: data.userIdentityId,
    imageUsername: data.username,
    imageWidth: data.meta && data.meta.width,
  };
}

export async function createThumb(event, context, callback) {
  const startTime = Date.now();
  const data = JSON.parse(event.body);
  const traceMeta = data!.traceMeta;
  const thumb = data.thumb;
  s3 = createS3Client();
  const loggerBaseParams: ILoggerBaseParams = {
    id: uuid.v1(),
    name: "createThumb",
    parentId: traceMeta && traceMeta!.parentId || "",
    startTime,
    traceId: traceMeta && traceMeta!.traceId || uuid.v1(),
  };
  try {
    const objData = await getObject(thumb.key);
    const result = await resizeAndUpload({ data: objData, key: thumb.thumbKey });
    logger(context, loggerBaseParams, getLogFields(thumb));
    return callback(null, success(result));
  } catch (err) {
    logger(context, loggerBaseParams, { err, ...getLogFields(thumb) });
    return callback(null, failure(err));
  }
}
