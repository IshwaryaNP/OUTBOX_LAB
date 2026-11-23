import { Client } from '@elastic/elasticsearch';
import { config } from '../config/index.js';

let esClient: Client | null = null;
let isConnected = false;

try {
  esClient = new Client({
    node: config.elasticsearch.node,
  });
} catch (err: any) {
  console.warn('[Elasticsearch] Initialization error:', err.message);
}

export async function initElasticsearch() {
  if (!esClient) return false;
  try {
    const health = await esClient.cluster.health();
    isConnected = true;
    console.log('[Elasticsearch] Cluster status:', health.status);

    // Ensure index exists
    const indexExists = await esClient.indices.exists({
      index: config.elasticsearch.index,
    });

    if (!indexExists) {
      await esClient.indices.create({
        index: config.elasticsearch.index,
        body: {
          mappings: {
            properties: {
              id: { type: 'keyword' },
              recipient: { type: 'text', fields: { keyword: { type: 'keyword' } } },
              subject: { type: 'text' },
              body: { type: 'text' },
              status: { type: 'keyword' },
              scheduledFor: { type: 'date' },
              sentAt: { type: 'date' },
              createdAt: { type: 'date' },
              senderEmail: { type: 'keyword' },
            },
          },
        },
      });
      console.log(`[Elasticsearch] Index created: ${config.elasticsearch.index}`);
    }
    return true;
  } catch (error: any) {
    console.warn('[Elasticsearch] Not reachable or starting up. Full-text search will fallback gracefully to DB search.', error.message);
    isConnected = false;
    return false;
  }
}

export async function indexEmail(email: {
  id: string;
  recipient: string;
  subject: string;
  body: string;
  status: string;
  scheduledFor: Date | string;
  sentAt?: Date | string | null;
  createdAt: Date | string;
  senderEmail?: string;
}) {
  if (!isConnected || !esClient) return;
  try {
    await esClient.index({
      index: config.elasticsearch.index,
      id: email.id,
      body: email,
    });
  } catch (err: any) {
    console.warn(`[Elasticsearch] Failed to index email ${email.id}:`, err.message);
  }
}

export async function searchEmails(query: string, status?: string) {
  if (!isConnected || !esClient) {
    return null; // Signals caller to use Database fallback
  }

  try {
    const mustClauses: any[] = [
      {
        multi_match: {
          query,
          fields: ['recipient^3', 'subject^2', 'body'],
          fuzziness: 'AUTO',
        },
      },
    ];

    if (status) {
      mustClauses.push({
        term: { status },
      });
    }

    const result = await esClient.search({
      index: config.elasticsearch.index,
      body: {
        query: {
          bool: {
            must: mustClauses,
          },
        },
        sort: [{ scheduledFor: { order: 'desc' } }],
        size: 50,
      },
    });

    return result.hits.hits.map((hit) => hit._source);
  } catch (err: any) {
    console.warn('[Elasticsearch] Search failed, falling back to DB:', err.message);
    return null;
  }
}

export { esClient };

