// lambda function handler that sends an ses email
import { SES } from 'aws-sdk';

const RECEPIENTS = process.env.RECEPIENTS?.split(',');
const SUBJECT = process.env.SUBJECT;
const BODY = process.env.BODY;
const SOURCE = process.env.SOURCE;

const ses = new SES();

export const handler = async () => {

  if (!RECEPIENTS?.length) throw new Error('Specify at least one recepient!');
  if (!SUBJECT?.length) throw new Error('Specify a subject!');
  if (!BODY?.length) throw new Error('Specify a body!');
  if (!SOURCE?.length) throw new Error('Specify a source!');

  try {
    const params = {
      Source: SOURCE,
      Destination: {
        ToAddresses: RECEPIENTS,
      },
      Message: {
        Body: {
          Text: {
            Data: BODY,
          },
        },
        Subject: {
          Data: SUBJECT,
        },
      },
    };

    const result = await ses.sendEmail(params).promise();

    return {
      statusCode: 200,
      body: JSON.stringify(result),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify(error),
    };
  }
};