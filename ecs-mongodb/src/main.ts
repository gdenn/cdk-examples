import { App, Stack, StackProps } from 'aws-cdk-lib';
import { InstanceType, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { AmiHardwareType, Cluster, ContainerImage, Ec2Service, Ec2TaskDefinition, EcsOptimizedImage, NetworkMode, Protocol, Scope } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

export class MyStack extends Stack {
  constructor(scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    const vpc = new Vpc(this, 'Vpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: SubnetType.PUBLIC },
        { name: 'private', subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      ],
    });

    const cluster = new Cluster(this, 'Cluster', {
      vpc,
    });

    cluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new InstanceType('t4g.medium'),
      desiredCapacity: 1,
      machineImage: EcsOptimizedImage.amazonLinux2(AmiHardwareType.ARM),
    });

    const mongodbTaskDefinition = new Ec2TaskDefinition(this, 'MongoDB', {
      networkMode: NetworkMode.BRIDGE,
    });

    const volumeName = 'my-data-volume';

    mongodbTaskDefinition.addVolume({
      name: volumeName,
      dockerVolumeConfiguration: {
        scope: Scope.SHARED,
        autoprovision: true,
        driver: 'rexray/ebs',
        driverOpts: {
          volumetype: 'gp2',
          size: '20',
        },
      },
    });

    const mongodbContainer = mongodbTaskDefinition.addContainer('MongoDB', {
      image: ContainerImage.fromRegistry('mongo:5.0.15'),
      containerName: 'MongoDB',
      memoryLimitMiB: 1024,
      cpu: 512,
      environment: {
        MONGO_INITDB_ROOT_USERNAME: 'root',
        MONGO_INITDB_ROOT_PASSWORD: 'secret123',
      },
    });

    mongodbContainer.addMountPoints({
      sourceVolume: volumeName,
      containerPath: '/data/db',
      readOnly: false,
    });

    mongodbContainer.addPortMappings({
      containerPort: 27017,
      hostPort: 27017,
      protocol: Protocol.TCP,
    });

    new Ec2Service(this, 'MongoDBService', {
      cluster,
      taskDefinition: mongodbTaskDefinition,
    });
  }
}

// for development, use account/region from cdk cli
const devEnv = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: process.env.CDK_DEFAULT_REGION,
};

const app = new App();

new MyStack(app, 'projen-test-dev', { env: devEnv });
// new MyStack(app, 'projen-test-prod', { env: prodEnv });

app.synth();