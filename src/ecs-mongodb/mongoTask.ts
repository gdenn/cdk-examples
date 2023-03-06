import { Cluster, ContainerImage, Ec2Service, Ec2TaskDefinition, NetworkMode, Protocol, Scope } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

interface MongoTaskProps {
  ecsCluster: Cluster;
}

export class MongoTask extends Construct {

  public taskDefinition: Ec2TaskDefinition;

  constructor(scope: Construct, id: string, props: MongoTaskProps) {
    super(scope, id);

    const { ecsCluster } = props;

    this.taskDefinition = new Ec2TaskDefinition(this, 'MongoDB', {
      networkMode: NetworkMode.BRIDGE,
    });

    const volumeName = 'my-data-volume';

    this.taskDefinition.addVolume({
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

    const mongodbContainer = this.taskDefinition.addContainer('MongoDB', {
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
      cluster: ecsCluster,
      taskDefinition: this.taskDefinition,
    });
  }
}
