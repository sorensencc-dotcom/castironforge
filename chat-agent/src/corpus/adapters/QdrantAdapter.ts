import { qdrantClient } from "../../services/QdrantClient";

export class QdrantAdapter {
  async retrievePoints(collection: string, ids: string[]): Promise<any[]> {
    try {
      const result = await qdrantClient.retrieve(collection, {
        ids: ids.map(id => {
          // Qdrant expects numeric IDs, so we need to handle both cases
          const numId = parseInt(id, 10);
          return isNaN(numId) ? id : numId;
        }),
        with_payload: true,
        with_vectors: false
      });
      return result.result || [];
    } catch (error) {
      throw new Error(`Failed to retrieve points from ${collection}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getCollectionInfo(collection: string): Promise<any> {
    try {
      return await qdrantClient.getCollection(collection);
    } catch (error) {
      throw new Error(`Failed to get collection info for ${collection}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const qdrantAdapter = new QdrantAdapter();
