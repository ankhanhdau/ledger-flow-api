import Fastify from 'fastify';
import type { FastifyRequest } from 'fastify';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import { transferFunds } from './services/ledger-service.js';
import redisClient from './db/redis-client.js';
import { getClient } from './db/connection.js';
import type { TransferDTO, AccountParams } from './types.js';
import { webhookQueue } from './queue/webhook-queue.js';

const server = Fastify({ logger: true });

//Register Swagger for API documentation
await server.register(swagger, {
    swagger: {
        info: {
            title: 'LedgerFlow API',
            description: 'A transactional ledger with double-entry bookkeeping and idempotency.',
            version: '1.0.0',
        },
        host: `localhost:${process.env.PORT || 3001}`,
        schemes: ['http'],
        consumes: ['application/json'],
        produces: ['application/json'],
    },
});

// Register UI (The Website)
await server.register(swaggerUi, {
    routePrefix: '/documentation',
    uiConfig: {
        docExpansion: 'full',
        deepLinking: false,
    },
});

//Simple health check route
server.get('/health', {
    schema: {
        description: 'Health check endpoint',
        tags: ['Health'],
        response: {
            200: {
                type: 'object',
                properties: {
                    status: { type: 'string' },
                    system: { type: 'string' }
                }
            }
        }
    }
}, async (request, reply) => {
    return { status: 'OK', system: 'Ledger Flow Server is running' };
})

//Endpoint to get account balance
server.get('/accounts/:id/balance', {
    schema: {
        description: 'Get account balance by account ID',
        tags: ['Accounts'],
        params: {
            type: 'object',
            properties: {
                id: { type: 'integer', description: 'Account ID' }
            },
            required: ['id']
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    accountId: { type: 'integer' },
                    balance: { type: 'number' }
                }
            },
            404: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}, async (request: FastifyRequest<{ Params: AccountParams }>, reply) => {
    const accountId = parseInt(request.params.id);
    const client = await getClient();
    try {
        const res = await client.query('SELECT balance FROM accounts WHERE id = $1', [accountId]);
        if (res.rows.length === 0) {
            return reply.status(404).send({ error: 'Account not found' });
        }
        const balance = parseFloat(res.rows[0].balance);
        return reply.send({ accountId, balance });
    } catch (error) {
        server.log.error(error);
        return reply.status(500).send({ error: 'Internal Server Error' });
    } finally {
        client.release();
    }
});

//Endpoint to transfer funds between accounts
server.post('/transfer', {
    schema: {
        description: 'Execute a secure fund transfer between accounts',
        tags: ['Transactions'],
        headers: {
            type: 'object',
            properties: {
                'idempotency-key': { type: 'string', description: 'Unique key to prevent duplicate charges' }
            },
            required: ['idempotency-key']
        },
        body: {
            type: 'object',
            required: ['fromAccountId', 'toAccountId', 'amount', 'reference'],
            properties: {
                fromAccountId: { type: 'integer' },
                toAccountId: { type: 'integer' },
                amount: { type: 'number', minimum: 0 },
                reference: { type: 'string' }
            }
        },
        response: {
            200: {
                type: 'object',
                properties: {
                    success: { type: 'boolean' },
                    transactionId: { type: 'integer' }
                }
            },
            400: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            },
            500: {
                type: 'object',
                properties: {
                    error: { type: 'string' }
                }
            }
        }
    }
}, async (request, reply) => {
    const { fromAccountId, toAccountId, amount, reference } = request.body as TransferDTO;
    //Extract Idempotency Key from headers
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined;
    if (!idempotencyKey) {
        reply.status(400).send({ error: 'Idempotency-Key header is required' });
        return;
    }
    const cacheKey = `idempotency:${idempotencyKey}`;
    try {
        //Check Redis for existing response
        const cachedResponse = await redisClient.get(cacheKey);
        if (cachedResponse) {
            server.log.info(`Idempotent response served for key: ${idempotencyKey}`);
            return JSON.parse(cachedResponse);
        }
        //Process the transfer
        const result = await transferFunds({ fromAccountId, toAccountId, amount, reference });

        //Enqueue webhook notification job
        webhookQueue.add('payment.completed', {
            transactionId: result.transactionId,
            status: 'completed',
            amount,
            url: process.env.WEBHOOK_URL || '',
            payload: {
                event: 'transfer.success',
                data: result
            }
        }, {
            attempts: 5,
            backoff: {
                type: 'exponential',
                delay: 1000
            }
        });
        //Save response in Redis
        await redisClient.set(cacheKey, JSON.stringify(result), { EX: 60 * 60 * 24 }); // Cache for 24 hours
        return reply.send(result);
    } catch (error) {
        return reply.status(500).send({ error: (error as Error).message });
    }
});

//Start the server
const start = async () => {
    try {
        await server.listen({ port: parseInt(process.env.PORT || '3001'), host: '0.0.0.0' });
        server.log.info(`Server listening on port ${process.env.PORT || 3001}`);
    } catch (err) {
        server.log.error(err);
        process.exit(1);
    }
}
await start();