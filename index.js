const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require('mongodb');
const bodyParser = require("body-parser");
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const app = express();
const port = process.env.PORT || 3000;


app.use(express.json());
app.use(cors()); // Allow requests from all origins

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vnd8kjj.mongodb.net/?appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});

async function run() {
    try {
        await client.connect();
        const db = client.db('assets_verse_db');
        const usersCollection = db.collection('users');
        const packageCollection = db.collection('packages');
        const assetsCollection = db.collection("assets");
        const paymentsCollection = db.collection('payments');
        const requestsCollection = db.collection("requests");
const assignedAssetsCollection = db.collection("assignedAssets");
const employeeAffiliationsCollection = db.collection("employeeAffiliations");




        console.log("Connected to MongoDB!");

        // -------------------------------
        // Users Routes
        // -------------------------------

        // Register HR / Employee
        app.post('/users', async (req, res) => {
            try {
                const user = req.body;
                const existingUser = await usersCollection.findOne({ email: user.email });

                if (existingUser) {
                    return res.status(400).send({ message: 'user-exists' });
                }

                const result = await usersCollection.insertOne(user);
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Server error' });
            }
        });

        // Get user by email
        app.get('/users/:email', async (req, res) => {
            try {
                const email = req.params.email;
                const user = await usersCollection.findOne({ email });
                res.send(user);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Server error' });
            }
        });

        // Google login route
        app.post("/google-user", async (req, res) => {
            try {
                const user = req.body;
                const exists = await usersCollection.findOne({ email: user.email });
                if (!exists) {
                    await usersCollection.insertOne({ ...user, role: "employee" });
                }
                res.send({ success: true });
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Server error' });
            }
        });

        // JWT token route
        app.post("/jwt", async (req, res) => {
            try {
                const token = jwt.sign(req.body, process.env.JWT_SECRET, { expiresIn: "7d" });
                res.send({ token });
            } catch (error) {
                res.status(500).send({ error: "JWT Error" });
            }
        });

        // JWT Middleware
        const verifyToken = (req, res, next) => {
            const authHeader = req.headers.authorization;
            if (!authHeader) return res.status(401).send("Unauthorized");

            const token = authHeader.split(" ")[1];
            jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
                if (err) return res.status(403).send("Forbidden");
                req.decoded = decoded;
                next();
            });
        };

        // HR Middleware
        const verifyHR = async (req, res, next) => {
            const user = await usersCollection.findOne({ email: req.decoded.email });
            if (user?.role !== "hr") return res.status(403).send("HR only");
            next();
        };

        // Packages route
        app.get('/packages', async (req, res) => {
            try {
                const result = await packageCollection.find().toArray();
                res.send(result);
            } catch (error) {
                console.error(error);
                res.status(500).send({ error: 'Server error' });
            }
        });
        // Assets collection


























// payment


app.post('/create-checkout-session', async (req, res) => {
    const { packageId, email } = req.body;

    const pkg = await packageCollection.findOne({ _id: new ObjectId(packageId) });
    if (!pkg) return res.status(404).send({ error: "Package not found" });

    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      payment_method_types: ["card"],
      customer_email: email,
      line_items: [{
        price_data: {
          currency: "usd",
          product_data: { name: pkg.name },
          unit_amount: pkg.price * 100,
        },
        quantity: 1
      }],
      metadata: {
        hrEmail: email,
        packageName: pkg.name,
        employeeLimit: pkg.employeeLimit || 5
      },
      success_url: `${process.env.CLIENT_URL}/dashboard/hr?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.CLIENT_URL}/dashboard/hr`,
    });

    res.send({ url: session.url });
  });

  // ---------------- PAYMENT SUCCESS ----------------
  app.get('/payment-success', async (req, res) => {
    try {
      const sessionId = req.query.session_id;
      if (!sessionId) return res.send({ success: false });

      const session = await stripe.checkout.sessions.retrieve(sessionId, {
        expand: ["payment_intent"]
      });

      if (session.payment_status !== "paid") {
        return res.send({ success: false });
      }

      const paymentExists = await paymentsCollection.findOne({
        transactionId: session.payment_intent.id
      });

      if (paymentExists) {
        return res.send({ success: true });
      }

      // ✅ SAVE PAYMENT
      await paymentsCollection.insertOne({
        hrEmail: session.metadata.hrEmail,
        packageName: session.metadata.packageName,
        employeeLimit: Number(session.metadata.employeeLimit),
        amount: session.amount_total / 100,
        transactionId: session.payment_intent.id,
        paymentDate: new Date(),
        status: "completed",
      });

      // ✅ UPDATE USER PACKAGE
      await usersCollection.updateOne(
        { email: session.metadata.hrEmail },
        {
          $set: {
            package: session.metadata.packageName,
            packageLimit: Number(session.metadata.employeeLimit),
            status: "active"
          }
        }
      );

      res.send({ success: true });

    } catch (err) {
      console.error("❌ payment-success error:", err);
      res.status(500).send({ success: false });
    }
  });

  // ---------------- PAYMENT HISTORY ----------------
  app.get('/payments', async (req, res) => {
    const email = req.query.email;
    res.send(
      await paymentsCollection
        .find({ hrEmail: email })
        .sort({ paymentDate: -1 })
        .toArray()
    );
  });


        

    } finally {
        // keep connection open
    }
}

run().catch(console.dir);

// Root route
app.get('/', (req, res) => res.send('Hello World!'));

app.listen(port, () => console.log(`Server running on port ${port}`));
