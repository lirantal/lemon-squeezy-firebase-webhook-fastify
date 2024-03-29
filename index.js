// The Cloud Functions for Firebase SDK to create Cloud Functions and triggers.
const { logger } = require("firebase-functions");
const { onRequest } = require("firebase-functions/v2/https");

// The Firebase Admin SDK to access Firestore.
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");

initializeApp();

exports.lmswebhook = onRequest(async (req, res) => {
  // capture the data coming from the HTTP request
  const requestData = req.body;

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

  return res.status(200).send();
});
