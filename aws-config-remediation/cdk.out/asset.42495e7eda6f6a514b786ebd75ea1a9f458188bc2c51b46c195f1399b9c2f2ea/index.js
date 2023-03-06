"use strict";

// src/lambda/detect.ts
var import_aws_sdk = require("aws-sdk");
var config = new import_aws_sdk.ConfigService();
var handler = async (event) => {
  console.log(event);
  return {
    complianceType: "NON_COMPLIANT",
    annotation: "This is a non-compliant resource"
  };
};
exports.handler = handler;
