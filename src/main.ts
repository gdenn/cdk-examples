import { App } from 'aws-cdk-lib';
import AWSBackup from './aws-backup/main';

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new AWSBackup(app, 'aws-backup-dev', { env: devEnv });
// new MyStack(app, 'cdk-examples-prod', { env: prodEnv });

app.synth();