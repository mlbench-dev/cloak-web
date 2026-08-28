import { MongoClient } from "mongodb";

const options = {
  connectTimeoutMS: 10000, // 10 seconds
  serverSelectionTimeoutMS: 10000, // 10 seconds
};

let prodClientPromise: Promise<MongoClient> | undefined;

// Reads DATABASE_URL and opens the connection lazily, on first use, rather
// than at module load. Next.js imports every route module while collecting
// page data during `next build` — DATABASE_URL isn't available at that point
// (it's injected at container runtime via Secret Manager), so touching
// process.env or constructing a MongoClient at module scope would fail the
// build.
function connect(): Promise<MongoClient> {
  const uri = process.env.DATABASE_URL;
  if (!uri) {
    throw new Error('Invalid/Missing environment variable: "DATABASE_URL"');
  }

  if (process.env.NODE_ENV === "development") {
    // In development mode, use a global variable so that the value
    // is preserved across module reloads caused by HMR (Hot Module Replacement).
    const globalWithMongo = global as typeof globalThis & {
      _mongoClientPromise?: Promise<MongoClient>;
    };

    if (!globalWithMongo._mongoClientPromise) {
      globalWithMongo._mongoClientPromise = new MongoClient(
        uri,
        options,
      ).connect();
    }
    return globalWithMongo._mongoClientPromise;
  }

  // In production mode, it's best to not use a global variable.
  if (!prodClientPromise) {
    console.log("Initializing MongoDB connection in production...");
    prodClientPromise = new MongoClient(uri, options)
      .connect()
      .then((client) => {
        console.log("Successfully connected to MongoDB");
        return client;
      })
      .catch((err) => {
        console.error("Failed to connect to MongoDB:", err);
        // Let a later request retry instead of caching the failure forever.
        prodClientPromise = undefined;
        throw err;
      });
  }
  return prodClientPromise;
}

// A thenable, not a real Promise: building this object must stay side-effect
// free (no env lookup, no MongoClient) so importing this module is always
// safe. The real connection only happens once something awaits this export.
const clientPromise: PromiseLike<MongoClient> = {
  then(onfulfilled, onrejected) {
    return connect().then(onfulfilled, onrejected);
  },
};

// Export a module-scoped MongoClient promise. By doing this in a
// separate module, the client can be shared across functions.
export default clientPromise;

export async function getDb() {
  const client = await connect();
  return client.db(); // Uses the database name from the connection string
}
