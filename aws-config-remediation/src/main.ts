import path from 'path';
import { App, Stack, StackProps } from 'aws-cdk-lib';
import { CustomRule, ResourceType, RuleScope } from 'aws-cdk-lib/aws-config';
import { SnsTopic } from 'aws-cdk-lib/aws-events-targets';
import { Runtime } from 'aws-cdk-lib/aws-lambda';
import { SnsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { Construct } from 'constructs';

export class ConfigRuleWithAutoRemediation extends Stack {

  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const customRule = new CustomRule(this, 'CheckSecureSGPortsConfigRule', {
      lambdaFunction: this.detectLambda(),
      configurationChanges: true,
      ruleScope: RuleScope.fromResources([ResourceType.EC2_SECURITY_GROUP]),
    });

    const topic = new Topic(this, 'CheckSecureSGPortsTopic');

    customRule.onComplianceChange('CheckSecureSGPortsNonCompliant', {
      target: new SnsTopic(topic),
    });

    const eventSource = new SnsEventSource(topic);
    this.remediateLambda().addEventSource(eventSource);
  }

  detectLambda = () => {
    return new NodejsFunction(this, 'DetectInsecureSGPorts', {
      entry: path.join(__dirname, 'lambda/detect.ts'),
      runtime: Runtime.NODEJS_16_X,
    });
  };

  remediateLambda = () => {
    return new NodejsFunction(this, 'DeleteInsecureSG', {
      entry: path.join(__dirname, 'lambda/remmediate.ts'),
      runtime: Runtime.NODEJS_16_X,
    });
  };
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new ConfigRuleWithAutoRemediation(app, 'aws-config-remediation-dev', { env: devEnv });
// new MyStack(app, 'aws-config-remediation-prod', { env: prodEnv });

app.synth();