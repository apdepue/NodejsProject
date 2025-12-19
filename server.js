require('dotenv').config({ path: './nodedb/.env' });
const express = require('express');
const cors = require('cors');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

const uri = process.env.MONGODB_URI || process.env.REACT_APP_MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'Steam_Loco_Forum';
const COLLECTION = process.env.DB_COLLECTION || 'Questions';
const USERS_COLLECTION = process.env.USERS_COLLECTION || 'User_data';

if (!uri) {
  console.error('No MongoDB connection string found in MONGODB_URI or REACT_APP_MONGODB_URI');
}

let client;

async function start() {
  try {
    client = new MongoClient(uri);
    await client.connect();
    console.log('Connected to MongoDB');

    app.get('/api/items', async (req, res) => {
      try {
        const db = client.db(DB_NAME);
        
        // Fetch from both collections
        const questionsCol = db.collection('Questions');
        const answersCol = db.collection('Answers');
        
        const questions = await questionsCol.find({}).limit(100).toArray();
        const answers = await answersCol.find({}).limit(100).toArray();
        
        res.json({ 
          ok: true, 
          questions: {
            count: questions.length,
            items: questions
          },
          answers: {
            count: answers.length,
            items: answers
          }
        });
      } catch (err) {
        console.error('Error fetching items', err);
        res.status(500).json({ ok: false, error: String(err) });
      }
    });

    app.post('/api/login', async (req, res) => {
      try {
        const { username, password } = req.body;

        // Validate input
        if (!username || !password) {
          return res.status(400).json({ error: 'Username and password are required' });
        }

        const db = client.db(DB_NAME);
        const usersCol = db.collection(USERS_COLLECTION);

        // Find user by username
        const user = await usersCol.findOne({ username });

        if (!user || user.password !== password) {
          return res.status(401).json({ error: 'Invalid username or password' });
        }

        res.json({ ok: true, message: 'Login successful' });
      } catch (err) {
        console.error('Error logging in', err);
        res.status(500).json({ error: String(err) });
      }
    });

    app.post('/api/register', async (req, res) => {
      try {
        const { username, password, email } = req.body;

        // Validate input
        if (!username || !password || !email) {
          return res.status(400).json({ error: 'Username, password, and email are required' });
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          return res.status(400).json({ error: 'Invalid email format' });
        }

        const db = client.db(DB_NAME);
        const usersCol = db.collection(USERS_COLLECTION);

        // Check if username already exists
        const existingUser = await usersCol.findOne({ username });
        if (existingUser) {
          return res.status(400).json({ error: 'Username already exists' });
        }

        // Check if email already exists
        const existingEmail = await usersCol.findOne({ email });
        if (existingEmail) {
          return res.status(400).json({ error: 'Email already exists' });
        }

        // Create new user (in production, hash the password)
        const newUser = {
          username,
          password,
          email,
          createdAt: new Date(),
        };

        const result = await usersCol.insertOne(newUser);

        res.status(201).json({
          ok: true,
          message: 'Registration successful',
          userId: result.insertedId,
        });
      } catch (err) {
        console.error('Error registering user', err);
        res.status(500).json({ error: String(err) });
      }
    });

    app.listen(PORT, () => console.log(`API server listening on http://localhost:${PORT}`));
  } catch (err) {
    console.error('Failed to start server', err);
    process.exit(1);
  }
}

start();

process.on('SIGINT', async () => {
  console.log('Shutting down');
  if (client) await client.close();
  process.exit(0);
});
