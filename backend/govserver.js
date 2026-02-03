const http = require('http');
const url = require('url');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3000;
const uri = 'mongodb://localhost:27017/government';

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
            const { governmentID, govpassword } = JSON.parse(body);
            console.log(`Login attempt for governmentID: ${governmentID}`);

            const client = new MongoClient(uri);

            try {
                await client.connect();
                const database = client.db('government');
                const collection = database.collection('details');

                const user = await collection.findOne({ governmentID: governmentID });
                if (!user) {
                    console.log('User not found');
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Invalid ID or password' }));
                    return;
                }

                console.log('User found, comparing passwords...');
                if (user.govpassword === govpassword) {
                    res.writeHead(200, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Login successful' }));
                } else {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Invalid ID or password' }));
                }
            } catch (error) {
                console.error(error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Internal server error' }));
            } finally {
                await client.close();
            }
        });
        return;
    }

    // Handle GET requests to fetch all ward updates
    if (req.method === 'GET' && parsedUrl.pathname === '/api/all-ward-updates') {
        const client = new MongoClient(uri);

        try {
            await client.connect();
            const database = client.db('ward');
            const collection = database.collection('dailyUpdates');

            const allUpdates = await collection.aggregate([
                {
                    $group: {
                        _id: '$wardmailID',
                        wardNumber: { $first: '$wardNumber' },
                        rating: { $avg: '$rating' }
                    }
                }
            ]).toArray();

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(allUpdates));
        } catch (error) {
            console.error('Error fetching all ward updates:', error);
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ message: 'Internal server error' }));
        } finally {
            await client.close();
        }
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
