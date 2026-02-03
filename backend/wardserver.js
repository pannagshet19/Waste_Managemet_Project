const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const { MongoClient } = require('mongodb');

const PORT = process.env.PORT || 3001;
const uri = 'mongodb://localhost:27017/ward';

const server = http.createServer((req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Origin, Content-Type, Accept');
    res.setHeader('Access-Control-Max-Age', 86400); // 24 hours

    // Parse URL
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    // Serve the login page as default
    if (req.method === 'GET' && pathname === '/') {
        fs.readFile(path.join(__dirname, 'index.html'), (err, data) => {
            if (err) {
                res.writeHead(500, { 'Content-Type': 'text/html' });
                res.end('Internal Server Error');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }

    // Serve ward pages (ward1.html, ward2.html, etc.)
    if (req.method === 'GET' && pathname.startsWith('/ward') && pathname.endsWith('.html')) {
        fs.readFile(path.join(__dirname, pathname), (err, data) => {
            if (err) {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('Page not found');
                return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(data);
        });
        return;
    }

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    // Handle POST requests to /api/login
    if (req.method === 'POST' && pathname === '/api/login') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            const { wardmailID, wardpassword } = JSON.parse(body);
            console.log(`Login attempt for wardmailID: ${wardmailID}`);

            const client = new MongoClient(uri);

            try {
                await client.connect();
                const database = client.db('ward');
                const collection = database.collection('details');

                const user = await collection.findOne({ wardmailID: wardmailID });
                console.log('User found:', user);

                if (!user) {
                    res.writeHead(401, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Invalid ID or password' }));
                } else {
                    if (wardpassword === user.wardpassword) {
                        const wardNumber = user.wardNumber;
                        console.log('Ward Number:', wardNumber);
                        res.writeHead(200, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Login successful', wardNumber }));
                    } else {
                        res.writeHead(401, { 'Content-Type': 'application/json' });
                        res.end(JSON.stringify({ message: 'Invalid ID or password' }));
                    }
                }
            } catch (error) {
                console.error('Error in wardserver.js:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Internal server error' }));
            } finally {
                await client.close();
            }
        });
        return;
    }

    // Handle POST requests to /api/daily-update
    if (req.method === 'POST' && pathname === '/api/daily-update') {
        let body = '';

        req.on('data', chunk => {
            body += chunk.toString();
        });

        req.on('end', async () => {
            const { wardmailID, wardNumber, workersArrived, garbageCollected, garbageLeft,rainyDay} = JSON.parse(body);
            console.log(`Daily update received from ${wardmailID}: (Ward Number ${wardNumber}): Workers Arrived: ${workersArrived}, Garbage Collected: ${garbageCollected}, Garbage Left: ${garbageLeft}, Rainy Day: ${rainyDay}`);

            const client = new MongoClient(uri);

            try {
                await client.connect();
                const database = client.db('ward');
                const collection = database.collection('dailyUpdates');

                // Check if an update has already been submitted today
                const today = new Date();
                today.setHours(0, 0, 0, 0); // Set to start of the day
                const existingUpdate = await collection.findOne({ wardmailID: wardmailID, date: today });

                let message = 'Update successful';
                let rating = 0;
                let averageRating = 0;
                if (existingUpdate) {
                    // If update already exists, return error
                    res.writeHead(400, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ message: 'Update already submitted today' }));
                    return;
                }

                // Calculate the rating for today based on selected options
                if (!rainyDay) {
                    if (workersArrived) rating += 1;
                    if (garbageCollected) rating += 1;
                    if (garbageLeft) rating += 1;
                }

                const newUpdate = {
                    wardmailID,
                    wardNumber,
                    date: today,
                    workersArrived: !rainyDay ? workersArrived : false, // Ensure false if rainyDay
                    garbageCollected: !rainyDay ? garbageCollected : false, // Ensure false if rainyDay
                    garbageLeft: !rainyDay ? garbageLeft : false, // Ensure false if rainyDay
                    rating
                };

                    await collection.insertOne(newUpdate);
                
                if (rainyDay) {
                    message = 'It is a rainy day. Please collect your garbage and keep it in one place, Wait for tomorrow, Have a good day!';
                }

                // Calculate the average rating over all updates for this ward
                const updates = await collection.find({ wardmailID: wardmailID }).toArray();
                if (updates.length > 0) {
                    averageRating = updates.reduce((sum, update) => sum + update.rating, 0) / updates.length;
                }

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message, rating, averageRating }));
            } catch (error) {
                console.error('Error in wardserver.js:', error);
                res.writeHead(500, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ message: 'Internal server error' }));
            } finally {
                await client.close();
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
