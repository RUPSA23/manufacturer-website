const express = require("express");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const cors = require("cors");
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);
const port = process.env.PORT || 5000;

const app = express();
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uuesw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
  

function verifyJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if(!authHeader) {
    return res.status(401).send({ message: 'UnAuthorized access' });
  }
  const token = authHeader.split(' ')[1];
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, function(err, decoded) {
    if(err) {
      return res.status(403).send({ message: 'Forbidden access' });
    }
    req.decoded = decoded;
    next();
  })
}

async function run() {
  try {
    await client.connect();
    const toolsCollection = client.db("manufactureFactory").collection("tools");
    const reviewCollection = client
      .db("manufactureFactory")
      .collection("reviews");
    const userCollection = client.db("manufactureFactory").collection("user");
    const orderCollection = client.db("manufactureFactory").collection("order");
    const registeredUserCollection = client.db("manufactureFactory").collection("regisUsers");
    const paymentCollection = client.db("manufactureFactory").collection("payment");

    app.post("/create-payment-intent", async (req, res) => {
      const order = await req.body;
      const price = await order.price;
      const amount = await price*100;
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "inr",
        payment_method_types: ["card"],
      });
      res.send({ clientSecret: paymentIntent.client_secret });
    });

    app.get('/users', verifyJWT, async (req, res) => {
      const users = await registeredUserCollection.find().toArray();
      res.send(users);
    })

    app.get('/admin/:email', async (req, res) => {
        const email = req.params.email;
        const user = await registeredUserCollection.findOne({email: email});
        const isAdmin = user.role === 'admin';
        res.send({admin: isAdmin});
    })

    app.put('/user/admin/:email', verifyJWT, async (req, res) => {
      const email = req.params.email;
      const requester = req.decoded.email;
      const requesterAccount = await registeredUserCollection.findOne({email: requester});
      if(requesterAccount.role === 'admin'){
        const filter = { email: email };
        const updatedDoc = {
          $set: {role: 'admin'},
        };
        const result = await registeredUserCollection.updateOne(filter, updatedDoc);
        res.send({result});
      }
      else{
        res.status(403).send({message: 'forbidden'});
      }
      
    })

    app.put('/user/:email', async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true};
      const updatedDoc = {
        $set: user,
      };
      const result = await registeredUserCollection.updateOne(filter, updatedDoc, options);
      const token = jwt.sign({email: email}, process.env.ACCESS_TOKEN_SECRET, {expiresIn: '1hr'})
      res.send({result, token});
    })

    app.get("/tools", async (req, res) => {
      const query = {};
      const cursor = toolsCollection.find(query);
      const alltools = await cursor.toArray();
      res.send(alltools);
    });

    app.post("/addtools", async (req, res) => {
      const tool = req.body;
      const result = await toolsCollection.insertOne(tool);
      res.send(result);
    });

    app.get("/tool/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const tool = await toolsCollection.findOne(query);
      res.send(tool);
    });

    app.get("/tool/:name", async (req, res) => {
      const name = req.params.name;
      const query = {"name" : {$regex : name}};
      const tool = await toolsCollection.findOne(query);
      console.log("SuggestedItems: "+tool);
      res.send(tool);
    });

   

    app.post("/addReview", async (req, res) => {
      const review = req.body;
      const result = await reviewCollection.insertOne(review);
      res.send(result);
    });

    app.post("/addOrderItem", async (req, res) => {
      const orderItem = req.body;
      const result = await orderCollection.insertOne(orderItem);
      res.send(result);
    });

    app.post("/addUser", async (req, res) => {
      const user = req.body;
      const query = { email_address: user.email_address };
      const options = { upsert: true };
      const updatedDoc = {
        $set: {
          LinkedIn_profile_link: user.LinkedIn_profile_link,
          country: user.country,
          street_address: user.street_address,
          city: user.city,
          state: user.state,
          phone: user.phone,
        },
      };
      const result = await userCollection.updateOne(query, updatedDoc, options);
      const res1 = await userCollection.findOne(query);
      res.send(res1);
    });

    app.get("/allReviews", async (req, res) => {
      const query = {};
      const cursor = reviewCollection.find(query);
      const allReviews = await cursor.toArray();
      res.send(allReviews);
    });

    app.get("/myOrders/:email",  verifyJWT, async (req, res) => {
      const email = req.params.email;
      const decodedEmail = req.decoded.email;
    if(email === decodedEmail){
      const query = { userEmail: email };
      const cursor = orderCollection.find(query);
      const allOrders = await cursor.toArray();
      res.send(allOrders);
    }
    else {
      return res.status(403).send({message: 'forbidden access'});
    }
     
    });

    app.get("/order/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const order = await orderCollection.findOne(query);
      res.send(order);
    });

    app.patch('/order/:id', verifyJWT, async (req, res) => {
      console.log("PATCH REQEST");
      const id = req.params.id;
      const payment = req.body;
      const filter = {_id: ObjectId(id)};
      const updatedDoc = {
        $set: { 
          isPaid: true,
          transactionId: payment.transactionId
        }
      }
      const updatedOrder = await orderCollection.updateOne(filter, updatedDoc);
      const result = await paymentCollection.insertOne(payment);
      res.send(updatedOrder);
    });

    app.get("/userDetails/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email_address: email };
      const cursor = await userCollection.findOne(query);
      res.send(cursor);
    });

    app.delete("/delete/:id", async (req, res)=> {
      // console.log("Hi");
      const id = req.params.id;
      const query = {_id: ObjectId(id)};
      const result = await toolsCollection.deleteOne(query);
      // console.log(result);
      res.send(result);
  });

    app.delete("/order/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: ObjectId(id) };
      const result = await orderCollection.deleteOne(query);
      res.send(result);
    });
  } finally {
  }
}

run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Hello From Assignment 12!");
});

app.listen(port, () => {
  console.log(`listening on port ${port}`);
});
