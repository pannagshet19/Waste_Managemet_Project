const http = require('http');
const url = require('url');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3002;
const uri = 'mongodb://localhost:27017/resident';

// Create a server
const server = http.createServer(async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', 86400); // 24 hours

    // Parse URL
    const parsedUrl = url.parse(req.url, true);

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Handle POST requests to /api/login
if (req.method === 'POST' && parsedUrl.pathname === '/api/login') {
    let body = '';

    // Accumulate request body
    req.on('data', chunk => {
        body += chunk.toString();
    });

    // When request body is fully received
    req.on('end', async () => {
        try {
            const { emailID, wardNumber, resipassword } = JSON.parse(body);
            console.log(`Login attempt for emailID: ${emailID}, wardNumber: ${wardNumber}`);

            // Connect to MongoDB
            const client = new MongoClient(uri);
            await client.connect();

            // Access the resident database and details collection
            const database = client.db('resident');
            const collection = database.collection('details');

            // Find user by email and ward number
            const user = await collection.findOne({ emailID, wardNumber });

            if (!user) {
                console.log('User not found');
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Invalid email or ward number' }));
                await client.close();
                return;
            }

            console.log('User found, comparing passwords...');
            if (resipassword === user.resipassword) {
                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Login successful' }));
            } else {
                res.writeHead(401, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Invalid password' }));
            }

            await client.close();
        } catch (error) {
            console.error('Error processing request:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Internal server error' }));
        }
    });
    return;
}


    // Handle POST requests to /api/register
if (req.method === 'POST' && parsedUrl.pathname === '/api/register') {
    let body = '';

    // Accumulate request body
    req.on('data', chunk => {
        body += chunk.toString();
    });

    // When request body is fully received
    req.on('end', async () => {
        try {
            const { username, regemailID, regwardNumber, regresipassword } = JSON.parse(body);
            console.log(`Registration attempt for username: ${username}, emailID: ${regemailID}, wardNumber: ${regwardNumber}`);

            // Connect to MongoDB
            const client = new MongoClient(uri);
            await client.connect();

            // Access the resident database and details collection
            const database = client.db('resident');
            const collection = database.collection('details');

            // Check if the user already exists
            const existingUser = await collection.findOne({ emailID: regemailID });
            if (existingUser) {
                res.writeHead(409, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'User already exists' }));
                await client.close();
                return;
            }

            // Insert new user into the database
            const result = await collection.insertOne({ username: username, emailID: regemailID, wardNumber: regwardNumber, resipassword: regresipassword });
            console.log('User registered successfully');

            // Respond with success message
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Registration successful' }));

            await client.close();
        } catch (error) {
            console.error('Error processing registration:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Internal server error' }));
        }
    });
    return;
}


    // Default response for other routes
    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ message: 'Not found' }));
});

// Start the server
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
