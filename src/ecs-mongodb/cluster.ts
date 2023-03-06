import { InstanceType, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { AmiHardwareType, Cluster, EcsOptimizedImage } from 'aws-cdk-lib/aws-ecs';
import { Construct } from 'constructs';

export class ECSCluster extends Construct {

  public vpc: Vpc;
  public ecsCluster: Cluster;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    this.vpc = new Vpc(this, 'Vpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        { name: 'public', subnetType: SubnetType.PUBLIC },
        { name: 'private', subnetType: SubnetType.PRIVATE_WITH_EGRESS },
      ],
    });

    this.ecsCluster = new Cluster(this, 'Cluster', {
      vpc: this.vpc,
    });

    this.ecsCluster.addCapacity('DefaultAutoScalingGroup', {
      instanceType: new InstanceType('t4g.medium'),
      desiredCapacity: 1,
      machineImage: EcsOptimizedImage.amazonLinux2(AmiHardwareType.ARM),
    });
  }
}