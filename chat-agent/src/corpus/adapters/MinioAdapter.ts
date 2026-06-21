import { getMinIO } from "../../storage/MinioClient";

export class MinioAdapter {
  async listObjects(bucket: string): Promise<Array<{ name: string; size: number; lastModified: Date }>> {
    try {
      const client = getMinIO();
      const objects: Array<{ name: string; size: number; lastModified: Date }> = [];

      const objectsList = await client.listObjects(bucket, "", true);

      return new Promise((resolve, reject) => {
        objectsList.on("data", (obj) => {
          if (obj.name) {
            objects.push({
              name: obj.name,
              size: obj.size || 0,
              lastModified: obj.lastModified || new Date()
            });
          }
        });
        objectsList.on("end", () => resolve(objects));
        objectsList.on("error", reject);
      });
    } catch (error) {
      throw new Error(`Failed to list objects in bucket ${bucket}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  async getObjectMetadata(bucket: string, key: string): Promise<Record<string, string>> {
    try {
      const client = getMinIO();
      const stat = await client.statObject(bucket, key);
      return {
        ...stat.metaData,
        "x-amz-meta-sha256": stat.metaData?.["x-amz-meta-sha256"] || ""
      };
    } catch (error) {
      throw new Error(`Failed to get metadata for ${key} in bucket ${bucket}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
}

export const minioAdapter = new MinioAdapter();
