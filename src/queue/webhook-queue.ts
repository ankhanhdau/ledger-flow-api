import { Worker, Queue } from 'bullmq';
import axios from 'axios';

const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379')
}

export const webhookQueue = new Queue('webhooks', { connection });

const worker = new Worker('webhooks', async (job) => {
    console.log(`Processing webhook job: ${job.id}, Transaction ID: ${job.data.transactionId}`);
    const { url, payload } = job.data;
    try {
        const response = await axios.post(url, payload);
        console.log(`[Webhook] Success! Response: ${response.status}`);
        return response.data;
    } catch (error) {
        console.error('Error processing webhook job:', job.id, error);
        throw error;
    }
}, {
    connection,
    limiter: {
        max: 5,
        duration: 1000
    }
});
worker.on('completed', (job) => {
    console.log(`Webhook job ${job.id} completed.`);
});
worker.on('failed', (job, err) => {
    console.error(`Webhook job ${job?.id} failed:`, err);
});
