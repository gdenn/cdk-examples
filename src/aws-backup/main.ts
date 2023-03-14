import path from 'path';
import { Duration, Stack, StackProps } from 'aws-cdk-lib';
import { BackupPlan, BackupPlanRule, BackupResource, BackupVault, BackupVaultEvents, CfnFramework } from 'aws-cdk-lib/aws-backup';
import { Schedule } from 'aws-cdk-lib/aws-events';
import { Key } from 'aws-cdk-lib/aws-kms';
import { NodejsFunction } from 'aws-cdk-lib/aws-lambda-nodejs';
import { Topic } from 'aws-cdk-lib/aws-sns';
import { LambdaSubscription } from 'aws-cdk-lib/aws-sns-subscriptions';
import { Construct } from 'constructs';

const VAULT_NAME = 'MyBackupVault';
const FRAMEWORK_NAME = 'MyBackupFramework';
const DAILY_BACKUP_PLAN_NAME = 'MyDailyBackupPlan';

const RPO_TAG = {
  Key: 'rpo',
  daily: '24h',
};

const COMMON_FRAMEWORK_INPUT_PARAMETERS = [
  {
    parameterName: 'tagKey',
    parameterValue: RPO_TAG.Key,
  },
  {
    parameterName: 'resourceType',
    parameterValue: 'AWS::EC2::Volume',
  },
  {
    parameterName: 'resourceType',
    parameterValue: 'AWS::RDS::DBCluster',
  },
  {
    parameterName: 'resourceType',
    parameterValue: 'AWS::EFS::FileSystem',
  },
  {
    parameterName: 'resourceType',
    parameterValue: 'AWS::EC2::Instance',
  },
];

const LAMBDA_ENVIRONMENT_EMAILS = {
  RECEPIENTS: 'dennis.gross@devoteam.com, igor.anglovski@devoteam.com',
  SUBJECT: 'AWS Backup failed',
  BODY: 'Please check the AWS Backup console for more details',
};

/**
 * Creates a backup vault, a backup plan and a backup framework
 * @see https://docs.aws.amazon.com/aws-backup/latest/devguide/what-is.html
 */
class AWSBackupStack extends Stack {

  public readonly vault: BackupVault;
  public readonly framework: CfnFramework;
  public readonly backupPlan: BackupPlan;

  constructor (scope: Construct, id: string, props: StackProps = {}) {
    super(scope, id, props);

    this.vault = this.createBackupVault();
    this.backupPlan = this.createBackupPlan();
    this.framework = this.createFramework();
  }

  /**
   * Create an encrypted backup vault and send failed backup
   * notifications to an SNS topic which triggers a lambda
   * that sends an email to the ops team.
   *
   * @see https://docs.aws.amazon.com/aws-backup/latest/devguide/backup-vaults.html
   * @see https://docs.aws.amazon.com/aws-backup/latest/devguide/backup-vaults.html#backup-vault-notifications
   * @see https://docs.aws.amazon.com/aws-backup/latest/devguide/backup-vaults.html#backup-vault-notifications-sns
   *
   * @returns BackupVault
   */
  createBackupVault(): BackupVault {
    // create kms key for the backup encryption
    const key = new Key(this, 'BackupVaultKey', {
      enableKeyRotation: true,
    });

    // create SNS topic for backup vault notifications
    const topic = new Topic(this, 'BackupVaultTopic');

    const lambda = new NodejsFunction(this, 'SendEmailBySNSEvent', {
      // path to handler.ts
      entry: path.join(__dirname, 'lambda', 'handler.ts'),
      environment: {
        ...LAMBDA_ENVIRONMENT_EMAILS,
      },
    });

    // allow lambda to send ses emails
    lambda.role?.addManagedPolicy({
      managedPolicyArn: 'arn:aws:iam::aws:policy/AmazonSESFullAccess',
    });

    // subscribe lambda to SNS topic
    const lambdaSubscription = new LambdaSubscription(lambda);
    topic.addSubscription(lambdaSubscription);

    return new BackupVault(this, 'BackupVault', {
      backupVaultName: VAULT_NAME,
      encryptionKey: key,
      // topic that receives event notifications
      notificationTopic: topic,
      // send failed backup notifications to SNS topic
      notificationEvents: [BackupVaultEvents.BACKUP_JOB_FAILED],
    });
  }

  /**
   * Creates a backup plan that backs up all resources with the tag 'rpo' set to '24h'
   * and all rds databases and efs filesystems in this account
   *
   * @see https://docs.aws.amazon.com/aws-backup/latest/devguide/backup-plan.html
   * @see https://docs.aws.amazon.com/aws-backup/latest/devguide/backup-plan.html#backup-plan-selectors
   * @see https://docs.aws.amazon.com/aws-backup/latest/devguide/backup-plan.html#backup-plan-rules
   *
   * @returns BackupPlan
   */
  createBackupPlan (): BackupPlan {
    const plan = new BackupPlan(this, 'MyBackupPlan', {
      backupPlanName: DAILY_BACKUP_PLAN_NAME,
      backupPlanRules: [
        new BackupPlanRule(
          {
            ruleName: 'DailyBackup',
            backupVault: this.vault,
            // run daily at 12:00 UTC
            scheduleExpression: Schedule.expression('cron(0 12 * * ? *)'),
            startWindow: Duration.minutes(60),
            completionWindow: Duration.minutes(180),
            // enable continuous backup
            enableContinuousBackup: true,
            deleteAfter: Duration.days(35),
          },
        ),
      ],
    });

    // add a tag selector that backs up all resources with the tag 'rpo' set to '24h'
    const tagResource = BackupResource.fromTag(RPO_TAG.Key, RPO_TAG.daily);

    // add selector that backs up all rds databses in this account
    // see https://docs.aws.amazon.com/aws-backup/latest/devguide/backup-plan.html#backup-plan-selectors
    plan.addSelection('RDSBackupSelector', {
      resources: [
        tagResource,
        BackupResource.fromArn(`arn:aws:rds:*:${this.account}:cluster:*`),
      ],
    });

    // add selector that backs up all efs filesystems in this account
    plan.addSelection('EFSBackupSelector', {
      resources: [
        tagResource,
        BackupResource.fromArn(`arn:aws:elasticfilesystem:*:${this.account}:file-system/*`),
      ],
    });

    // add selector that backs up all ebs volumes in this account
    plan.addSelection('EC2Backup', {
      resources: [
        tagResource,
        BackupResource.fromArn(`arn:aws:ec2:*:${this.account}:instance/*`),
      ],
    });

    return plan;
  }

  /**
   * Creates a backup framework that checks if all resources with the tag 'rpo' set to '24h' are backed up
   * and if the backup plan is configured correctly
   *
   * @see https://docs.aws.amazon.com/aws-backup/latest/devguide/backup-framework.html
   * @see https://docs.aws.amazon.com/aws-backup/latest/devguide/backup-framework.html#backup-framework-controls
   * @see https://docs.aws.amazon.com/aws-backuaws-sdkp/latest/devguide/backup-framework.html#backup-framework-control-input-parameters
   *
   * @returns CfnFramework
   */
  createFramework (): CfnFramework {
    return new CfnFramework(this, 'BackupFramework', {
      frameworkName: FRAMEWORK_NAME,
      frameworkControls: [
        {
          controlName: 'DailyBackupCompliance',
          controlScope: {
            // backup plan to use for compliance checks
            BackupPlan: {
              BackupPlanName: DAILY_BACKUP_PLAN_NAME,
            },
            // backup vault to use for compliance checks
            complianceResourceTypes: [
              {
                BackupVault: {
                  BackupVaultName: this.vault.backupVaultName,
                },
              },
            ],
          },
          // check if all resources with the tag 'rpo' set to '24h' are backed up
          controlInputParameters: [
            ...COMMON_FRAMEWORK_INPUT_PARAMETERS,
            {
              parameterName: 'BackupPlanName',
              parameterValue: DAILY_BACKUP_PLAN_NAME,
            },
            {
              parameterName: 'BackupVaultName',
              parameterValue: this.vault.backupVaultName,
            },
            {
              parameterName: 'backupPlanFrequency',
              parameterValue: 'DAILY',
            },
            {
              parameterName: 'backupPlanRetentionPeriod',
              parameterValue: '35',
            },
            {
              parameterName: 'tagValue',
              parameterValue: RPO_TAG.daily,
            },
          ],
        },
      ],
    });
  }
}

export default AWSBackupStack;