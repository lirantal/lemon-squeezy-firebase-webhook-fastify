// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
const { logger } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");

// The Firebase Admin SDK to access Firestore.
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

// The crypto module to validate the webhook request
const crypto = require("crypto");

const LEMON_SQUEEZY_WEBHOOK_SECRET =
  process.env.APP_LEMON_SQUEEZY_WEBHOOK_SECRET;
const TEST_MODE = process.env.APP_TEST_MODE;

initializeApp();

function validateWebhookRequest(request) {
  const secret = LEMON_SQUEEZY_WEBHOOK_SECRET;
  const hmac = crypto.createHmac("sha256", secret);
  const digest = Buffer.from(
    hmac.update(request.rawBody).digest("hex"),
    "utf8"
  );
  const signature = Buffer.from(request.headers["x-signature"] || "", "utf8");

  if (!crypto.timingSafeEqual(digest, signature)) {
    throw new Error("Invalid signature.");
  }
}

async function registerRoutes(fastify) {
  fastify.addContentTypeParser("application/json", {}, (req, payload, done) => {
    req.rawBody = payload.rawBody;
    done(null, payload.body);
  });

  fastify.post("/lms-webhook", async (request, reply) => {
    validateWebhookRequest(request);

    const requestData = request.body;

    // following is an example of some of the data that exists on
    // the Lemon Squeezy webhook:
    // const orderTransaction = {
    //   type: requestData.data.type,
    //   id: requestData.data.id,
    //   customer_id: requestData.data.customer_id,
    //   identifier: requestData.data.identifier,
    //   order_number: requestData.data.order_number,
    //   user_name: requestData.data.user_name,
    //   user_email: requestData.data.user_email,
    //   status: requestData.data.status,
    //   total: requestData.data.total,
    //   created_at: requestData.data.created_at,
    //   updated_at: requestData.data.updated_at,
    // };

    // @TODO you want to change this to whatever identifier you
    // pass in the webhook via the custom fields
    const uid = requestData.uid;
    // @TODO similarly if you want to use your own unique
    // plan or order identifier
    const planId = requestData.planId;

    // The following
    const orderId = requestData.data.id;
    const userEmail = requestData.data.user_email;

    const db = await getFirestore();

    // Construct the collection path
    const docRef = db
      .collection("users")
      .doc(uid)
      .collection("plans")
      .doc(planId);

    // Use a transaction to ensure atomic update
    await db.runTransaction(async (transaction) => {
      // Get the document snapshot
      const doc = await transaction.get(docRef);

      // Create the document if it doesn't exist
      if (!doc.exists) {
        transaction.set(docRef, { orderId, userEmail });
      } else {
        // Update the document if it already exists
        transaction.update(docRef, { orderId, userEmail });
      }
    });

    return reply.code(200).send();
  });
}

const fastify = require("fastify")({
  logger: true,
});

const fastifyApp = async (request, reply) => {
  await registerRoutes(fastify);
  await fastify.ready();
  fastify.server.emit("request", request, reply);
};

exports.app = onRequest(fastifyApp);
