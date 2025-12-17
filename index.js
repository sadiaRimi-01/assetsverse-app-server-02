const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require('mongodb');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const bodyParser = require("body-parser");

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


// Get all assets
app.get("/assets", async (req, res) => {
  try {
    const assets = await assetsCollection.find().toArray();
    res.send(assets);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Server error" });
  }
});

// Add new asset
app.post("/assets", async (req, res) => {
  try {
    const asset = req.body;
    const result = await assetsCollection.insertOne(asset);
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Server error" });
  }
});

// Delete an asset by ID
const { ObjectId } = require("mongodb");
app.delete("/assets/:id", async (req, res) => {
  try {
    const id = req.params.id;
    const result = await assetsCollection.deleteOne({ _id: new ObjectId(id) });
    res.send(result);
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Server error" });
  }
});
app.post("/create-checkout-session", async (req, res) => {
  try {
    const { packageId, email } = req.body;
    const selectedPackage = await packageCollection.findOne({ _id: new ObjectId(packageId) });

    if (!selectedPackage) {
      return res.status(404).send({ error: "Package not found" });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: selectedPackage.name,
            },
            unit_amount: selectedPackage.price * 100,
          },
          quantity: 1,
        },
      ],
      success_url: `http://localhost:5173/dashboard/hr?success=true&pkg=${selectedPackage.name}&price=${selectedPackage.price}`,
      cancel_url: `http://localhost:5173/dashboard/upgrade`,
    });

    res.send({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Stripe session failed" });
  }
});
app.post("/payments", async (req, res) => {
  const payment = req.body;
  payment.date = new Date();
  const result = await paymentsCollection.insertOne(payment);
  res.send(result);
});
app.get("/payments", async (req, res) => {
  const email = req.query.email;
  const payments = await paymentsCollection.find({ email }).toArray();
  res.send(payments);
});


    } finally {
        // keep connection open
    }
}

run().catch(console.dir);

// Root route
app.get('/', (req, res) => res.send('Hello World!'));

app.listen(port, () => console.log(`Server running on port ${port}`));
