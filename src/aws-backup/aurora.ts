import { Tags } from 'aws-cdk-lib';
import { InstanceClass, InstanceSize, InstanceType, SubnetType, Vpc } from 'aws-cdk-lib/aws-ec2';
import { AuroraPostgresEngineVersion, DatabaseCluster, DatabaseClusterEngine } from 'aws-cdk-lib/aws-rds';
import { Construct } from 'constructs';

export class Aurora extends Construct {

  public vpc: Vpc;
  public aurora: DatabaseCluster;

  constructor(scope: Construct, id: string) {
    super(scope, id);

    // setup vpc, aurora cluster that we use to test the backup plan
    // selector
    this.vpc = this.setupVPC();
    this.aurora = this.setupAuroraCluster({
      vpc: this.vpc,
    });
  }

  setupVPC = () => {
    return new Vpc(this, 'Vpc', {
      cidr: '10.0.0.0/16',
      maxAzs: 2,
      natGateways: 1,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: 'data',
          subnetType: SubnetType.PUBLIC,
        },
      ],
    });
  };

  setupAuroraCluster = ({ vpc }: { vpc: Vpc }) => {

    const cluster = new DatabaseCluster(this, 'Aurora', {
      engine: DatabaseClusterEngine.auroraPostgres({
        version: AuroraPostgresEngineVersion.VER_14_6,
      }),
      instanceProps: {
        vpc,
        instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
        vpcSubnets: {
          subnetType: SubnetType.PUBLIC,
        },
      },
      credentials: {
        username: 'admin',
      },
    });

    // Allow incoming requests from anywhere
    cluster.connections.allowDefaultPortFromAnyIpv4('Open to the world');

    Tags.of(cluster).add('rpo', '24h');

    return cluster;
  };
}