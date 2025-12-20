const express = require('express');
const cors = require('cors');
require('dotenv').config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion } = require('mongodb');
const app = express();
const port = process.env.PORT || 3000;
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)

app.use(express.json());
app.use(cors()); 
const PACKAGE_LIMIT_MAP = {
  Starter: 5,
  Professional: 25,
  Enterprise: 9999, 
};

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
    const requestsCollection = db.collection("requests");
    const assignedAssetsCollection = db.collection("assignedAssets");
    const employeeAffiliationsCollection = db.collection("employeeAffiliations");
    const paymentsCollection = db.collection("payments");




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



    // Get all assets-----------------------------
    app.get("/assets", async (req, res) => {
      try {
        const assets = await assetsCollection.find().toArray();
        res.send(assets);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Server error" });
      }
    });

    // Add new asset-------------------------
    app.post("/assets", async (req, res) => {
      try {
        const asset = req.body;

        // Check required fields
        if (!asset.productName || !asset.productType || asset.productQuantity == null) {
          return res.status(400).send({ error: "Missing required fields" });
        }

        // Ensure hrEmail is attached
        if (!asset.hrEmail) {
          return res.status(400).send({ error: "HR email required" });
        }

        // Track availableQuantity separately--
        asset.availableQuantity = asset.productQuantity;

        const result = await assetsCollection.insertOne(asset);
        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({ error: "Server error" });
      }
    });



    // Delete an asset by ID---------------------
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

    // all request----------------------
    app.get("/hr/requests", async (req, res) => {
      const hrEmail = req.query.hrEmail;
      const requests = await requestsCollection
        .find({ hrEmail })
        .sort({ requestDate: -1 })
        .toArray();
      res.send(requests);
    });
    // --------------------------------------------------------
    app.patch("/hr/requests/approve/:id", async (req, res) => {
      try {
        const requestId = req.params.id;
        const hrEmail = req.body.hrEmail;

        const request = await requestsCollection.findOne({ _id: new ObjectId(requestId) });
        if (!request) return res.status(404).send({ message: "Request not found" });

        // 1️⃣ Reduce asset quantity
        await assetsCollection.updateOne(
          { _id: new ObjectId(request.assetId) },
          { $inc: { productQuantity: -1 } }
        );

        // 2️⃣ Update request
        await requestsCollection.updateOne(
          { _id: new ObjectId(requestId) },
          {
            $set: {
              requestStatus: "approved",
              approvalDate: new Date(),
              processedBy: hrEmail,
            },
          }
        );

        // 3️⃣ Add to assignedAssets
        await assignedAssetsCollection.insertOne({
          assetId: request.assetId,
          assetName: request.assetName,
          assetImage: request.assetImage || "",
          assetType: request.assetType,
          employeeEmail: request.requesterEmail,
          employeeName: request.requesterName,
          hrEmail: request.hrEmail,
          companyName: request.companyName,
          assignmentDate: new Date(),
          returnDate: null,
          status: "assigned",
        });

        // 4️⃣ Create affiliation if not exists
        const exists = await employeeAffiliationsCollection.findOne({
          employeeEmail: request.requesterEmail,
          hrEmail: request.hrEmail,
        });

        if (!exists) {
          await employeeAffiliationsCollection.insertOne({
            employeeEmail: request.requesterEmail,
            employeeName: request.requesterName,
            hrEmail: request.hrEmail,
            companyName: request.companyName,
            affiliationDate: new Date(),
            status: "active",
          });
        }

        res.send({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Approve failed" });
      }
    });
    //---------------------------
    app.patch("/hr/requests/reject/:id", async (req, res) => {
      const requestId = req.params.id;
      const hrEmail = req.body.hrEmail;

      await requestsCollection.updateOne(
        { _id: new ObjectId(requestId) },
        {
          $set: {
            requestStatus: "rejected",
            processedBy: hrEmail,
          },
        }
      );

      res.send({ success: true });
    });


    // employee list----------------------------
    app.get("/hr/employees", async (req, res) => {
      try {
        const hrEmail = req.query.hrEmail;

        const employees = await employeeAffiliationsCollection
          .find({ hrEmail, status: "active" })
          .toArray();

        // Assets count per employee
        const employeesWithAssets = await Promise.all(
          employees.map(async (emp) => {
            const assetsCount = await assignedAssetsCollection.countDocuments({
              employeeEmail: emp.employeeEmail,
              status: "assigned",
            });

            return { ...emp, assetsCount };
          })
        );

        res.send(employeesWithAssets);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to load employees" });
      }
    });

    // -------------------------------------
    app.patch("/hr/employees/remove/:email", async (req, res) => {
      try {
        const employeeEmail = req.params.email;
        const hrEmail = req.body.hrEmail;

        // Set affiliation inactive
        await employeeAffiliationsCollection.updateOne(
          { employeeEmail, hrEmail },
          { $set: { status: "inactive" } }
        );

        res.send({ success: true });
      } catch (err) {
        res.status(500).send({ error: "Remove failed" });
      }
    });
    // ---------------------------------------------
    app.get("/hr/employee-limit/:email", async (req, res) => {
      const hr = await usersCollection.findOne({ email: req.params.email });
      res.send({ limit: hr?.packageLimit || 0 });
    });
    // request assets page 
    // Get available assets for employee request---------------
    app.get("/assets/available", async (req, res) => {
      try {
        const hrEmail = req.query.hrEmail; // optional filter if needed
        const assets = await assetsCollection
          .find({ availableQuantity: { $gt: 0 } })
          .toArray();
        res.send(assets);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to load assets" });
      }
    });

    // Create asset request-------------------
    app.post("/requests", async (req, res) => {
      try {
        const {
          assetId,
          assetName,
          assetType,
          requesterName,
          requesterEmail,
          hrEmail,
          companyName,
          note,
        } = req.body;

        // Validate required fields
        if (!assetId || !requesterEmail || !hrEmail) {
          return res.status(400).send({ success: false, message: "Missing required fields" });
        }

        // Ensure asset exists
        const asset = await assetsCollection.findOne({ _id: new ObjectId(assetId) });
        if (!asset) {
          return res.status(404).send({ success: false, message: "Asset not found" });
        }

        const requestDoc = {
          assetId: new ObjectId(assetId),
          assetName: assetName || asset.productName,
          assetType: assetType || asset.productType,
          requesterName,
          requesterEmail,
          hrEmail: hrEmail || asset.hrEmail,
          companyName: companyName || asset.companyName || "",
          requestDate: new Date(),
          approvalDate: null,
          requestStatus: "pending",
          note: note || "",
          processedBy: null,
        };

        const result = await requestsCollection.insertOne(requestDoc);

        if (result.insertedId) {
          res.send({ success: true });
        } else {
          res.send({ success: false, message: "Failed to save request" });
        }

      } catch (err) {
        console.error("❌ Request submit error:", err);
        res.status(500).send({ success: false, message: "Server error" });
      }
    });

    // Get assigned assets for employee---------------
    app.get("/assigned-assets", async (req, res) => {
      const email = req.query.email;
      const assets = await client.db("assets_verse_db")
        .collection("assignedAssets")
        .find({ employeeEmail: email })
        .toArray();
      res.send(assets);
    });

    // Return asset------------------------
    app.patch("/return-asset/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const assignedAsset = await client.db("assets_verse_db")
          .collection("assignedAssets")
          .findOne({ _id: new ObjectId(id) });

        if (!assignedAsset) return res.status(404).send({ success: false, message: "Asset not found" });

        await client.db("assets_verse_db")
          .collection("assignedAssets")
          .updateOne({ _id: new ObjectId(id) }, { $set: { status: "returned", returnDate: new Date() } });

        // Increase available quantity in assets
        await client.db("assets_verse_db")
          .collection("assets")
          .updateOne({ _id: new ObjectId(assignedAsset.assetId) }, { $inc: { availableQuantity: 1 } });

        res.send({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false });
      }
    });






    // Get all requests-------------
    app.get("/requests", async (req, res) => {
      const requests = await client.db("assets_verse_db")
        .collection("requests")
        .find()
        .sort({ requestDate: -1 })
        .toArray();
      res.send(requests);
    });

    // Approve request------------------------
    app.patch("/approve-request/:id", async (req, res) => {
      try {
        const id = req.params.id;
        const request = await client.db("assets_verse_db")
          .collection("requests")
          .findOne({ _id: new ObjectId(id) });

        if (!request || request.requestStatus !== "pending")
          return res.status(400).send({ success: false, message: "Invalid request" });

        // Deduct asset quantity
        const asset = await client.db("assets_verse_db")
          .collection("assets")
          .findOne({ _id: new ObjectId(request.assetId) });

        if (!asset || asset.availableQuantity <= 0)
          return res.status(400).send({ success: false, message: "Asset not available" });

        await client.db("assets_verse_db")
          .collection("assets")
          .updateOne(
            { _id: new ObjectId(asset._id) },
            { $inc: { availableQuantity: -1 } }
          );

        // Update request status
        await client.db("assets_verse_db")
          .collection("requests")
          .updateOne(
            { _id: new ObjectId(id) },
            { $set: { requestStatus: "approved", approvalDate: new Date(), processedBy: request.hrEmail } }
          );

        // Add to assignedAssets
        await client.db("assets_verse_db")
          .collection("assignedAssets")
          .insertOne({
            assetId: asset._id,
            assetName: asset.productName,
            assetImage: asset.productImage,
            assetType: asset.productType,
            employeeEmail: request.requesterEmail,
            employeeName: request.requesterName,
            hrEmail: request.hrEmail,
            companyName: request.companyName,
            assignmentDate: new Date(),
            status: "assigned",
          });

        // Create affiliation if first request
        const existingAffiliation = await client.db("assets_verse_db")
          .collection("employeeAffiliations")
          .findOne({ employeeEmail: request.requesterEmail, hrEmail: request.hrEmail });

        if (!existingAffiliation) {
          await client.db("assets_verse_db")
            .collection("employeeAffiliations")
            .insertOne({
              employeeEmail: request.requesterEmail,
              employeeName: request.requesterName,
              hrEmail: request.hrEmail,
              companyName: request.companyName,
              companyLogo: "", // optional
              affiliationDate: new Date(),
              status: "active",
            });
        }

        res.send({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false });
      }
    });


    // Reject request---------------------
    app.patch("/reject-request/:id", async (req, res) => {
      try {
        const id = req.params.id;
        await client.db("assets_verse_db")
          .collection("requests")
          .updateOne(
            { _id: new ObjectId(id) },
            { $set: { requestStatus: "rejected", processedBy: "HR" } }
          );
        res.send({ success: true });
      } catch (err) {
        console.error(err);
        res.status(500).send({ success: false });
      }
    });
    // ------------team
    // Get all employee affiliations
    app.get('/api/affiliations', async (req, res) => {
      try {
        // Fetch all active affiliations
        const affiliations = await employeeAffiliationsCollection
          .find({ status: "active" })
          .toArray();

        // Optional: Include employee details if stored elsewhere (e.g., photo, position)
        const employees = await Promise.all(
          affiliations.map(async (aff) => {
            const user = await usersCollection.findOne({ email: aff.employeeEmail });
            return {
              companyName: aff.companyName,
              employeeName: aff.employeeName,
              employeeEmail: aff.employeeEmail,
              position: user?.role || "Employee",
              photo: user?.photo || "", // default photo if exists
              birthday: user?.birthday || null
            };
          })
        );

        res.send(employees);
      } catch (err) {
        console.error(err);
        res.status(500).send({ error: "Failed to fetch affiliations" });
      }
    });


    // payment method 
app.post("/create-checkout-session", async (req, res) => {
  const { email, packageName, price, employeeLimit } = req.body;

  try {
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      customer_email: email,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: `${packageName} Package`,
            },
            unit_amount: price * 100,
          },
          quantity: 1,
        },
      ],
      metadata: {
        email,
        packageName,
        employeeLimit,
        amount: price,
      },
    success_url: `${process.env.CLIENT_URL}/dashboard/hr/payment-success?packageName=${packageName}&employeeLimit=${employeeLimit}&amount=${price}&session_id={CHECKOUT_SESSION_ID}`,


      cancel_url: `${process.env.CLIENT_URL}/dashboard/hr/upgrade`,
    });

    res.send({ url: session.url });
  } catch (error) {
    console.error(error);
    res.status(500).send({ error: "Stripe session failed" });
  }
});



app.post("/payments/success", async (req, res) => {
  const { email, packageName,  amount, sessionId } = req.body;

  if (!email || !packageName ||  !amount || !sessionId) {
    return res.status(400).send({
      success: false,
      message: "Missing required fields",
    });
  }
const employeeLimit = PACKAGE_LIMIT_MAP[packageName];
if (!employeeLimit) {
    return res.status(400).send({
      success: false,
      message: "Invalid package name",
    });
  }
  try {
    // 🔒 1️⃣ DUPLICATE CHECK
    const alreadyPaid = await paymentsCollection.findOne({
      transactionId: sessionId,
    });

    if (alreadyPaid) {
      return res.send({
        success: true,
        message: "Payment already processed",
      });
    }

    // 2️⃣ UPDATE USER PLAN
    await usersCollection.updateOne(
      { email },
      {
        $set: {
          package: packageName,
          packageLimit: employeeLimit,
        },
      }
    );

    // 3️⃣ INSERT PAYMENT
    await paymentsCollection.insertOne({
      hrEmail: email,
      packageName,
      employeeLimit,
      amount: Number(amount),
      transactionId: sessionId, // 🔥 UNIQUE
      paymentDate: new Date(),
      status: "completed",
    });

    res.send({ success: true });
  } catch (err) {
    console.error("❌ Payment save error:", err);
    res.status(500).send({ success: false });
  }
});



app.get("/payments/:email", async (req, res) => {
  const email = req.params.email;

  const result = await paymentsCollection
    .find({ hrEmail: email })
    .sort({ paymentDate: -1 })
    .toArray();

  res.send(result);
});


  } finally {
    
  }
}

run().catch(console.dir);

// Root route
app.get('/', (req, res) => res.send('Hello World!'));

app.listen(port, () => console.log(`Server running on port ${port}`));
