import { DynamoDBClient, GetItemCommand } from '@aws-sdk/client-dynamodb'
import { config } from '../../config/config.js'
import { Agent } from 'https'
import { NodeHttpHandler } from '@smithy/node-http-handler'

async function awaitResult(awaitable, times, name, logger) {
  const start = Date.now()
  logger.info(`${name} started...`)
  // eslint-disable-next-line no-unused-vars
  for (const i of [...Array(times).keys()]) {
    await awaitable()
  }
  logger.info(`${name} - ended ${Date.now() - start}`)
}

/**
 * A GDS styled example home page controller.
 * Provided as an example, remove or modify as required.
 */
export const homeController = {
  handler: async (request, h) => {
    const { logger } = request
    const sessionTable = 'sc-test-1-session'

    const times = Number(request.query.times ?? 100)
    if (Number.isNaN(times)) {
      return h.response({ error: '"times" must be a number' }).code(400)
    }

    const client = new DynamoDBClient({
      endpoint: config.get('aws.dynamoDb.endpoint'),
      region: config.get('aws.region')
    })

    const keepAliveClient = new DynamoDBClient({
      endpoint: config.get('aws.dynamoDb.endpoint'),
      region: config.get('aws.region'),
      requestHandler: new NodeHttpHandler({
        httpsAgent: new Agent({
          keepAlive: true,
          maxSockets: 10,
          keepAliveMsecs: 60000
        })
      })
    })

    const getItemCommand = () =>
      new GetItemCommand({
        TableName: sessionTable,
        Key: { id: { S: crypto.randomUUID() } },
        ConsistentRead: false
      })

    const getItemConsistentReadCommand = () =>
      new GetItemCommand({
        TableName: sessionTable,
        Key: { id: { S: crypto.randomUUID() } },
        ConsistentRead: true
      })

    process.env.GLOBAL_AGENT_NO_PROXY =
      '.cdp-int.defra.cloud,.s3.eu-west-2.amazonaws.com,sqs.eu-west-2.amazonaws.com,sns.eu-west-2.amazonaws.com,dynamodb.eu-west-2.amazonaws.com'
    logger.info(`NO_PROXY is ${process.env.GLOBAL_AGENT_NO_PROXY}`)

    logger.info(`performing ${times} times`)

    await awaitResult(
      () => client.send(getItemCommand()),
      times,
      'direct get item',
      logger
    )

    await awaitResult(
      () => client.send(getItemConsistentReadCommand()),
      times,
      'direct get item with consistent reads',
      logger
    )

    await awaitResult(
      () => keepAliveClient.send(getItemCommand()),
      times,
      'direct (keep-alive) get item',
      logger
    )

    await awaitResult(
      () => keepAliveClient.send(getItemConsistentReadCommand()),
      times,
      'direct (keep-alive) get item with consistent reads',
      logger
    )

    delete process.env.GLOBAL_AGENT_NO_PROXY
    logger.info(`NO_PROXY is ${process.env.GLOBAL_AGENT_NO_PROXY}`)

    await awaitResult(
      () => client.send(getItemCommand()),
      times,
      'proxy get item',
      logger
    )

    await awaitResult(
      () => client.send(getItemConsistentReadCommand()),
      times,
      'proxy get item with consistent reads',
      logger
    )

    await awaitResult(
      () => keepAliveClient.send(getItemCommand()),
      times,
      'proxy (keep-alive) get item',
      logger
    )

    await awaitResult(
      () => keepAliveClient.send(getItemConsistentReadCommand()),
      times,
      'proxy (keep-alive) get item with consistent reads',
      logger
    )

    delete process.env.GLOBAL_AGENT_NO_PROXY

    return h.view('home/index', {
      pageTitle: 'Home',
      heading: 'Home'
    })
  }
}
