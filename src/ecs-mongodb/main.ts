import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { ECSCluster } from './cluster';
import { MongoTask } from './mongoTask';


class ECSMongodbStack extends Stack {

  public ECSCluster: ECSCluster;

  constructor(scope: Construct, id: string, props: StackProps) {
    super(scope, id, props);

    this.ECSCluster = new ECSCluster(this, 'ECSCluster');

    new MongoTask(this, 'MongoTask', {
      ecsCluster: this.ECSCluster.ecsCluster,
    });
  }
}

export default ECSMongodbStack;