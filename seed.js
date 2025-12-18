// const { MongoClient, ObjectId } = require("mongodb");
// require('dotenv').config();

// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.vnd8kjj.mongodb.net/?appName=Cluster0`;
// const client = new MongoClient(uri);

// async function seedData() {
//   try {
//     await client.connect();
//     const db = client.db("assets_verse_db");

//     // Clear existing test data (optional)
//     await db.collection("users").deleteMany({});
    
//     await db.collection("assets").deleteMany({});
//     await db.collection("requests").deleteMany({});
//     await db.collection("assignedAssets").deleteMany({});
//     await db.collection("employeeAffiliations").deleteMany({});

//     // ---------------- Users ----------------
//     const hrUser = {
//       _id: new ObjectId(),
//       name: "HR Manager",
//       email: "hr@example.com",
//       role: "hr",
//       package: "Basic",
//       packageLimit: 5,
//       status: "active"
//     };

//     const employee1 = {
//       _id: new ObjectId(),
//       name: "Alice Employee",
//       email: "alice@example.com",
//       role: "employee"
//     };

//     const employee2 = {
//       _id: new ObjectId(),
//       name: "Bob Employee",
//       email: "bob@example.com",
//       role: "employee"
//     };

//     await db.collection("users").insertMany([hrUser, employee1, employee2]);

//     // ---------------- Packages ----------------
//     const packages = [
//       { name: "Basic", price: 10, employeeLimit: 5 },
//       { name: "Pro", price: 20, employeeLimit: 10 }
//     ];
//     await db.collection("packages").insertMany(packages);

//     // ---------------- Assets ----------------
//     const asset1 = {
//       _id: new ObjectId(),
//       productName: "Laptop",
//       productImage: "https://via.placeholder.com/150",
//       productType: "Returnable",
//       productQuantity: 5,
//       availableQuantity: 5,
//       dateAdded: new Date(),
//       hrEmail: hrUser.email,
//       companyName: "ABC Corp"
//     };

//     const asset2 = {
//       _id: new ObjectId(),
//       productName: "Mouse",
//       productImage: "https://via.placeholder.com/150",
//       productType: "Non-returnable",
//       productQuantity: 10,
//       availableQuantity: 10,
//       dateAdded: new Date(),
//       hrEmail: hrUser.email,
//       companyName: "ABC Corp"
//     };

//     await db.collection("assets").insertMany([asset1, asset2]);

//     // ---------------- Employee Affiliations ----------------
//     const affiliation = {
//       employeeEmail: employee1.email,
//       employeeName: employee1.name,
//       hrEmail: hrUser.email,
//       companyName: "ABC Corp",
//       companyLogo: "https://via.placeholder.com/100",
//       affiliationDate: new Date(),
//       status: "active"
//     };

//     await db.collection("employeeAffiliations").insertOne(affiliation);

//     // ---------------- Assigned Assets ----------------
//     const assignedAsset = {
//       assetId: asset2._id,
//       assetName: asset2.productName,
//       assetImage: asset2.productImage,
//       assetType: asset2.productType,
//       employeeEmail: employee2.email,
//       employeeName: employee2.name,
//       hrEmail: hrUser.email,
//       companyName: "ABC Corp",
//       assignmentDate: new Date(),
//       returnDate: null,
//       status: "assigned"
//     };

//     await db.collection("assignedAssets").insertOne(assignedAsset);

//     // ---------------- Requests ----------------
//     const request = {
//       assetId: asset1._id,
//       assetName: asset1.productName,
//       assetType: asset1.productType,
//       requesterName: employee1.name,
//       requesterEmail: employee1.email,
//       hrEmail: hrUser.email,
//       companyName: "ABC Corp",
//       requestDate: new Date(),
//       approvalDate: null,
//       requestStatus: "pending",
//       note: "Need laptop for project",
//       processedBy: null
//     };

//     await db.collection("requests").insertOne(request);

//     console.log("✅ Test data inserted successfully!");
//   } catch (err) {
//     console.error("❌ Seed error:", err);
//   } finally {
//     await client.close();
//   }
// }

// seedData();
