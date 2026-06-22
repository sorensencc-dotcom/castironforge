import { typesenseClient } from "../../services/TypesenseClient";

export class TypesenseAdapter {
  async getDocument(collection: string, id: string): Promise<any> {
    try {
      return await typesenseClient.collections(collection).documents(id).retrieve();
    } catch (error) {
      throw new Error(`Failed to retrieve document ${id} from ${collection}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async updateDocument(collection: string, id: string, doc: any): Promise<any> {
    try {
      return await typesenseClient.collections(collection).documents(id).update(doc);
    } catch (error) {
      throw new Error(`Failed to update document ${id} in ${collection}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async search(collection: string, options: any): Promise<any> {
    try {
      return await typesenseClient.collections(collection).documents().search(options);
    } catch (error) {
      throw new Error(`Failed to search ${collection}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async listDocuments(collection: string, limit: number = 5000): Promise<any[]> {
    try {
      const results = await typesenseClient.collections(collection).documents().search({
        q: "*",
        query_by: "content",
        per_page: limit
      });
      return results.hits?.map((hit: any) => hit.document) || [];
    } catch (error) {
      throw new Error(`Failed to list documents from ${collection}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const typesenseAdapter = new TypesenseAdapter();
