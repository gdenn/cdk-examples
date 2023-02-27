const { awscdk } = require('projen');
const project = new awscdk.AwsCdkTypeScriptApp({
  cdkVersion: '2.1.0',
  defaultReleaseBranch: 'main',
  name: 'aws-config-remediation',

  deps: [
    '@types/aws-lambda',
    '@aws-sdk/types',
    'aws-sdk',
    '@aws-sdk/client-config-service',
  ],
  description: 'AWS Config Remediation example',
  devDeps: [],
  packageName: 'aws-config-remediation',
});
project.synth();