import Joi from 'joi';

export const requestSchema = Joi.object().keys({
  userid: Joi.string().guid().required(),
  from: Joi.date().required(),
  to: Joi.date().required(),
  criteria: Joi.object().keys({
    tags: Joi.array().items(Joi.string()).unique(),
    people: Joi.array().items(Joi.string()).unique(),
  }),
});

export const ddbParamsSchema = Joi.object().keys({
  TableName: Joi.string().required(),
  KeyConditionExpression: Joi.string().required(),
  ExpressionAttributeNames: Joi.object().required(),
  ExpressionAttributeValues: Joi.object().required(),
});