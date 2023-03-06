"use strict";

// src/lambda/detect.ts
var handler = async (event) => {
  console.log(event);
  return {
    complianceType: "NON_COMPLIANT",
    annotation: "This is a non-compliant resource",
    orderingTimestamp: (/* @__PURE__ */ new Date()).toISOString()
  };
};
exports.handler = handler;
