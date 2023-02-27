/* eslint-disable */
import { SNSHandler } from "aws-lambda";

const handler: SNSHandler = async (event) => {
  console.log(event);
};

exports.handler = handler;