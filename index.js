const express = require('express')
const cors = require('cors');
const ObjectId = require('mongodb').ObjectId;
const { MongoClient } = require('mongodb');
require('dotenv').config();
const admin = require("firebase-admin");
const app = express();
const port = process.env.PORT || 5000;

// for admin sdk
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});
// middleware 
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.e8ysq.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true });
// Firebase token verify 
async function verifyToken(req, res, next) {
    if (req.headers?.authorization?.startsWith('Bearer ')) {
        const token = req.headers.authorization.split(' ')[1]
        try {
            const decodedUser = await admin.auth().verifyIdToken(token);
            req.decodedEmail = decodedUser.email;
        }
        catch {
        }
    }
    next()
}

async function run() {
    try {
        await client.connect();
        const database = client.db('niche_product');
        const usersCollection = database.collection('users');
        const productsCollection = database.collection('products');
        const ordersCollection = database.collection('orders');
        const reviewCollection = database.collection('review');

        //call api save user 
        app.post('/users', async (req, res) => {
            const user = req.body;
            const result = await usersCollection.insertOne(user);
            res.json(result)
        })
        //find user for admin page validation
        app.get('/users/:email', async (req, res) => {
            const email = req.params.email;
            const query = { email };
            const user = await usersCollection.findOne(query);
            let isAdmin = false;
            if (user?.role === 'admin') {
                isAdmin = true;
            }
            res.json({ admin: isAdmin });
        })
        //make admin
        app.put('/users/admin', verifyToken, async (req, res) => {
            const user = req.body;
            const request = req.decodedEmail;
            if (request) {
                const requestAccount = await usersCollection.findOne({ email: request })
                if (requestAccount.role === 'admin') {
                    const filter = { email: user.email };
                    const updateDoc = { $set: { role: 'admin' } };
                    const result = await usersCollection.updateOne(filter, updateDoc);
                    res.json(result);
                }
            }
            else {
                res.status(403).json({ message: 'You do nat have access to make an admin.' })
            }
        })
        // google upsert 
        app.put('/users', async (req, res) => {
            const user = req.body;
            const filter = { email: user.email };
            const options = { upsert: true };
            const updateDoc = { $set: user };
            const result = await usersCollection.updateOne(filter, updateDoc, options);
            res.json(result);
        })

        // get api for service
        app.get('/products', async (req, res) => {
            const cursor = productsCollection.find({});
            const products = await cursor.toArray();
            res.send(products);
        })
        //call api for set new service
        app.post('/products', async (req, res) => {
            const products = req.body;
            const result = await productsCollection.insertOne(products);
            res.json(result)
        })
        // call api for delete service 
        app.delete('/products/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await productsCollection.deleteOne(query);
            res.json(result);
        })

        //call api for save order
        app.post('/orders', async (req, res) => {
            const orders = req.body;
            const result = await ordersCollection.insertOne(orders);
            res.json(result)
        })
        //get api for one user orders
        app.get('/orders', verifyToken, async (req, res) => {
            const email = req.query.email;
            const query = { email: email };
            const cursor = ordersCollection.find(query);
            const orders = await cursor.toArray();
            res.json(orders);
        })
        //get api for all users orders
        app.get('/all_orders', verifyToken, async (req, res) => {
            const cursor = ordersCollection.find({});
            const orders = await cursor.toArray();
            res.json(orders);
        })
        // update order status 
        app.put('/all_orders/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: ObjectId(id) }
            const options = { upsert: true };
            const updateDoc = {
                $set: {
                    status: "Accept"
                },
            };
            const result = await ordersCollection.updateOne(filter, updateDoc, options)
            res.json(result)
        })
        // call api for delete order 
        app.delete('/orders/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: ObjectId(id) };
            const result = await ordersCollection.deleteOne(query);
            res.json(result);
        })

        //call api for give review
        app.post('/review', async (req, res) => {
            const reviews = req.body;
            const result = await reviewCollection.insertOne(reviews);
            res.json(result)
        })
    }
    finally {
        // await client.close();
    }
}

run().catch(console.dir)

app.get('/', (req, res) => {
    res.send('Niche product server is running ...');
})

app.listen(port, () => {
    console.log('Server running...', port)
})