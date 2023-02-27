/* eslint-disable */
import { PutEvaluationsResponse } from '@aws-sdk/client-config-service';
import { Callback } from 'aws-lambda';
import { AWSError, ConfigService } from 'aws-sdk';
import { PutEvaluationsRequest } from 'aws-sdk/clients/configservice';

const config = new ConfigService();

interface ConfigEvent {
  invokingEvent: string;
  ruleParameters: string;
  resultToken: string;
}

// @see: https://docs.aws.amazon.com/config/latest/developerguide/evaluate-config_develop-rules_nodejs-sample.html

const checkDefined = (reference: any, referenceName: any) => {
  if (!reference) {
    throw new Error(`Error: ${referenceName} is not defined`);
  }
  return reference;
}

// Check whether the message type is OversizedConfigurationItemChangeNotification,
const isOverSizedChangeNotification = (messageType: any) => {
  checkDefined(messageType, 'messageType');
  return messageType === 'OversizedConfigurationItemChangeNotification';
}

// Get the configurationItem for the resource using the getResourceConfigHistory API.
const getConfiguration = (resourceType: any, resourceId: any, configurationCaptureTime: any, callback: any) => {
  config.getResourceConfigHistory({ resourceType, resourceId, laterTime: new Date(configurationCaptureTime), limit: 1 }, (err, data) => {
      if (err) {
          callback(err, null);
      }
      const configurationItem = data!.configurationItems![0];
      callback(null, configurationItem);
  });
}

// Convert the oversized configuration item from the API model to the original invocation model.
const convertApiConfiguration = (apiConfiguration: any) => {
  apiConfiguration.awsAccountId = apiConfiguration.accountId;
  apiConfiguration.ARN = apiConfiguration.arn;
  apiConfiguration.configurationStateMd5Hash = apiConfiguration.configurationItemMD5Hash;
  apiConfiguration.configurationItemVersion = apiConfiguration.version;
  apiConfiguration.configuration = JSON.parse(apiConfiguration.configuration);
  
  if ({}.hasOwnProperty.call(apiConfiguration, 'relationships')) {
    for (let i = 0; i < apiConfiguration.relationships.length; i++) {
        apiConfiguration.relationships[i].name = apiConfiguration.relationships[i].relationshipName;
    }
  }

  return apiConfiguration;
}

// Based on the message type, get the configuration item either from the configurationItem object in the invoking event or with the getResourceConfigHistory API in the getConfiguration function.
const getConfigurationItem = (invokingEvent: any, callback: any) => {

  checkDefined(invokingEvent, 'invokingEvent');

  if (isOverSizedChangeNotification(invokingEvent.messageType)) {
    const configurationItemSummary = checkDefined(invokingEvent.configurationItemSummary, 'configurationItemSummary');
    getConfiguration(
      configurationItemSummary.resourceType, 
      configurationItemSummary.resourceId, 
      configurationItemSummary.configurationItemCaptureTime, 
      (err: any, apiConfigurationItem: any) => {
      
        if (err) callback(err);

        const configurationItem = convertApiConfiguration(apiConfigurationItem);

        callback(null, configurationItem);
      }
    );
  } else {
    checkDefined(invokingEvent.configurationItem, 'configurationItem');
    callback(null, invokingEvent.configurationItem);
  }
}

// Check whether the resource has been deleted. If the resource was deleted, then the evaluation returns not applicable.
const isApplicable = (configurationItem: any, event: any) => {

  checkDefined(configurationItem, 'configurationItem');
  checkDefined(event, 'event');

  const status = configurationItem.configurationItemStatus;
  const eventLeftScope = event.eventLeftScope;

  return (status === 'OK' || status === 'ResourceDiscovered') && eventLeftScope === false;
}

// In this example, the resource is compliant if it is an instance and its type matches the type specified as the desired type.
// If the resource is not an instance, then this resource is not applicable.
const evaluateChangeNotificationCompliance = (configurationItem: any, ruleParameters: any) => {

  checkDefined(configurationItem, 'configurationItem');
  checkDefined(configurationItem.configuration, 'configurationItem.configuration');
  checkDefined(ruleParameters, 'ruleParameters');

  if (configurationItem.resourceType !== 'AWS::EC2::Instance') {
    return 'NOT_APPLICABLE';
  } else if (ruleParameters.desiredInstanceType === configurationItem.configuration.instanceType) {
    return 'COMPLIANT';
  } else {
    return 'NON_COMPLIANT';
  }
}

const handler = async (event: ConfigEvent, callback: Callback) => {

  checkDefined(event, 'event');

  const invokingEvent = JSON.parse(event.invokingEvent);
  const ruleParameters = JSON.parse(event.ruleParameters);

  getConfigurationItem(invokingEvent, (err: any, configurationItem: any) => {

    if (err) callback(err);

    const compliance = isApplicable(configurationItem, event)
      ? evaluateChangeNotificationCompliance(configurationItem, ruleParameters)
      : 'NOT_APPLICABLE';

    const putEvaluationsRequest: PutEvaluationsRequest = {
      Evaluations: [{
        ComplianceResourceType: configurationItem.resourceType,
        ComplianceResourceId: configurationItem.resourceId,
        ComplianceType: compliance,
        OrderingTimestamp: configurationItem.configurationItemCaptureTime,
      }],
      ResultToken: event.resultToken,
    };

    // Sends the evaluation results to AWS Config.
    config.putEvaluations(putEvaluationsRequest, (error: AWSError, data: PutEvaluationsResponse) => {
        if (error) {
          callback(error, null);
        } else if (data && data.FailedEvaluations && data.FailedEvaluations.length > 0) {
          // Ends the function if evaluation results are not successfully reported to AWS Config.
          callback(JSON.stringify(data), null);
        } else {
          callback(null, data);
        }
    });
  });
};

exports.handler = handler;



