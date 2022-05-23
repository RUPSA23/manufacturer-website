const express = require('express');
const { MongoClient, ServerApiVersion, ObjectId} = require('mongodb');
require('dotenv').config();
const cors = require('cors');
const port = process.env.PORT || 5000;


const app = express();
app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uuesw.mongodb.net/?retryWrites=true&w=majority`;
// const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.uuesw.mongodb.net/?retryWrites=true&w=majority`;
const client = new MongoClient(uri, { useNewUrlParser: true, useUnifiedTopology: true, serverApi: ServerApiVersion.v1 });
async function run(){
    try{
        await client.connect();
        const tollsCollection = client.db('manufactureFactory').collection('tools');    

        app.get('/tools', async (req, res) => {
            const query = {};
            const cursor = tollsCollection.find(query);
            const alltools = await cursor.toArray();
            res.send(alltools);
        })

        app.get('/tool/:id', async (req, res) => {
          const id = req.params.id;
          const query = {_id: ObjectId(id)};
          const tool = await tollsCollection.findOne(query);
          res.send(tool);
      })
    }
    finally{

    }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Hello From Assignment 12!')
})

app.listen(port, () => {
  console.log(`listening on port ${port}`)
})