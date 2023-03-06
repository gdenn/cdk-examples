import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { AccVault } from './acc-vault';
import { Aurora } from './aurora';

class AWSBackupStack extends Stack {

  public aurora: Aurora;
  public accVault: AccVault;

  constructor (scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    this.accVault = new AccVault(this, 'AccVault', {
      account: this.account,
    });

    this.aurora = new Aurora(this, 'Aurora');
  }
}

export default AWSBackupStack;