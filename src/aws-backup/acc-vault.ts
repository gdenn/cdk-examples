import { BackupPlan, BackupResource, BackupVault } from 'aws-cdk-lib/aws-backup';
import { Key } from 'aws-cdk-lib/aws-kms';
import { Construct } from 'constructs';

interface AccVaultProps {
  readonly account: string;
}

export class AccVault extends Construct {

  public backupVault: BackupVault;
  public key: Key;

  constructor(scope: Construct, id: string, props: AccVaultProps) {
    super(scope, id);

    const { account } = props;

    // setup backup vault with an KMS encryption key
    const { backupVault, key } = this.setupBackupVault();
    this.backupVault = backupVault;
    this.key = key;

    this.setupRpo24hBackupPlan({ account, backupVault });
  }

  setupBackupVault = () => {
    const key = new Key(this, 'Key', {
      enableKeyRotation: true,
    });

    const backupVault = new BackupVault(this, 'BackupVault', {
      backupVaultName: 'MyBackupVault',
      encryptionKey: this.key,
    });

    return { backupVault, key };
  };

  setupRpo24hBackupPlan = ({ account, backupVault }: { account: string, backupVault: BackupVault }) => {
    const plan = BackupPlan.daily35DayRetention(this, 'Daily35DayRetention', backupVault);

    plan.addSelection('MySelection', {
      resources: [
        BackupResource.fromTag('rpo', '24h'),
        // BackupResource.fromArn(`arn:aws:elasticfilesystem:*:${this.account}:file-system/*`),
        // BackupResource.fromArn(`arn:aws:ec2:*:${this.account}:volume/*`),
        BackupResource.fromArn(`arn:aws:rds:*:${account}:db:*`),
      ],
    });
  };
}